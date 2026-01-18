/**
 * ComputeKit - Main Entry Point
 * WASM + Worker toolkit for React & Web apps
 */

import type {
  ComputeKitOptions,
  ComputeOptions,
  ComputeResult,
  PoolStats,
  ComputeKitEvents,
} from './types';

import { WorkerPool } from './pool';
import { EventEmitter, isWasmSupported, createLogger } from './utils';

const logger = createLogger('ComputeKit');

/**
 * ComputeKit - The main class for managing compute operations
 *
 * @example
 * ```ts
 * import { ComputeKit } from '@computekit/core';
 *
 * const kit = new ComputeKit();
 *
 * // Register a compute function
 * kit.register('fibonacci', (n: number) => {
 *   if (n <= 1) return n;
 *   let a = 0, b = 1;
 *   for (let i = 2; i <= n; i++) {
 *     [a, b] = [b, a + b];
 *   }
 *   return b;
 * });
 *
 * // Execute the function
 * const result = await kit.run('fibonacci', 50);
 * console.log(result); // 12586269025
 * ```
 */
export class ComputeKit extends EventEmitter<ComputeKitEvents> {
  private pool: WorkerPool;

  constructor(options: ComputeKitOptions = {}) {
    super();
    this.pool = new WorkerPool(options);
    logger.debug('ComputeKit initialized', options);
  }

  /**
   * Initialize ComputeKit
   * Called automatically on first run, but can be called manually for eager initialization
   */
  async initialize(): Promise<void> {
    await this.pool.initialize();
  }

  /**
   * Register a compute function
   *
   * @param name - Unique name for the function
   * @param fn - The function to execute (will run in a Web Worker)
   *
   * @example
   * ```ts
   * kit.register('sum', (arr: number[]) => arr.reduce((a, b) => a + b, 0));
   * ```
   */
  register<TInput, TOutput>(
    name: string,
    fn: (input: TInput) => TOutput | Promise<TOutput>
  ): this {
    this.pool.register(name, fn);
    return this;
  }

  /**
   * Execute a registered compute function
   *
   * @param name - Name of the registered function
   * @param input - Input data for the function
   * @param options - Execution options
   * @returns Promise resolving to the function result
   *
   * @example
   * ```ts
   * const sum = await kit.run('sum', [1, 2, 3, 4, 5]);
   * ```
   */
  async run<TInput, TOutput>(
    name: string,
    input: TInput,
    options?: ComputeOptions
  ): Promise<TOutput> {
    return this.pool.execute<TInput, TOutput>(name, input, options);
  }

  /**
   * Execute a registered compute function with full result metadata
   *
   * @param name - Name of the registered function
   * @param input - Input data for the function
   * @param options - Execution options
   * @returns Promise resolving to ComputeResult with metadata
   *
   * @example
   * ```ts
   * const result = await kit.runWithMetadata('sum', data);
   * console.log(`Took ${result.duration}ms`);
   * ```
   */
  async runWithMetadata<TInput, TOutput>(
    name: string,
    input: TInput,
    options?: ComputeOptions
  ): Promise<ComputeResult<TOutput>> {
    const startTime = performance.now();
    const data = await this.pool.execute<TInput, TOutput>(name, input, options);
    const duration = performance.now() - startTime;

    return {
      data,
      duration,
      cached: false,
      workerId: 'unknown', // Would need pool changes to track this
    };
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    return this.pool.getStats();
  }

  /**
   * Check if WebAssembly is supported
   */
  isWasmSupported(): boolean {
    return isWasmSupported();
  }

  /**
   * Terminate the worker pool and clean up resources
   */
  async terminate(): Promise<void> {
    await this.pool.terminate();
    this.removeAllListeners();
  }
}

/**
 * Create a pre-configured ComputeKit instance
 */
export function createComputeKit(options?: ComputeKitOptions): ComputeKit {
  return new ComputeKit(options);
}

/**
 * Default shared instance
 */
let defaultInstance: ComputeKit | null = null;

/**
 * Get the default shared ComputeKit instance
 */
export function getDefaultInstance(): ComputeKit {
  if (!defaultInstance) {
    defaultInstance = new ComputeKit();
  }
  return defaultInstance;
}

/**
 * Register a function on the default instance
 */
export function register<TInput, TOutput>(
  name: string,
  fn: (input: TInput) => TOutput | Promise<TOutput>
): void {
  getDefaultInstance().register(name, fn);
}

/**
 * Run a function on the default instance
 */
export async function run<TInput, TOutput>(
  name: string,
  input: TInput,
  options?: ComputeOptions
): Promise<TOutput> {
  return getDefaultInstance().run<TInput, TOutput>(name, input, options);
}

// Re-export types
export type {
  ComputeKitOptions,
  ComputeOptions,
  ComputeProgress,
  ComputeResult,
  ComputeFunction,
  PoolStats,
  WorkerInfo,
  WasmModuleConfig,
  ComputeKitEvents,
  // Pipeline types
  StageStatus,
  StageInfo,
  StageConfig,
  PipelineMode,
  PipelineStatus,
  PipelineState,
  PipelineMetrics,
  PipelineOptions,
  PipelineEvents,
  // Parallel batch types
  ParallelBatchConfig,
  BatchItemResult,
  ParallelBatchResult,
} from './types';

// Re-export utilities
export {
  isWasmSupported,
  isSharedArrayBufferAvailable,
  getHardwareConcurrency,
  findTransferables,
} from './utils';

// Re-export WASM utilities
export {
  loadWasmModule,
  loadAndInstantiate,
  loadAssemblyScript,
  wrapWasmExports,
  getMemoryView,
  copyToWasmMemory,
  copyFromWasmMemory,
  clearWasmCache,
  getWasmCacheStats,
} from './wasm';

// Re-export pool
export { WorkerPool } from './pool';
