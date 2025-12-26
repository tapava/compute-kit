/**
 * ComputeKit Worker Runtime
 * Code that runs inside Web Workers
 */

import type {
  WorkerMessage,
  ExecutePayload,
  ResultPayload,
  ErrorPayload,
  ComputeProgress,
} from '../types';

import { generateId, findTransferables } from '../utils';

/** Registry of compute functions available in the worker */
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
const functionRegistry = new Map<string, Function>();

/** Current task context for progress reporting */
let currentTaskId: string | null = null;

/**
 * Report progress from within a compute function
 */
export function reportProgress(progress: Partial<ComputeProgress>): void {
  if (!currentTaskId) {
    console.warn('reportProgress called outside of compute function');
    return;
  }

  const message: WorkerMessage = {
    id: generateId(),
    type: 'progress',
    payload: {
      taskId: currentTaskId,
      progress: {
        percent: progress.percent ?? 0,
        phase: progress.phase,
        estimatedTimeRemaining: progress.estimatedTimeRemaining,
        data: progress.data,
      },
    },
    timestamp: Date.now(),
  };

  self.postMessage(message);
}

/**
 * Register a compute function in the worker
 */
export function registerFunction(
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  fn: Function
): void {
  functionRegistry.set(name, fn);
}

/**
 * Execute a registered function
 */
async function executeFunction(functionName: string, input: unknown): Promise<unknown> {
  const fn = functionRegistry.get(functionName);

  if (!fn) {
    throw new Error(`Function "${functionName}" not found in worker`);
  }

  return fn(input);
}

/**
 * Handle incoming messages from the main thread
 */
async function handleMessage(event: MessageEvent<WorkerMessage>): Promise<void> {
  const { id, type, payload } = event.data;

  if (type === 'execute') {
    const { functionName, input } = payload as ExecutePayload;
    const startTime = performance.now();

    // Set current task for progress reporting
    currentTaskId = id;

    try {
      const result = await executeFunction(functionName, input);
      const duration = performance.now() - startTime;

      // Find transferable objects in result
      const transfer = findTransferables(result);

      const response: WorkerMessage<ResultPayload> = {
        id,
        type: 'result',
        payload: {
          data: result,
          duration,
        },
        timestamp: Date.now(),
      };

      self.postMessage(response, transfer as Transferable[]);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      const response: WorkerMessage<ErrorPayload> = {
        id,
        type: 'error',
        payload: {
          message: error.message,
          stack: error.stack,
        },
        timestamp: Date.now(),
      };

      self.postMessage(response);
    } finally {
      currentTaskId = null;
    }
  } else if (type === 'init') {
    // Handle initialization if needed
    const response: WorkerMessage = {
      id,
      type: 'ready',
      timestamp: Date.now(),
    };
    self.postMessage(response);
  }
}

/**
 * Initialize the worker runtime
 */
export function initWorkerRuntime(): void {
  self.onmessage = handleMessage;

  // Signal that worker is ready
  const readyMessage: WorkerMessage = {
    id: generateId(),
    type: 'ready',
    timestamp: Date.now(),
  };
  self.postMessage(readyMessage);
}

// Export for use in worker entry point
export { functionRegistry };
