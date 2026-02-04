/**
 * ComputeKit Worker Pool
 * Manages a pool of Web Workers for parallel computation
 */

import type {
  ComputeKitOptions,
  ComputeOptions,
  ComputeProgress,
  WorkerInfo,
  WorkerState,
  PoolStats,
  WorkerMessage,
  ExecutePayload,
  ResultPayload,
  ErrorPayload,
  ProgressPayload,
} from './types';

import {
  generateId,
  createDeferred,
  withTimeout,
  findTransferables,
  getHardwareConcurrency,
  createLogger,
  estimatePayloadSize,
  formatBytes,
  type Deferred,
  type Logger,
} from './utils';

/** Task in the queue */
interface QueuedTask<T = unknown> {
  id: string;
  functionName: string;
  input: unknown;
  options?: ComputeOptions;
  deferred: Deferred<T>;
  priority: number;
  createdAt: number;
  onProgress?: (progress: ComputeProgress) => void;
}

/** Worker wrapper */
interface PoolWorker {
  id: string;
  worker: Worker;
  state: WorkerState;
  currentTask?: string;
  tasksCompleted: number;
  errors: number;
  createdAt: number;
  lastActiveAt: number;
  ready: boolean;
  readyPromise: Promise<void>;
}

/** Registry entry for compute functions */
interface RegisteredFunction {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  fn: Function;
  serialized: string;
}

/**
 * Worker Pool - manages Web Workers for parallel computation
 */
export class WorkerPool {
  private workers: Map<string, PoolWorker> = new Map();
  private taskQueue: QueuedTask[] = [];
  private pendingTasks: Map<string, QueuedTask> = new Map();
  private functions: Map<string, RegisteredFunction> = new Map();
  private workerUrl: string | null = null;
  private options: Required<ComputeKitOptions>;
  private logger: Logger;
  private initialized = false;
  private stats = {
    tasksCompleted: 0,
    tasksFailed: 0,
    totalDuration: 0,
  };

  constructor(options: ComputeKitOptions = {}) {
    this.options = {
      maxWorkers: options.maxWorkers ?? getHardwareConcurrency(),
      timeout: options.timeout ?? 30000,
      debug: options.debug ?? false,
      workerPath: options.workerPath ?? '',
      useSharedMemory: options.useSharedMemory ?? true,
      remoteDependencies: options.remoteDependencies ?? [],
      remoteDependencyNames: options.remoteDependencyNames ?? {},
    };

    this.logger = createLogger('ComputeKit:Pool', this.options.debug);
    this.logger.info('WorkerPool created with options:', this.options);
  }

  /**
   * Initialize the worker pool
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.logger.info('Initializing worker pool...');
    this.logger.info('Registered functions:', Array.from(this.functions.keys()));
    this.workerUrl = this.createWorkerBlob();

    // Create initial workers
    const workerCount = Math.min(2, this.options.maxWorkers);
    for (let i = 0; i < workerCount; i++) {
      await this.createWorker();
    }

    this.initialized = true;
    this.logger.info(`Worker pool initialized with ${workerCount} workers`);
  }

  private pendingRecreate: Promise<void> | null = null;

  /**
   * Register a compute function
   */
  register<TInput, TOutput>(
    name: string,
    fn: (input: TInput) => TOutput | Promise<TOutput>
  ): void {
    this.logger.debug(`Registering function: ${name}`);
    this.functions.set(name, {
      fn,
      serialized: fn.toString(),
    });

    // If already initialized, we need to recreate workers with updated functions
    if (this.initialized) {
      this.pendingRecreate = this.recreateWorkers();
    } else {
      // If not initialized yet but workerUrl exists, revoke it so it gets recreated
      if (this.workerUrl) {
        URL.revokeObjectURL(this.workerUrl);
        this.workerUrl = null;
      }
    }
  }

  /**
   * Recreate workers with updated function registry
   */
  private async recreateWorkers(): Promise<void> {
    this.logger.debug('Recreating workers with updated functions...');

    // Revoke old blob URL
    if (this.workerUrl) {
      URL.revokeObjectURL(this.workerUrl);
    }

    // Create new worker blob with all functions
    this.workerUrl = this.createWorkerBlob();

    // Terminate existing idle workers and create new ones
    const idleWorkers = Array.from(this.workers.entries()).filter(
      ([_, w]) => w.state === 'idle'
    );

    for (const [id, poolWorker] of idleWorkers) {
      poolWorker.worker.terminate();
      this.workers.delete(id);
    }

    // Create new workers
    const workerCount = Math.max(
      1,
      Math.min(2, this.options.maxWorkers) - this.workers.size
    );
    for (let i = 0; i < workerCount; i++) {
      await this.createWorker();
    }
  }

