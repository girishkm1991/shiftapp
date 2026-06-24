export interface IQueueService {
  addJob(queueName: string, jobName: string, data: any): Promise<void>;
  processQueue(queueName: string, handler: (jobName: string, data: any) => Promise<void>): void;
}

export class InMemoryQueueService implements IQueueService {
  private handlers = new Map<string, (jobName: string, data: any) => Promise<void>>();
  private queues = new Map<string, Array<{ jobName: string; data: any }>>();

  async addJob(queueName: string, jobName: string, data: any): Promise<void> {
    console.log(`[QueueService] [Queue: ${queueName}] Adding job "${jobName}"`, data);

    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, []);
    }
    this.queues.get(queueName)!.push({ jobName, data });

    // Trigger processing asynchronously to simulate a background worker
    setTimeout(() => {
      this.processNextJob(queueName).catch(err => {
        console.error(`[QueueService] Error processing background job in "${queueName}":`, err);
      });
    }, 100);
  }

  processQueue(queueName: string, handler: (jobName: string, data: any) => Promise<void>): void {
    console.log(`[QueueService] Registering worker handler for queue "${queueName}"`);
    this.handlers.set(queueName, handler);
  }

  private async processNextJob(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue || queue.length === 0) return;

    const handler = this.handlers.get(queueName);
    if (!handler) {
      console.warn(`[QueueService] No handler registered for queue "${queueName}" yet. Job is deferred.`);
      return;
    }

    const job = queue.shift();
    if (!job) return;

    console.log(`[QueueService] [Queue: ${queueName}] Background worker processing job "${job.jobName}"...`);
    try {
      await handler(job.jobName, job.data);
      console.log(`[QueueService] [Queue: ${queueName}] Background job "${job.jobName}" completed successfully.`);
    } catch (err) {
      console.error(`[QueueService] [Queue: ${queueName}] Background job "${job.jobName}" failed:`, err);
    }
  }
}

// Global queue service instance
let queueServiceInstance: IQueueService;

export function getQueueService(): IQueueService {
  if (!queueServiceInstance) {
    const enableRedis = process.env.ENABLE_REDIS === 'true';
    if (enableRedis) {
      console.log('[QueueService] Redis/BullMQ requested (ENABLE_REDIS=true). Trying to initialize BullMQ service...');
      try {
        // BullMQ/Redis implementation is deferred for Phase 1. Falls back to in-memory provider safely.
        console.log('[QueueService] Using in-memory fallback since BullMQ is deferred for Phase 1.');
        queueServiceInstance = new InMemoryQueueService();
      } catch (e) {
        console.error('[QueueService] Failed to load Redis/BullMQ queue, falling back to in-memory:', e);
        queueServiceInstance = new InMemoryQueueService();
      }
    } else {
      console.log('[QueueService] Using InMemoryQueueService (Redis is disabled).');
      queueServiceInstance = new InMemoryQueueService();
    }
  }
  return queueServiceInstance;
}
