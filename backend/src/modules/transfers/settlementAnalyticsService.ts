import { createLogger } from '../../logger';
import type { EventBus } from '../../core/eventBus';

export interface SettlementEvent {
  transferId: string;
  userId: string;
  amount: number;
  currency: string;
  createdAt: string;
  settledAt?: string;
  durationMs?: number;
  success: boolean;
  error?: string;
}

export interface SettlementAnalytics {
  averageSettlementTimeMs: number;
  failedTransferRate: number;
  totalTransfers: number;
  successfulTransfers: number;
  failedTransfers: number;
  averageTransferAmount: number;
  totalVolume: number;
  periodStart: string;
  periodEnd: string;
}

export interface SettlementTimeBucket {
  date: string;
  averageTimeMs: number;
  count: number;
  failedCount: number;
}

export class SettlementAnalyticsService {
  private settlements: SettlementEvent[] = [];
  private logger = createLogger({ component: 'settlementAnalyticsService' });

  constructor(private readonly eventBus: EventBus) {
    this.subscribeToEvents();
  }

  recordSettlement(event: SettlementEvent): void {
    this.settlements.push(event);
    if (this.settlements.length > 10_000) {
      this.settlements = this.settlements.slice(-5_000);
    }
  }

  getAnalytics(days = 30): SettlementAnalytics {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const relevant = this.settlements.filter(
      (s) => new Date(s.createdAt).getTime() >= cutoff,
    );

    const successful = relevant.filter((s) => s.success);
    const failed = relevant.filter((s) => !s.success);

    const totalDuration = successful.reduce((sum, s) => sum + (s.durationMs || 0), 0);
    const averageSettlementTimeMs = successful.length > 0
      ? Math.round(totalDuration / successful.length)
      : 0;

    const totalTransfers = relevant.length;
    const failedTransferRate = totalTransfers > 0
      ? Math.round((failed.length / totalTransfers) * 10000) / 100
      : 0;

    const totalVolume = relevant.reduce((sum, s) => sum + s.amount, 0);
    const averageTransferAmount = totalTransfers > 0
      ? Math.round((totalVolume / totalTransfers) * 100) / 100
      : 0;

    return {
      averageSettlementTimeMs,
      failedTransferRate,
      totalTransfers,
      successfulTransfers: successful.length,
      failedTransfers: failed.length,
      averageTransferAmount,
      totalVolume: Math.round(totalVolume * 100) / 100,
      periodStart: new Date(cutoff).toISOString(),
      periodEnd: new Date().toISOString(),
    };
  }

  getSettlementTimeTrend(days = 30, bucketDays = 1): SettlementTimeBucket[] {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const relevant = this.settlements.filter(
      (s) => new Date(s.createdAt).getTime() >= cutoff,
    );

    const buckets = new Map<string, { totalMs: number; count: number; failed: number }>();

    for (const event of relevant) {
      const date = new Date(event.createdAt);
      const bucketKey = date.toISOString().slice(0, 10);

      const existing = buckets.get(bucketKey) || { totalMs: 0, count: 0, failed: 0 };
      existing.totalMs += event.durationMs || 0;
      existing.count += 1;
      if (!event.success) existing.failed += 1;
      buckets.set(bucketKey, existing);
    }

    return Array.from(buckets.entries())
      .map(([date, data]) => ({
        date,
        averageTimeMs: data.count > 0 ? Math.round(data.totalMs / data.count) : 0,
        count: data.count,
        failedCount: data.failed,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  getFailedTransfers(days = 7, limit = 50): SettlementEvent[] {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return this.settlements
      .filter((s) => !s.success && new Date(s.createdAt).getTime() >= cutoff)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  private subscribeToEvents(): void {
    this.eventBus.subscribe<{
      transferId: string;
      userId: string;
      amount: number;
      currency: string;
    }>('transfer.settled', async (event) => {
      this.recordSettlement({
        transferId: event.payload.transferId,
        userId: event.payload.userId,
        amount: event.payload.amount,
        currency: event.payload.currency,
        createdAt: event.timestamp,
        settledAt: new Date().toISOString(),
        durationMs: 0,
        success: true,
      });
    });

    this.eventBus.subscribe<{
      transferId: string;
      userId: string;
      amount: number;
      currency: string;
      error?: string;
    }>('transfer.failed', async (event) => {
      const transfer = await this.findTransferRecord(event.payload.transferId);
      const createdAt = transfer?.createdAt || event.timestamp;
      this.recordSettlement({
        transferId: event.payload.transferId,
        userId: event.payload.userId,
        amount: event.payload.amount,
        currency: event.payload.currency,
        createdAt,
        success: false,
        error: event.payload.error,
      });
    });
  }

  private async findTransferRecord(
    transferId: string,
  ): Promise<{ createdAt: string } | null> {
    const { InMemoryTransferRepository } = await import(
      './inMemoryTransferRepository'
    );
    try {
      const repo = new InMemoryTransferRepository();
      const record = await repo.findById(transferId);
      return record ? { createdAt: record.createdAt } : null;
    } catch {
      return null;
    }
  }
}
