import { createLogger } from '../../logger';
import type { EventBus } from '../../core/eventBus';
import type { CreateTransferCommand } from './domain';

export interface DlqOriginalJob {
  id: string;
  command: CreateTransferCommand;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  retries: number;
}

export interface DeadLetterEntry {
  jobId: string;
  originalJob: DlqOriginalJob;
  failedAt: string;
  failureReason: string;
  retryCount: number;
  lastRetryAt: string;
  status: 'pending_review' | 'retrying' | 'recovered' | 'discarded';
  recoveredAt?: string;
  notes?: string;
}

export interface DeadLetterQueueStats {
  totalEntries: number;
  pendingReview: number;
  retrying: number;
  recovered: number;
  discarded: number;
}

export class DeadLetterQueue {
  private static readonly MAX_RETRY_ATTEMPTS = 3;
  private static readonly RETRY_BASE_DELAY_MS = 5_000;
  private static readonly MAX_RETRY_DELAY_MS = 60_000;
  private store: DeadLetterEntry[] = [];

  constructor(private readonly eventBus: EventBus) {}

  addEntry(
    originalJob: DlqOriginalJob,
    failureReason: string,
    retryCount: number,
  ): DeadLetterEntry {
    const entry: DeadLetterEntry = {
      jobId: originalJob.id,
      originalJob,
      failedAt: new Date().toISOString(),
      failureReason,
      retryCount,
      lastRetryAt: new Date().toISOString(),
      status: 'pending_review',
    };

    this.store.unshift(entry);

    const logger = this.getLogger({ jobId: originalJob.id });
    logger.warn({ failureReason, retryCount }, 'job moved to dead letter queue');

    void this.eventBus.publish({
      type: 'dlq.job_added',
      timestamp: entry.failedAt,
      payload: {
        jobId: entry.jobId,
        transferId: originalJob.command.idempotencyKey,
        failureReason,
        retryCount,
      },
    });

    return entry;
  }

  getAllEntries(): DeadLetterEntry[] {
    return [...this.store];
  }

  getEntry(jobId: string): DeadLetterEntry | null {
    return this.store.find((e) => e.jobId === jobId) || null;
  }

  getEntriesByStatus(status: DeadLetterEntry['status']): DeadLetterEntry[] {
    return this.store.filter((e) => e.status === status);
  }

  getStats(): DeadLetterQueueStats {
    return {
      totalEntries: this.store.length,
      pendingReview: this.store.filter((e) => e.status === 'pending_review').length,
      retrying: this.store.filter((e) => e.status === 'retrying').length,
      recovered: this.store.filter((e) => e.status === 'recovered').length,
      discarded: this.store.filter((e) => e.status === 'discarded').length,
    };
  }

  async retryJob(
    jobId: string,
    retryTransferFn: (command: CreateTransferCommand) => Promise<void>,
  ): Promise<DeadLetterEntry | null> {
    const entry = this.store.find((e) => e.jobId === jobId);
    if (!entry) return null;

    if (entry.retryCount >= DeadLetterQueue.MAX_RETRY_ATTEMPTS) {
      const logger = this.getLogger({ jobId });
      logger.warn({ retryCount: entry.retryCount }, 'dlq job max retries exceeded');
      return entry;
    }

    entry.status = 'retrying';
    const logger = this.getLogger({ jobId });

    const delay = Math.min(
      DeadLetterQueue.RETRY_BASE_DELAY_MS * Math.pow(2, entry.retryCount),
      DeadLetterQueue.MAX_RETRY_DELAY_MS,
    );

    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      await retryTransferFn(entry.originalJob.command);
      entry.status = 'recovered';
      entry.recoveredAt = new Date().toISOString();
      entry.notes = `Successfully recovered on retry attempt ${entry.retryCount + 1}`;
      logger.info('dlq job recovered');
    } catch (error: unknown) {
      entry.retryCount += 1;
      entry.lastRetryAt = new Date().toISOString();
      entry.failureReason = error instanceof Error ? error.message : 'Unknown error during retry';
      entry.status = 'pending_review';
      logger.warn({ retryCount: entry.retryCount, error: entry.failureReason }, 'dlq retry failed');
    }

    void this.eventBus.publish({
      type: 'dlq.job_retried',
      timestamp: new Date().toISOString(),
      payload: {
        jobId: entry.jobId,
        transferId: entry.originalJob.command.idempotencyKey,
        status: entry.status,
        retryCount: entry.retryCount,
      },
    });

    return entry;
  }

  async retryAll(
    retryTransferFn: (command: CreateTransferCommand) => Promise<void>,
  ): Promise<{ succeeded: number; failed: number }> {
    const pendingEntries = this.store.filter(
      (e) => e.status === 'pending_review' || e.status === 'retrying',
    );

    let succeeded = 0;
    let failed = 0;

    for (const entry of pendingEntries) {
      const result = await this.retryJob(entry.jobId, retryTransferFn);
      if (result?.status === 'recovered') {
        succeeded++;
      } else {
        failed++;
      }
    }

    return { succeeded, failed };
  }

  discardEntry(jobId: string): boolean {
    const index = this.store.findIndex((e) => e.jobId === jobId);
    if (index === -1) return false;

    this.store[index].status = 'discarded';
    this.store[index].notes = 'Discarded by admin';

    void this.eventBus.publish({
      type: 'dlq.job_discarded',
      timestamp: new Date().toISOString(),
      payload: {
        jobId,
        transferId: this.store[index].originalJob.command.idempotencyKey,
      },
    });

    return true;
  }

  purgeDiscarded(): number {
    const before = this.store.length;
    this.store = this.store.filter((e) => e.status !== 'discarded');
    return before - this.store.length;
  }

  private getLogger(context: Record<string, unknown>) {
    return createLogger({ component: 'deadLetterQueue', ...context });
  }
}