  /**
   * Execute a compute function
   */
  async execute<TInput, TOutput>(
    name: string,
    input: TInput,
    options?: ComputeOptions
  ): Promise<TOutput> {
    // Wait for any pending worker recreation
    if (this.pendingRecreate) {
      await this.pendingRecreate;
      this.pendingRecreate = null;
    }

    if (!this.initialized) {
      await this.initialize();
    }

    const fn = this.functions.get(name);
    if (!fn) {
      throw new Error(`Function "${name}" not registered`);
    }

    const taskId = generateId();
    const timeout = options?.timeout ?? this.options.timeout;

    this.logger.debug(`Executing task ${taskId} for function "${name}"`);

    // Check for abort signal
    if (options?.signal?.aborted) {
      throw new Error('Operation aborted');
    }

    const deferred = createDeferred<TOutput>();
    const task: QueuedTask<TOutput> = {
      id: taskId,
      functionName: name,
      input,
      options,
      deferred,
      priority: options?.priority ?? 5,
      createdAt: Date.now(),
      onProgress: options?.onProgress,
    };

    // Handle abort signal
    if (options?.signal) {
      options.signal.addEventListener('abort', () => {
        this.cancelTask(taskId);
        deferred.reject(new Error('Operation aborted'));
      });
    }

    // Add to queue
    this.enqueue(task);
    this.processQueue();

    return withTimeout(deferred.promise, timeout, `Task "${name}" timed out`);
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    const workers = Array.from(this.workers.values()).map(
      (w): WorkerInfo => ({
        id: w.id,
        state: w.state,
        currentTask: w.currentTask,
        tasksCompleted: w.tasksCompleted,
        errors: w.errors,
        createdAt: w.createdAt,
        lastActiveAt: w.lastActiveAt,
      })
    );

    return {
      workers,
      totalWorkers: this.workers.size,
      activeWorkers: workers.filter((w) => w.state === 'busy').length,
      idleWorkers: workers.filter((w) => w.state === 'idle').length,
      queueLength: this.taskQueue.length,
      tasksCompleted: this.stats.tasksCompleted,
      tasksFailed: this.stats.tasksFailed,
      averageTaskDuration:
        this.stats.tasksCompleted > 0
          ? this.stats.totalDuration / this.stats.tasksCompleted
          : 0,
    };
  }

  /**
   * Terminate all workers and clean up
   */
  async terminate(): Promise<void> {
    this.logger.info('Terminating worker pool...');

    // Reject all pending tasks
    for (const task of this.pendingTasks.values()) {
      task.deferred.reject(new Error('Worker pool terminated'));
    }
    this.pendingTasks.clear();
    this.taskQueue = [];

    // Terminate all workers
    for (const poolWorker of this.workers.values()) {
      poolWorker.worker.terminate();
      poolWorker.state = 'terminated';
    }
    this.workers.clear();

    // Revoke blob URL
    if (this.workerUrl) {
      URL.revokeObjectURL(this.workerUrl);
      this.workerUrl = null;
    }

    this.initialized = false;
    this.logger.info('Worker pool terminated');
  }

