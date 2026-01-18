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

import type {
  ComputeFunctionRegistry,
  RegisteredFunctionName,
  FunctionInput,
  FunctionOutput,
  ComputeFn,
} from './registry';

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
   * @param name - Unique name for the function (autocompletes if registry is extended)
   * @param fn - The function to execute (will run in a Web Worker)
   *
   * @example
   * ```ts
   * // Basic usage
   * kit.register('sum', (arr: number[]) => arr.reduce((a, b) => a + b, 0));
   *
   * // With typed registry (extend ComputeFunctionRegistry for autocomplete)
   * // declare module '@computekit/core' {
   * //   interface ComputeFunctionRegistry {
   * //     sum: { input: number[]; output: number };
   * //   }
   * // }
   * // kit.register('sum', (arr) => arr.reduce((a, b) => a + b, 0));
   * ```
   */
  register<
    TName extends RegisteredFunctionName,
    TInput = FunctionInput<TName extends string ? TName : never>,
    TOutput = FunctionOutput<TName extends string ? TName : never>,
  >(
    name: TName,
    fn: TName extends keyof ComputeFunctionRegistry
      ? ComputeFn<
          ComputeFunctionRegistry[TName]['input'],
          ComputeFunctionRegistry[TName]['output']
        >
      : ComputeFn<TInput, TOutput>
  ): this {
    this.pool.register(name as string, fn as ComputeFn<unknown, unknown>);
    return this;
  }

  /**
   * Execute a registered compute function
   *
   * @param name - Name of the registered function (autocompletes if registry is extended)
   * @param input - Input data for the function (type-safe if registry is extended)
   * @param options - Execution options
   * @returns Promise resolving to the function result (type-safe if registry is extended)
   *
   * @example
   * ```ts
   * const sum = await kit.run('sum', [1, 2, 3, 4, 5]);
   *
   * // With typed registry, input/output types are inferred:
   * // const result = await kit.run('fibonacci', 50); // result: number
   * ```
   */
  async run<
    TName extends RegisteredFunctionName,
    TInput = FunctionInput<TName extends string ? TName : never>,
    TOutput = FunctionOutput<TName extends string ? TName : never>,
  >(
    name: TName,
    input: TName extends keyof ComputeFunctionRegistry
      ? ComputeFunctionRegistry[TName]['input']
      : TInput,
    options?: ComputeOptions
  ): Promise<
    TName extends keyof ComputeFunctionRegistry
      ? ComputeFunctionRegistry[TName]['output']
      : TOutput
  > {
    return this.pool.execute(name as string, input, options);
  }

  /**
   * Execute a registered compute function with full result metadata
   *
   * @param name - Name of the registered function (autocompletes if registry is extended)
   * @param input - Input data for the function (type-safe if registry is extended)
   * @param options - Execution options
   * @returns Promise resolving to ComputeResult with metadata
   *
   * @example
   * ```ts
   * const result = await kit.runWithMetadata('sum', data);
   * console.log(`Took ${result.duration}ms`);
   * ```
   */
  async runWithMetadata<
    TName extends RegisteredFunctionName,
    TInput = FunctionInput<TName extends string ? TName : never>,
    TOutput = FunctionOutput<TName extends string ? TName : never>,
  >(
    name: TName,
    input: TName extends keyof ComputeFunctionRegistry
      ? ComputeFunctionRegistry[TName]['input']
      : TInput,
    options?: ComputeOptions
  ): Promise<
    ComputeResult<
      TName extends keyof ComputeFunctionRegistry
        ? ComputeFunctionRegistry[TName]['output']
        : TOutput
    >
  > {
    type ActualOutput = TName extends keyof ComputeFunctionRegistry
      ? ComputeFunctionRegistry[TName]['output']
      : TOutput;

    const startTime = performance.now();
    const data = (await this.pool.execute(
      name as string,
      input,
      options
    )) as ActualOutput;
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
 *
 * @example
 * ```ts
 * import { register } from '@computekit/core';
 *
 * register('fibonacci', (n: number) => {
 *   if (n <= 1) return n;
 *   let a = 0, b = 1;
 *   for (let i = 2; i <= n; i++) {
 *     [a, b] = [b, a + b];
 *   }
 *   return b;
 * });
 * ```
 */
export function register<
  TName extends RegisteredFunctionName,
  TInput = FunctionInput<TName extends string ? TName : never>,
  TOutput = FunctionOutput<TName extends string ? TName : never>,
>(
  name: TName,
  fn: TName extends keyof ComputeFunctionRegistry
    ? ComputeFn<
        ComputeFunctionRegistry[TName]['input'],
        ComputeFunctionRegistry[TName]['output']
      >
    : ComputeFn<TInput, TOutput>
): void {
  getDefaultInstance().register(name, fn);
}

/**
 * Run a function on the default instance
 *
 * @example
 * ```ts
 * import { run } from '@computekit/core';
 *
 * const result = await run('fibonacci', 50);
 * console.log(result); // Type is inferred if registry is extended
 * ```
 */
export async function run<
  TName extends RegisteredFunctionName,
  TInput = FunctionInput<TName extends string ? TName : never>,
  TOutput = FunctionOutput<TName extends string ? TName : never>,
>(
  name: TName,
  input: TName extends keyof ComputeFunctionRegistry
    ? ComputeFunctionRegistry[TName]['input']
    : TInput,
  options?: ComputeOptions
): Promise<
  TName extends keyof ComputeFunctionRegistry
    ? ComputeFunctionRegistry[TName]['output']
    : TOutput
> {
  return getDefaultInstance().run(name, input, options);
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

// Re-export typed registry types
export type {
  ComputeFunctionRegistry,
  RegisteredFunctionName,
  FunctionInput,
  FunctionOutput,
  ComputeFn,
  InferComputeFn,
  DefineFunction,
  HasRegisteredFunctions,
} from './registry';

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
