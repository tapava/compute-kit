import React, { ReactNode } from 'react';
import { ComputeOptions, ComputeKitOptions, ComputeKit, ComputeProgress, RegisteredFunctionName, FunctionInput, FunctionOutput, ComputeFunctionRegistry, ComputeFn, PoolStats } from '@computekit/core';
export { ComputeFn, ComputeFunctionRegistry, ComputeKit, ComputeKitOptions, ComputeOptions, ComputeProgress, DefineFunction, FunctionInput, FunctionOutput, HasRegisteredFunctions, InferComputeFn, PoolStats, RegisteredFunctionName } from '@computekit/core';

/**
 * ComputeKit React Bindings
 * React hooks and utilities for ComputeKit
 */

/** Status of a pipeline stage */
type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
/** Detailed information about a single pipeline stage */
interface StageInfo<TInput = unknown, TOutput = unknown> {
    /** Unique identifier for the stage */
    id: string;
    /** Display name for the stage */
    name: string;
    /** Name of the registered compute function to execute */
    functionName: string;
    /** Current status of this stage */
    status: StageStatus;
    /** Input data for this stage (set when stage starts) */
    input?: TInput;
    /** Output data from this stage (set when stage completes) */
    output?: TOutput;
    /** Error if stage failed */
    error?: Error;
    /** Start timestamp (ms since epoch) */
    startedAt?: number;
    /** End timestamp (ms since epoch) */
    completedAt?: number;
    /** Duration in milliseconds */
    duration?: number;
    /** Progress within this stage (0-100) */
    progress?: number;
    /** Number of retry attempts */
    retryCount: number;
    /** Compute options specific to this stage */
    options?: ComputeOptions;
}
/** Configuration for a pipeline stage */
interface StageConfig<TInput = unknown, TOutput = unknown> {
    /** Unique identifier for the stage */
    id: string;
    /** Display name for the stage */
    name: string;
    /** Name of the registered compute function */
    functionName: string;
    /** Transform input before passing to compute function */
    transformInput?: (input: TInput, previousResults: unknown[]) => unknown;
    /** Transform output after compute function returns */
    transformOutput?: (output: unknown) => TOutput;
    /** Whether to skip this stage based on previous results */
    shouldSkip?: (input: TInput, previousResults: unknown[]) => boolean;
    /** Maximum retry attempts on failure (default: 0) */
    maxRetries?: number;
    /** Delay between retries in ms (default: 1000) */
    retryDelay?: number;
    /** Compute options for this stage */
    options?: ComputeOptions;
}
/** Overall pipeline status */
type PipelineStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
/** Metrics for pipeline debugging and reporting */
interface PipelineMetrics {
    /** Total stages in pipeline */
    totalStages: number;
    /** Number of completed stages */
    completedStages: number;
    /** Number of failed stages */
    failedStages: number;
    /** Number of skipped stages */
    skippedStages: number;
    /** Total retry attempts across all stages */
    totalRetries: number;
    /** Slowest stage info */
    slowestStage: {
        id: string;
        name: string;
        duration: number;
    } | null;
    /** Fastest stage info */
    fastestStage: {
        id: string;
        name: string;
        duration: number;
    } | null;
    /** Average stage duration */
    averageStageDuration: number;
    /** Timestamp of each stage transition for timeline view */
    timeline: Array<{
        stageId: string;
        stageName: string;
        event: 'started' | 'completed' | 'failed' | 'skipped' | 'retry';
        timestamp: number;
        duration?: number;
        error?: string;
    }>;
}
/** Comprehensive pipeline state for debugging */
interface PipelineState<TInput = unknown, TOutput = unknown> {
    /** Overall pipeline status */
    status: PipelineStatus;
    /** All stage information */
    stages: StageInfo[];
    /** Index of currently executing stage (-1 if not running) */
    currentStageIndex: number;
    /** Current stage info (convenience) */
    currentStage: StageInfo | null;
    /** Overall progress percentage (0-100) */
    progress: number;
    /** Final output from the last stage */
    output: TOutput | null;
    /** Initial input that started the pipeline */
    input: TInput | null;
    /** Error that caused pipeline failure */
    error: Error | null;
    /** Pipeline start timestamp */
    startedAt: number | null;
    /** Pipeline completion timestamp */
    completedAt: number | null;
    /** Total duration in milliseconds */
    totalDuration: number | null;
    /** Results from each completed stage */
    stageResults: unknown[];
    /** Execution metrics for debugging */
    metrics: PipelineMetrics;
}
/** Result of a single item in parallel batch */
interface BatchItemResult<TOutput = unknown> {
    /** Index of the item in original array */
    index: number;
    /** Whether this item succeeded */
    success: boolean;
    /** Result if successful */
    data?: TOutput;
    /** Error if failed */
    error?: Error;
    /** Duration in ms */
    duration: number;
}
/** Aggregate result of parallel batch processing */
interface ParallelBatchResult<TOutput = unknown> {
    /** All individual results */
    results: BatchItemResult<TOutput>[];
    /** Successfully processed items */
    successful: TOutput[];
    /** Failed items with their errors */
    failed: Array<{
        index: number;
        error: Error;
    }>;
    /** Total duration */
    totalDuration: number;
    /** Success rate (0-1) */
    successRate: number;
}
/**
 * Props for ComputeKitProvider
 */