  /**
   * Create the worker blob URL
   */
  private createWorkerBlob(): string {
    // Serialize all registered functions
    const functionsCode = Array.from(this.functions.entries())
      .map(([name, { serialized }]) => `"${name}": ${serialized}`)
      .join(',\n');

    this.logger.debug(
      'Creating worker blob with functions:',
      Array.from(this.functions.keys())
    );

    // Generate importScripts for remote dependencies
    const remoteDeps = this.options.remoteDependencies;
    const importScriptsCode =
      remoteDeps.length > 0
        ? `importScripts(${remoteDeps.map((url) => `"${url}"`).join(', ')});`
        : '';

    // Generate alias assignments for remote dependencies to handle obfuscated names in production
    // This allows the worker to access third-party libraries under their obfuscated names if needed
    const dependencyAliases = this.options.remoteDependencyNames;
    let aliasCode = '';
    
    if (Object.keys(dependencyAliases).length > 0) {
      const aliases: string[] = [];
      for (const [url, varName] of Object.entries(dependencyAliases)) {
        // Try to extract the global variable name that will be created by the library
        const globalName = this.extractGlobalNameFromUrl(url);
        if (globalName && globalName !== varName) {
          // Create an alias from the detected global name to the specified varName
          // This handles cases where the library name differs from the import name in obfuscated code
          aliases.push(
            `if (typeof ${globalName} !== 'undefined' && typeof self.${varName} === 'undefined') {` +
            ` self.${varName} = ${globalName}; ` +
            `}`
          );
        }
      }
      aliasCode = aliases.join('\n');
    }

    const workerCode = `
${importScriptsCode}

// Create aliases for obfuscated names in production builds
${aliasCode}

const functions = {
${functionsCode}
};

self.onmessage = function(e) {
  const msg = e.data;
  if (msg.type === 'execute') {
    const fn = functions[msg.payload.functionName];
    if (!fn) {
      self.postMessage({ id: msg.id, type: 'error', payload: { message: 'Function not found: ' + msg.payload.functionName } });
      return;
    }
    try {
      const start = performance.now();
      Promise.resolve(fn(msg.payload.input)).then(function(result) {
        self.postMessage({ id: msg.id, type: 'result', payload: { data: result, duration: performance.now() - start } });
      }).catch(function(err) {
        self.postMessage({ id: msg.id, type: 'error', payload: { message: err.message || String(err) } });
      });
    } catch (err) {
      self.postMessage({ id: msg.id, type: 'error', payload: { message: err.message || String(err) } });
    }
  }
};
self.postMessage({ type: 'ready' });
`;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    return URL.createObjectURL(blob);
  }

  /**
   * Extract the likely global variable name from a URL
   * e.g., "https://cdnjs.cloudflare.com/ajax/libs/dayjs/1.11.18/dayjs.min.js" -> "dayjs"
   */
  private extractGlobalNameFromUrl(url: string): string | null {
    try {
      const pathname = new URL(url).pathname;
      const filename = pathname.split('/').pop() || '';
      // Remove common suffixes: .min.js, .js, .min.mjs, .mjs
      const bareFilename = filename
        .replace(/\.min\.(js|mjs)$/, '')
        .replace(/\.(js|mjs)$/, '');
      return bareFilename || null;
    } catch {
      return null;
    }
  }

