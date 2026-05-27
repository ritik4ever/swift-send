import { config } from '../../config';
import { createLogger } from '../../logger';
import { getCircuitBreaker } from '../../utils/resilience';
import type { ErrorLogService } from './errorLogService';

export interface LatencySample {
  timestamp: string;
  latencyMs: number;
  status: 'online' | 'degraded' | 'offline';
}

export interface StellarMonitorState {
  currentStatus: 'online' | 'degraded' | 'offline';
  currentLatencyMs: number | null;
  lastCheckedAt: string;
  uptimePercent: number;
  averageLatencyMs: number;
  samples: LatencySample[];
  outagesLogged: number;
  degradedSince?: string;
  lastOutageAt?: string;
}

export interface StellarMonitorConfig {
  checkIntervalMs: number;
  degradedLatencyThresholdMs: number;
  offlineTimeoutMs: number;
  sampleWindowSize: number;
}

export class StellarMonitorService {
  private static readonly DEFAULT_CONFIG: StellarMonitorConfig = {
    checkIntervalMs: 30_000,
    degradedLatencyThresholdMs: 2_000,
    offlineTimeoutMs: 5_000,
    sampleWindowSize: 60,
  };

  private state: StellarMonitorState = {
    currentStatus: 'online',
    currentLatencyMs: null,
    lastCheckedAt: new Date().toISOString(),
    uptimePercent: 100,
    averageLatencyMs: 0,
    samples: [],
    outagesLogged: 0,
  };

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private logger = createLogger({ component: 'stellarMonitorService' });
  private readonly cfg: StellarMonitorConfig;

  constructor(
    private readonly errorLogService?: ErrorLogService,
    configOverride?: Partial<StellarMonitorConfig>,
  ) {
    this.cfg = { ...StellarMonitorService.DEFAULT_CONFIG, ...configOverride };
  }

  start(): void {
    if (this.intervalId) return;

    this.performCheck();
    this.intervalId = setInterval(() => this.performCheck(), this.cfg.checkIntervalMs);

    this.logger.info(
      { intervalMs: this.cfg.checkIntervalMs },
      'stellar monitor started',
    );
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.info('stellar monitor stopped');
    }
  }

  getState(): StellarMonitorState {
    return { ...this.state, samples: [...this.state.samples] };
  }

  async performCheck(): Promise<LatencySample> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.cfg.offlineTimeoutMs);

    const breaker = getCircuitBreaker('stellar-monitor', {
      failureThreshold: 3,
      resetTimeoutMs: 30_000,
    });

    let sample: LatencySample;

    try {
      const response = await breaker.execute(async () => {
        const res = await fetch(`${config.stellar.horizonUrl}`, {
          method: 'GET',
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Horizon responded with ${res.status}`);
        return res;
      });

      const latencyMs = Date.now() - startedAt;

      const status: LatencySample['status'] =
        latencyMs >= this.cfg.degradedLatencyThresholdMs ? 'degraded' : 'online';

      sample = {
        timestamp: new Date().toISOString(),
        latencyMs,
        status,
      };

      this.logger.debug({ latencyMs, status }, 'stellar monitor check ok');
    } catch {
      sample = {
        timestamp: new Date().toISOString(),
        latencyMs: 0,
        status: 'offline',
      };

      this.logger.warn('stellar monitor check failed');
    } finally {
      clearTimeout(timeout);
    }

    this.state.samples.push(sample);
    if (this.state.samples.length > this.cfg.sampleWindowSize) {
      this.state.samples.shift();
    }

    this.state.currentStatus = sample.status;
    this.state.currentLatencyMs = sample.latencyMs;
    this.state.lastCheckedAt = sample.timestamp;
    this.state.averageLatencyMs = this.calculateAverageLatency();
    this.state.uptimePercent = this.calculateUptime();

    if (sample.status === 'offline') {
      this.state.outagesLogged++;
      this.state.lastOutageAt = sample.timestamp;

      if (this.errorLogService) {
        this.errorLogService.logError({
          source: 'stellar',
          severity: 'high',
          category: 'network',
          message: `Stellar Horizon outage detected — ${config.stellar.horizonUrl} unreachable`,
          metadata: {
            latencyMs: sample.latencyMs,
            horizonUrl: config.stellar.horizonUrl,
            network: config.stellar.network,
          },
        });
      }
    }

    if (sample.status === 'degraded' && !this.state.degradedSince) {
      this.state.degradedSince = sample.timestamp;

      if (this.errorLogService) {
        this.errorLogService.logError({
          source: 'stellar',
          severity: 'medium',
          category: 'network',
          message: `Stellar Horizon latency degraded: ${sample.latencyMs}ms — ${config.stellar.horizonUrl}`,
          metadata: {
            latencyMs: sample.latencyMs,
            thresholdMs: this.cfg.degradedLatencyThresholdMs,
            horizonUrl: config.stellar.horizonUrl,
          },
        });
      }
    }

    if (sample.status === 'online' && this.state.degradedSince) {
      this.state.degradedSince = undefined;
    }

    return sample;
  }

  private calculateAverageLatency(): number {
    const onlineSamples = this.state.samples.filter((s) => s.status !== 'offline' && s.latencyMs > 0);
    if (onlineSamples.length === 0) return 0;
    const sum = onlineSamples.reduce((acc, s) => acc + s.latencyMs, 0);
    return Math.round(sum / onlineSamples.length);
  }

  private calculateUptime(): number {
    if (this.state.samples.length === 0) return 100;
    const onlineCount = this.state.samples.filter(
      (s) => s.status === 'online' || s.status === 'degraded',
    ).length;
    return Math.round((onlineCount / this.state.samples.length) * 100);
  }
}
