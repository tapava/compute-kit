import { W as WasmModuleConfig, C as ComputeKitOptions, a as ComputeOptions, P as PoolStats, b as ComputeKitEvents, c as ComputeResult } from './types-BOEbxzLO.cjs';
export { B as BatchItemResult, e as ComputeFunction, d as ComputeProgress, o as ParallelBatchConfig, p as ParallelBatchResult, n as PipelineEvents, l as PipelineMetrics, i as PipelineMode, m as PipelineOptions, k as PipelineState, j as PipelineStatus, h as StageConfig, g as StageInfo, S as StageStatus, f as WorkerInfo } from './types-BOEbxzLO.cjs';

/**
 * ComputeKit Typed Registry
 *
 * This module provides type-safe function registration and execution.
 * Users can extend the ComputeFunctionRegistry interface to get autocomplete
 * and type safety for their registered functions.
 *
 * @example
 * ```ts
 * // Extend the registry interface (in a .d.ts file or at the top of your file)
 * declare module '@computekit/core' {
 *   interface ComputeFunctionRegistry {
 *     fibonacci: { input: number; output: number };
 *     sum: { input: number[]; output: number };
 *     processData: { input: { items: string[] }; output: { count: number } };
 *   }
 * }
 *
 * // Now you get autocomplete and type safety!
 * const kit = new ComputeKit();
 * kit.register('fibonacci', (n) => ...);  // n is inferred as number
 * const result = await kit.run('fibonacci', 42);  // result is number
 * ```
 */
/**
 * Registry interface for compute functions.
 * Extend this interface using module augmentation to add your own functions.
 *
 * Each entry should be in the format:
 * ```ts
 * functionName: { input: InputType; output: OutputType }
 * ```
 *
 * @example
 * ```ts
 * declare module '@computekit/core' {
 *   interface ComputeFunctionRegistry {
 *     myFunction: { input: string; output: number };
 *   }
 * }
 * ```
 */
interface ComputeFunctionRegistry {
}
/**
 * Helper type to get all registered function names.
 * If no functions are registered, falls back to string.
 */
type RegisteredFunctionName = keyof ComputeFunctionRegistry extends never ? string : keyof ComputeFunctionRegistry;
/**
 * Helper type to check if the registry has any entries.
 */
type HasRegisteredFunctions = keyof ComputeFunctionRegistry extends never ? false : true;
/**
 * Get the input type for a registered function.
 * Falls back to TFallback if the function is not registered.
 */
type FunctionInput<TName extends string, TFallback = unknown> = TName extends keyof ComputeFunctionRegistry ? ComputeFunctionRegistry[TName]['input'] : TFallback;
/**
 * Get the output type for a registered function.
 * Falls back to TFallback if the function is not registered.
 */
type FunctionOutput<TName extends string, TFallback = unknown> = TName extends keyof ComputeFunctionRegistry ? ComputeFunctionRegistry[TName]['output'] : TFallback;
/**
 * Type for a compute function based on registry or explicit types.
 */
type ComputeFn<TInput, TOutput> = (input: TInput) => TOutput | Promise<TOutput>;
/**
 * Infer the compute function type for a registered function name.
 */
type InferComputeFn<TName extends string> = TName extends keyof ComputeFunctionRegistry ? ComputeFn<ComputeFunctionRegistry[TName]['input'], ComputeFunctionRegistry[TName]['output']> : ComputeFn<unknown, unknown>;
/**
 * Type helper for creating registry entries.
 * Use this to define your function types more easily.
 *
 * @example
 * ```ts
 * declare module '@computekit/core' {
 *   interface ComputeFunctionRegistry {
 *     fibonacci: DefineFunction<number, number>;
 *     sum: DefineFunction<number[], number>;
 *   }
 * }
 * ```
 */
type DefineFunction<TInput, TOutput> = {
    input: TInput;
    output: TOutput;
};

/**
 * Check if SharedArrayBuffer is available
 */
declare function isSharedArrayBufferAvailable(): boolean;
/**
 * Check if WASM is supported
 */
declare function isWasmSupported(): boolean;
/**
 * Get the number of logical processors
 */