  /**
   * Create a new worker
   */
  private async createWorker(): Promise<PoolWorker> {
    if (!this.workerUrl) {
      this.workerUrl = this.createWorkerBlob();
    }

    const id = generateId();
    const worker = new Worker(this.workerUrl);

    // Create ready promise
    let resolveReady: () => void;
    const readyPromise = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });

    const poolWorker: PoolWorker = {
      id,
      worker,
      state: 'idle',
      tasksCompleted: 0,
      errors: 0,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      ready: false,
      readyPromise,
    };

    // Set up message handler
    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      if (e.data.type === 'ready') {
        poolWorker.ready = true;
        resolveReady!();
      }
      this.handleWorkerMessage(poolWorker, e.data);
    };

    worker.onerror = (e: ErrorEvent) => {
      this.handleWorkerError(poolWorker, e);
    };

    this.workers.set(id, poolWorker);
    this.logger.debug(`Created worker ${id}`);

    // Wait for worker to be ready
    await readyPromise;
    this.logger.debug(`Worker ${id} is ready`);

    return poolWorker;
  }

  /**
   * Handle messages from workers
   */
  private handleWorkerMessage(poolWorker: PoolWorker, message: WorkerMessage): void {
    this.logger.debug('Received message from worker:', message);
    const { id, type, payload } = message;

    switch (type) {
      case 'ready':
        this.logger.debug(`Worker ${poolWorker.id} ready`);
        break;

      case 'result': {
        const task = this.pendingTasks.get(id);
        if (task) {
          const resultPayload = payload as ResultPayload;
          this.pendingTasks.delete(id);
          poolWorker.state = 'idle';
          poolWorker.currentTask = undefined;
          poolWorker.tasksCompleted++;
          poolWorker.lastActiveAt = Date.now();

          this.stats.tasksCompleted++;
          this.stats.totalDuration += resultPayload.duration;

          // Log with payload sizes in debug mode
          const inputSize = estimatePayloadSize(task.input);
          const outputSize = resultPayload.outputSize ?? 0;
          this.logger.debug(
            `Task ${id} (${task.functionName}): ` +
              `input=${formatBytes(inputSize)}, ` +
              `output=${formatBytes(outputSize)}, ` +
              `duration=${resultPayload.duration.toFixed(2)}ms`
          );
          task.deferred.resolve(resultPayload.data);

          // Process next task
          this.processQueue();
        }
        break;
      }

      case 'error': {
        const task = this.pendingTasks.get(id);
        if (task) {
          const errorPayload = payload as ErrorPayload;
          this.pendingTasks.delete(id);
          poolWorker.state = 'idle';
          poolWorker.currentTask = undefined;
          poolWorker.errors++;
          poolWorker.lastActiveAt = Date.now();

          this.stats.tasksFailed++;

          const error = new Error(errorPayload.message);
          if (errorPayload.stack) {
            error.stack = errorPayload.stack;
          }

          this.logger.error(`Task ${id} failed:`, errorPayload.message);
          task.deferred.reject(error);

          // Process next task
          this.processQueue();
        }
        break;
      }

      case 'progress': {
        const progressPayload = payload as ProgressPayload;
        const task = this.pendingTasks.get(progressPayload.taskId);
        if (task?.onProgress) {
          task.onProgress(progressPayload.progress);
        }
        break;
      }
    }
  }

  /**
   * Handle worker errors
   */
  private handleWorkerError(poolWorker: PoolWorker, error: ErrorEvent): void {
    this.logger.error(`Worker ${poolWorker.id} error:`, error.message);
    poolWorker.state = 'error';
    poolWorker.errors++;

    // Reject current task if any
    if (poolWorker.currentTask) {
      const task = this.pendingTasks.get(poolWorker.currentTask);
      if (task) {
        this.pendingTasks.delete(poolWorker.currentTask);
        task.deferred.reject(new Error(`Worker error: ${error.message}`));
      }
    }

    // Terminate and recreate the worker
    poolWorker.worker.terminate();
    this.workers.delete(poolWorker.id);

    // Create a new worker to replace it
    this.createWorker().then(() => this.processQueue());
  }

  /**
   * Add task to queue (priority-based)
   */
  private enqueue<T>(task: QueuedTask<T>): void {
    // Insert based on priority (higher priority first)
    let inserted = false;
    for (let i = 0; i < this.taskQueue.length; i++) {
      if (task.priority > this.taskQueue[i].priority) {
        this.taskQueue.splice(i, 0, task as QueuedTask);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      this.taskQueue.push(task as QueuedTask);
    }
  }

  /**
   * Process queued tasks
   */
  private async processQueue(): Promise<void> {
    if (this.taskQueue.length === 0) return;

    // Find an idle worker
    let idleWorker: PoolWorker | undefined;
    for (const worker of this.workers.values()) {
      if (worker.state === 'idle') {
        idleWorker = worker;
        break;
      }
    }

    // Create new worker if needed and under limit
    if (!idleWorker && this.workers.size < this.options.maxWorkers) {
      idleWorker = await this.createWorker();
    }

    if (!idleWorker) return;

    // Get next task
    const task = this.taskQueue.shift();
    if (!task) return;

    // Execute task
    this.executeOnWorker(idleWorker, task);

    // Continue processing if more tasks
    if (this.taskQueue.length > 0) {
      this.processQueue();
    }
  }

  /**
   * Execute task on a specific worker
   */
  private executeOnWorker(poolWorker: PoolWorker, task: QueuedTask): void {
    this.logger.debug(
      `executeOnWorker: Starting task ${task.id} (${task.functionName}) on worker ${poolWorker.id}`
    );
    poolWorker.state = 'busy';
    poolWorker.currentTask = task.id;
    poolWorker.lastActiveAt = Date.now();

    this.pendingTasks.set(task.id, task);

    const message: WorkerMessage<ExecutePayload> = {
      id: task.id,
      type: 'execute',
      payload: {
        functionName: task.functionName,
        input: task.input,
        // Don't send options - they may contain non-cloneable objects like AbortSignal
      },
      timestamp: Date.now(),
    };

    // Find transferables in input
    const transfer = findTransferables(task.input);

    this.logger.debug(`Posting message to worker:`, message);
    poolWorker.worker.postMessage(message, transfer);
    this.logger.debug(`Message posted to worker ${poolWorker.id}`);
  }

  /**
   * Cancel a pending task
   */
  private cancelTask(taskId: string): void {
    // Remove from queue
    const queueIndex = this.taskQueue.findIndex((t) => t.id === taskId);
    if (queueIndex !== -1) {
      this.taskQueue.splice(queueIndex, 1);
    }

    // Remove from pending (worker will complete but result ignored)
    this.pendingTasks.delete(taskId);
  }
}