interface ComputeKitProviderProps {
    /** ComputeKit options */
    options?: ComputeKitOptions;
    /** Custom ComputeKit instance */
    instance?: ComputeKit;
    /** Children */
    children: ReactNode;
}
/**
 * Provider component for ComputeKit
 *
 * @example
 * ```tsx
 * import { ComputeKitProvider } from '@computekit/react';
 *
 * function App() {
 *   return (
 *     <ComputeKitProvider options={{ maxWorkers: 4 }}>
 *       <MyApp />
 *     </ComputeKitProvider>
 *   );
 * }
 * ```
 */
declare function ComputeKitProvider({ options, instance, children, }: ComputeKitProviderProps): React.ReactElement;
/**
 * Get the ComputeKit instance from context
 */
declare function useComputeKit(): ComputeKit;
/**
 * Status of a compute operation
 */
type ComputeStatus = 'idle' | 'running' | 'success' | 'error' | 'cancelled';
/**
 * State returned by useCompute
 */
interface UseComputeState<T> {
    /** The computed result */
    data: T | null;
    /** Loading state */
    loading: boolean;
    /** Error if computation failed */
    error: Error | null;
    /** Progress information */
    progress: ComputeProgress | null;
    /** Current status of the computation */
    status: ComputeStatus;
}
/**
 * Actions returned by useCompute
 */
interface UseComputeActions<TInput> {
    /** Execute the compute function */
    run: (input: TInput, options?: ComputeOptions) => Promise<void>;
    /** Reset the state */
    reset: () => void;
    /** Cancel ongoing computation */
    cancel: () => void;
}
/**
 * Return type for useCompute
 */
type UseComputeReturn<TInput, TOutput> = UseComputeState<TOutput> & UseComputeActions<TInput>;
/**
 * Options for useCompute hook
 */
interface UseComputeOptions extends ComputeOptions {
    /** Automatically run on mount with initial input */
    autoRun?: boolean;
    /** Initial input for autoRun */
    initialInput?: unknown;
    /** Reset state on new run */
    resetOnRun?: boolean;
}
/**
 * Hook for running compute functions
 *
 * @example
 * ```tsx
 * // Basic usage with explicit types
 * function FibonacciCalculator() {
 *   const { data, loading, error, run } = useCompute<number, number>('fibonacci');
 *
 *   return (
 *     <div>
 *       <button onClick={() => run(50)} disabled={loading}>
 *         Calculate Fibonacci(50)
 *       </button>
 *       {loading && <p>Computing...</p>}
 *       {error && <p>Error: {error.message}</p>}
 *       {data !== null && <p>Result: {data}</p>}
 *     </div>
 *   );
 * }
 *
 * // With typed registry (extend ComputeFunctionRegistry for autocomplete)
 * // declare module '@computekit/core' {
 * //   interface ComputeFunctionRegistry {
 * //     fibonacci: { input: number; output: number };
 * //   }
 * // }
 * // const { data, run } = useCompute('fibonacci'); // Types are inferred!
 * ```
 */
declare function useCompute<TName extends RegisteredFunctionName, TInput = FunctionInput<TName extends string ? TName : never>, TOutput = FunctionOutput<TName extends string ? TName : never>>(functionName: TName, options?: UseComputeOptions): UseComputeReturn<TName extends keyof ComputeFunctionRegistry ? ComputeFunctionRegistry[TName]['input'] : TInput, TName extends keyof ComputeFunctionRegistry ? ComputeFunctionRegistry[TName]['output'] : TOutput>;
/**
 * Hook that returns a memoized async function for compute operations
 *
 * @example
 * ```tsx
 * // Basic usage with explicit types
 * function Calculator() {
 *   const calculate = useComputeCallback<number[], number>('sum');
 *
 *   const handleClick = async () => {
 *     const result = await calculate([1, 2, 3, 4, 5]);
 *     console.log(result);
 *   };
 *
 *   return <button onClick={handleClick}>Calculate Sum</button>;
 * }
 *
 * // With typed registry - types are inferred!
 * // const calculate = useComputeCallback('sum');
 * ```
 */