declare function getHardwareConcurrency(): number;
/**
 * Detect transferable objects in data
 */
declare function findTransferables(data: unknown): Transferable[];
/**
 * Create a typed event emitter
 */
type EventHandler<T = unknown> = (data: T) => void;
declare class EventEmitter<TEvents extends Record<string, unknown>> {
    private handlers;
    on<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): () => void;
    off<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): void;
    emit<K extends keyof TEvents>(event: K, data: TEvents[K]): void;
    removeAllListeners(event?: keyof TEvents): void;
}

/**
 * ComputeKit WASM Loader
 * Utilities for loading and managing WebAssembly modules
 */

/**
 * Load a WASM module from various sources
 */
declare function loadWasmModule(source: string | ArrayBuffer | Uint8Array): Promise<WebAssembly.Module>;
/**
 * Load and instantiate a WASM module in one step
 */
declare function loadAndInstantiate(config: WasmModuleConfig): Promise<{
    module: WebAssembly.Module;
    instance: WebAssembly.Instance;
}>;
/**
 * Create a WASM module from AssemblyScript-compiled bytes
 */
declare function loadAssemblyScript(source: string | ArrayBuffer, imports?: WebAssembly.Imports): Promise<{
    module: WebAssembly.Module;
    instance: WebAssembly.Instance;
    exports: Record<string, unknown>;
}>;
/**
 * Helper to wrap WASM exports for easier use
 */
declare function wrapWasmExports<T extends Record<string, unknown>>(instance: WebAssembly.Instance): T;
/**
 * Create a typed array view into WASM memory
 */
declare function getMemoryView<T extends ArrayBufferView>(memory: WebAssembly.Memory, ArrayType: new (buffer: ArrayBuffer, byteOffset?: number, length?: number) => T, offset?: number, length?: number): T;
/**
 * Copy data to WASM memory
 */
declare function copyToWasmMemory(memory: WebAssembly.Memory, data: ArrayBufferView, offset: number): void;
/**
 * Copy data from WASM memory
 */
declare function copyFromWasmMemory(memory: WebAssembly.Memory, offset: number, length: number): Uint8Array;
/**
 * Clear module caches
 */
declare function clearWasmCache(): void;
/**
 * Get cache statistics
 */
declare function getWasmCacheStats(): {
    modules: number;
    instances: number;
};

/**
 * ComputeKit Worker Pool
 * Manages a pool of Web Workers for parallel computation
 */

/**
 * Worker Pool - manages Web Workers for parallel computation
 */
declare class WorkerPool {
    private workers;
    private taskQueue;
    private pendingTasks;
    private functions;
    private workerUrl;
    private options;
    private logger;
    private initialized;
    private stats;
    constructor(options?: ComputeKitOptions);
    /**
     * Initialize the worker pool
     */
    initialize(): Promise<void>;
    private pendingRecreate;
    /**
     * Register a compute function
     */
    register<TInput, TOutput>(name: string, fn: (input: TInput) => TOutput | Promise<TOutput>): void;
    /**
     * Recreate workers with updated function registry
     */
    private recreateWorkers;
    /**
     * Execute a compute function
     */
    execute<TInput, TOutput>(name: string, input: TInput, options?: ComputeOptions): Promise<TOutput>;
    /**
     * Get pool statistics
     */
    getStats(): PoolStats;
    /**
     * Terminate all workers and clean up
     */
    terminate(): Promise<void>;
    /**
     * Create the worker blob URL
     */
    private createWorkerBlob;
    /**
     * Extract the likely global variable name from a URL
     * e.g., "https://cdnjs.cloudflare.com/ajax/libs/dayjs/1.11.18/dayjs.min.js" -> "dayjs"
     */
    private extractGlobalNameFromUrl;
    /**
     * Create a new worker
     */
    private createWorker;
    /**
     * Handle messages from workers
     */
    private handleWorkerMessage;
    /**
     * Handle worker errors
     */
    private handleWorkerError;
    /**
     * Add task to queue (priority-based)
     */
    private enqueue;
    /**
     * Process queued tasks
     */
    private processQueue;
    /**
     * Execute task on a specific worker
     */
    private executeOnWorker;
    /**
     * Cancel a pending task
     */
    private cancelTask;
}