declare function useComputeCallback<TName extends RegisteredFunctionName, TInput = FunctionInput<TName extends string ? TName : never>, TOutput = FunctionOutput<TName extends string ? TName : never>>(functionName: TName, options?: ComputeOptions): (input: TName extends keyof ComputeFunctionRegistry ? ComputeFunctionRegistry[TName]['input'] : TInput, runOptions?: ComputeOptions) => Promise<TName extends keyof ComputeFunctionRegistry ? ComputeFunctionRegistry[TName]['output'] : TOutput>;
/**
 * Hook to register and use a compute function
 *
 * @example
 * ```tsx
 * // Basic usage
 * function MyComponent() {
 *   const { run, loading, data } = useComputeFunction(
 *     'myFunction',
 *     (input: number) => input * 2
 *   );
 *
 *   return (
 *     <button onClick={() => run(5)} disabled={loading}>
 *       {loading ? 'Computing...' : `Result: ${data}`}
 *     </button>
 *   );
 * }
 *
 * // With typed registry - provides autocomplete and type safety
 * // declare module '@computekit/core' {
 * //   interface ComputeFunctionRegistry {
 * //     myFunction: { input: number; output: number };
 * //   }
 * // }
 * ```
 */
declare function useComputeFunction<TName extends RegisteredFunctionName, TInput = FunctionInput<TName extends string ? TName : never>, TOutput = FunctionOutput<TName extends string ? TName : never>>(name: TName, fn: TName extends keyof ComputeFunctionRegistry ? ComputeFn<ComputeFunctionRegistry[TName]['input'], ComputeFunctionRegistry[TName]['output']> : ComputeFn<TInput, TOutput>, options?: UseComputeOptions): UseComputeReturn<TName extends keyof ComputeFunctionRegistry ? ComputeFunctionRegistry[TName]['input'] : TInput, TName extends keyof ComputeFunctionRegistry ? ComputeFunctionRegistry[TName]['output'] : TOutput>;
/**
 * Hook to get worker pool statistics
 *
 * @example
 * ```tsx
 * function PoolMonitor() {
 *   const stats = usePoolStats(1000); // Update every second
 *
 *   return (
 *     <div>
 *       <p>Active Workers: {stats.activeWorkers}</p>
 *       <p>Queue Length: {stats.queueLength}</p>
 *       <p>Tasks Completed: {stats.tasksCompleted}</p>
 *     </div>
 *   );
 * }
 * ```
 */
declare function usePoolStats(refreshInterval?: number): PoolStats;
/**
 * Hook to check WASM support
 */
declare function useWasmSupport(): boolean;
/**
 * Options for usePipeline hook
 */
interface UsePipelineOptions {
    /** Stop pipeline on first stage failure (default: true) */
    stopOnError?: boolean;
    /** Global timeout for entire pipeline in ms */
    timeout?: number;
    /** Enable detailed timeline tracking (default: true) */
    trackTimeline?: boolean;
    /** Called when pipeline state changes */
    onStateChange?: (state: PipelineState) => void;
    /** Called when a stage starts */
    onStageStart?: (stage: StageInfo) => void;
    /** Called when a stage completes */
    onStageComplete?: (stage: StageInfo) => void;
    /** Called when a stage fails */
    onStageError?: (stage: StageInfo, error: Error) => void;
    /** Called when a stage is retried */
    onStageRetry?: (stage: StageInfo, attempt: number) => void;
    /** Automatically run pipeline on mount */
    autoRun?: boolean;
    /** Initial input for autoRun */
    initialInput?: unknown;
}
/**
 * Actions returned by usePipeline
 */
interface UsePipelineActions<TInput> {
    /** Start the pipeline with input */
    run: (input: TInput) => Promise<void>;
    /** Cancel the running pipeline */
    cancel: () => void;
    /** Reset pipeline to initial state */
    reset: () => void;
    /** Pause the pipeline (if supported) */
    pause: () => void;
    /** Resume a paused pipeline */
    resume: () => void;
    /** Retry failed stages */
    retry: () => Promise<void>;
    /** Get a formatted report of the pipeline execution */
    getReport: () => PipelineReport;
}
/**
 * Formatted report for debugging
 */
interface PipelineReport {
    /** Human-readable summary */
    summary: string;
    /** Detailed stage-by-stage breakdown */
    stageDetails: Array<{
        name: string;
        status: StageStatus;
        duration: string;
        error?: string;
    }>;
    /** Timeline of events */
    timeline: string[];
    /** Performance insights */
    insights: string[];
    /** Raw metrics */
    metrics: PipelineMetrics;
}
/**
 * Return type for usePipeline
 */
type UsePipelineReturn<TInput, TOutput> = PipelineState<TInput, TOutput> & UsePipelineActions<TInput> & {
    /** Whether pipeline is currently running */
    isRunning: boolean;
    /** Whether pipeline completed successfully */
    isComplete: boolean;
    /** Whether pipeline has failed */
    isFailed: boolean;
    /** Quick access to check if a specific stage is done */
    isStageComplete: (stageId: string) => boolean;
    /** Get a specific stage by ID */
    getStage: (stageId: string) => StageInfo | undefined;
};
/**
 * Hook for multi-stage pipeline processing
 *
 * Provides comprehensive debugging, progress tracking, and error handling
 * for complex multi-stage compute workflows.
 *
 * @example
 * ```tsx
 * function FileProcessor() {
 *   const pipeline = usePipeline<string[], ProcessedFiles>([
 *     { id: 'download', name: 'Download Files', functionName: 'downloadFiles' },
 *     { id: 'process', name: 'Process Files', functionName: 'processFiles' },
 *     { id: 'compress', name: 'Compress Output', functionName: 'compressFiles' },
 *   ]);
 *
 *   return (
 *     <div>
 *       <button onClick={() => pipeline.run(urls)} disabled={pipeline.isRunning}>
 *         Start Processing
 *       </button>
 *
 *       <div>Status: {pipeline.status}</div>
 *       <div>Progress: {pipeline.progress.toFixed(0)}%</div>
 *
 *       {pipeline.currentStage && (
 *         <div>Current: {pipeline.currentStage.name}</div>
 *       )}
 *
 *       {pipeline.stages.map(stage => (
 *         <div key={stage.id}>
 *           {stage.name}: {stage.status}
 *           {stage.duration && ` (${stage.duration}ms)`}
 *         </div>
 *       ))}
 *
 *       {pipeline.isFailed && (
 *         <button onClick={pipeline.retry}>Retry Failed</button>
 *       )}
 *
 *       {pipeline.isComplete && (
 *         <pre>{JSON.stringify(pipeline.getReport(), null, 2)}</pre>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
declare function usePipeline<TInput = unknown, TOutput = unknown>(stageConfigs: StageConfig[], options?: UsePipelineOptions): UsePipelineReturn<TInput, TOutput>;
/**
 * Result type for useParallelBatch
 */
interface UseParallelBatchReturn<TItem, TOutput> {
    /** Execute batch processing */
    run: (items: TItem[]) => Promise<ParallelBatchResult<TOutput>>;
    /** Current batch result */
    result: ParallelBatchResult<TOutput> | null;
    /** Loading state */
    loading: boolean;
    /** Current progress (0-100) */
    progress: number;
    /** Number of completed items */
    completedCount: number;
    /** Total items in current batch */
    totalCount: number;
    /** Cancel batch processing */
    cancel: () => void;
    /** Reset state */
    reset: () => void;
}
/**
 * Hook for parallel batch processing
 *
 * Useful for processing multiple items in parallel within a pipeline stage.
 *
 * @example
 * ```tsx
 * // Basic usage with explicit types
 * function BatchProcessor() {
 *   const batch = useParallelBatch<string, ProcessedFile>('processFile', {
 *     concurrency: 4
 *   });
 *
 *   return (
 *     <div>
 *       <button
 *         onClick={() => batch.run(fileUrls)}
 *         disabled={batch.loading}
 *       >
 *         Process {fileUrls.length} Files
 *       </button>
 *
 *       {batch.loading && (
 *         <div>
 *           Processing: {batch.completedCount}/{batch.totalCount}
 *           ({batch.progress.toFixed(0)}%)
 *         </div>
 *       )}
 *
 *       {batch.result && (
 *         <div>
 *           Success: {batch.result.successful.length}
 *           Failed: {batch.result.failed.length}
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 *
 * // With typed registry - types are inferred!
 * // const batch = useParallelBatch('processFile');
 * ```
 */
declare function useParallelBatch<TName extends RegisteredFunctionName, TItem = FunctionInput<TName extends string ? TName : never>, TOutput = FunctionOutput<TName extends string ? TName : never>>(functionName: TName, options?: {
    concurrency?: number;
    computeOptions?: ComputeOptions;
}): UseParallelBatchReturn<TName extends keyof ComputeFunctionRegistry ? ComputeFunctionRegistry[TName]['input'] : TItem, TName extends keyof ComputeFunctionRegistry ? ComputeFunctionRegistry[TName]['output'] : TOutput>;

export { type BatchItemResult, ComputeKitProvider, type ComputeKitProviderProps, type ComputeStatus, type ParallelBatchResult, type PipelineMetrics, type PipelineReport, type PipelineState, type PipelineStatus, type StageConfig, type StageInfo, type StageStatus, type UseComputeActions, type UseComputeOptions, type UseComputeReturn, type UseComputeState, type UseParallelBatchReturn, type UsePipelineActions, type UsePipelineOptions, type UsePipelineReturn, useCompute, useComputeCallback, useComputeFunction, useComputeKit, useParallelBatch, usePipeline, usePoolStats, useWasmSupport };