/**
 * ComputeKit - Main Entry Point
 * WASM + Worker toolkit for React & Web apps
 */

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
declare class ComputeKit extends EventEmitter<ComputeKitEvents> {
    private pool;
    constructor(options?: ComputeKitOptions);
    /**
     * Initialize ComputeKit
     * Called automatically on first run, but can be called manually for eager initialization
     */
    initialize(): Promise<void>;
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
    register<TName extends RegisteredFunctionName, TInput = FunctionInput<TName extends string ? TName : never>, TOutput = FunctionOutput<TName extends string ? TName : never>>(name: TName, fn: TName extends keyof ComputeFunctionRegistry ? ComputeFn<ComputeFunctionRegistry[TName]['input'], ComputeFunctionRegistry[TName]['output']> : ComputeFn<TInput, TOutput>): this;
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
    run<TName extends RegisteredFunctionName, TInput = FunctionInput<TName extends string ? TName : never>, TOutput = FunctionOutput<TName extends string ? TName : never>>(name: TName, input: TName extends keyof ComputeFunctionRegistry ? ComputeFunctionRegistry[TName]['input'] : TInput, options?: ComputeOptions): Promise<TName extends keyof ComputeFunctionRegistry ? ComputeFunctionRegistry[TName]['output'] : TOutput>;
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
    runWithMetadata<TName extends RegisteredFunctionName, TInput = FunctionInput<TName extends string ? TName : never>, TOutput = FunctionOutput<TName extends string ? TName : never>>(name: TName, input: TName extends keyof ComputeFunctionRegistry ? ComputeFunctionRegistry[TName]['input'] : TInput, options?: ComputeOptions): Promise<ComputeResult<TName extends keyof ComputeFunctionRegistry ? ComputeFunctionRegistry[TName]['output'] : TOutput>>;
    /**
     * Get pool statistics
     */
    getStats(): PoolStats;
    /**
     * Check if WebAssembly is supported
     */
    isWasmSupported(): boolean;
    /**
     * Terminate the worker pool and clean up resources
     */
    terminate(): Promise<void>;
}
/**
 * Create a pre-configured ComputeKit instance
 */
declare function createComputeKit(options?: ComputeKitOptions): ComputeKit;
/**
 * Get the default shared ComputeKit instance
 */
declare function getDefaultInstance(): ComputeKit;
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
declare function register<TName extends RegisteredFunctionName, TInput = FunctionInput<TName extends string ? TName : never>, TOutput = FunctionOutput<TName extends string ? TName : never>>(name: TName, fn: TName extends keyof ComputeFunctionRegistry ? ComputeFn<ComputeFunctionRegistry[TName]['input'], ComputeFunctionRegistry[TName]['output']> : ComputeFn<TInput, TOutput>): void;
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
declare function run<TName extends RegisteredFunctionName, TInput = FunctionInput<TName extends string ? TName : never>, TOutput = FunctionOutput<TName extends string ? TName : never>>(name: TName, input: TName extends keyof ComputeFunctionRegistry ? ComputeFunctionRegistry[TName]['input'] : TInput, options?: ComputeOptions): Promise<TName extends keyof ComputeFunctionRegistry ? ComputeFunctionRegistry[TName]['output'] : TOutput>;

export { type ComputeFn, type ComputeFunctionRegistry, ComputeKit, ComputeKitEvents, ComputeKitOptions, ComputeOptions, ComputeResult, type DefineFunction, type FunctionInput, type FunctionOutput, type HasRegisteredFunctions, type InferComputeFn, PoolStats, type RegisteredFunctionName, WasmModuleConfig, WorkerPool, clearWasmCache, copyFromWasmMemory, copyToWasmMemory, createComputeKit, findTransferables, getDefaultInstance, getHardwareConcurrency, getMemoryView, getWasmCacheStats, isSharedArrayBufferAvailable, isWasmSupported, loadAndInstantiate, loadAssemblyScript, loadWasmModule, register, run, wrapWasmExports };
