/**
 * ComputeKit Core Types
 * Type definitions for the WASM + Worker toolkit
 */
/** Configuration options for ComputeKit */
interface ComputeKitOptions {
    /** Maximum number of workers in the pool (default: navigator.hardwareConcurrency || 4) */
    maxWorkers?: number;
    /** Timeout for compute operations in milliseconds (default: 30000) */
    timeout?: number;
    /** Enable debug logging (default: false) */
    debug?: boolean;
    /** Custom path to worker script */
    workerPath?: string;
    /** Whether to use SharedArrayBuffer when available (default: true) */
    useSharedMemory?: boolean;
    /** Remote scripts to load in workers via importScripts */
    remoteDependencies?: string[];
    /** Maps remote dependency URLs to their global variable names (useful for handling obfuscation in production builds) */
    remoteDependencyNames?: Record<string, string>;
}
/** Options for individual compute operations */
interface ComputeOptions {
    /** Timeout for this specific operation (overrides global) */
    timeout?: number;
    /** Transfer these ArrayBuffers to the worker (improves performance) */
    transfer?: ArrayBuffer[];
    /** Priority level for scheduling (0-10, higher = more priority) */
    priority?: number;
    /** Abort signal to cancel the operation */
    signal?: AbortSignal;
    /** Progress callback for long-running operations */
    onProgress?: (progress: ComputeProgress) => void;
}
/** Progress information for compute operations */
interface ComputeProgress {
    /** Progress percentage (0-100) */
    percent: number;
    /** Current step/phase name */
    phase?: string;
    /** Estimated time remaining in milliseconds */
    estimatedTimeRemaining?: number;
    /** Any additional data from the compute function */
    data?: unknown;
}
/** Result wrapper with metadata */
interface ComputeResult<T> {
    /** The computed result */
    data: T;
    /** Time taken in milliseconds */
    duration: number;
    /** Whether the result came from cache */
    cached: boolean;
    /** Worker ID that processed this */
    workerId: string;
    /** Size of input data in bytes (available in debug mode) */
    inputSize?: number;
    /** Size of output data in bytes (available in debug mode) */
    outputSize?: number;
}
/** Function definition for registration */
interface ComputeFunction<TInput = unknown, TOutput = unknown> {
    /** The compute function implementation */
    fn: (input: TInput) => TOutput | Promise<TOutput>;
    /** Optional WASM module to load */
    wasmModule?: WebAssembly.Module | ArrayBuffer | string;
    /** Whether this function supports progress reporting */
    supportsProgress?: boolean;
}
/** WASM module configuration */
interface WasmModuleConfig {
    /** Path to the WASM file or base64 encoded WASM */
    source: string | ArrayBuffer;
    /** Imports to provide to the WASM module */
    imports?: WebAssembly.Imports;
    /** Memory configuration */
    memory?: {
        initial: number;
        maximum?: number;
        shared?: boolean;
    };
}
/** Worker state */
type WorkerState = 'idle' | 'busy' | 'error' | 'terminated';
/** Worker info */
interface WorkerInfo {
    id: string;
    state: WorkerState;
    currentTask?: string;
    tasksCompleted: number;
    errors: number;
    createdAt: number;
    lastActiveAt: number;
}
/** Pool statistics */
interface PoolStats {
    workers: WorkerInfo[];
    totalWorkers: number;
    activeWorkers: number;
    idleWorkers: number;
    queueLength: number;
    tasksCompleted: number;
    tasksFailed: number;
    averageTaskDuration: number;
}
/** Event data for worker:created */
interface WorkerCreatedEvent {
    info: WorkerInfo;
}
/** Event data for worker:terminated */
interface WorkerTerminatedEvent {
    info: WorkerInfo;
}
/** Event data for worker:error */
interface WorkerErrorEvent {
    error: Error;
    info: WorkerInfo;
}
/** Event data for task:start */
interface TaskStartEvent {
    taskId: string;
    functionName: string;
}
/** Event data for task:complete */
interface TaskCompleteEvent {
    taskId: string;
    duration: number;
}
/** Event data for task:error */
interface TaskErrorEvent {
    taskId: string;
    error: Error;
}
/** Event data for task:progress */
interface TaskProgressEvent {
    taskId: string;
    progress: ComputeProgress;
}
/** Events emitted by ComputeKit */
type ComputeKitEvents = {
    'worker:created': WorkerCreatedEvent;
    'worker:terminated': WorkerTerminatedEvent;
    'worker:error': WorkerErrorEvent;
    'task:start': TaskStartEvent;
    'task:complete': TaskCompleteEvent;
    'task:error': TaskErrorEvent;
    'task:progress': TaskProgressEvent;
    [key: string]: unknown;
};
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
/** Pipeline execution mode */
type PipelineMode = 'sequential' | 'parallel';
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
/** Pipeline configuration options */
interface PipelineOptions {
    /** Execution mode (default: 'sequential') */
    mode?: PipelineMode;
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
}
/** Events emitted by Pipeline */
interface PipelineEvents {
    'pipeline:start': {
        input: unknown;
    };
    'pipeline:complete': {
        output: unknown;
        duration: number;
    };
    'pipeline:error': {
        error: Error;
        stageId: string;
    };
    'pipeline:cancel': {
        stageId: string;
    };
    'stage:start': StageInfo;
    'stage:progress': {
        stageId: string;
        progress: number;
    };
    'stage:complete': StageInfo;
    'stage:error': {
        stage: StageInfo;
        error: Error;
    };
    'stage:skip': StageInfo;
    'stage:retry': {
        stage: StageInfo;
        attempt: number;
    };
}
/** Configuration for parallel batch processing */
interface ParallelBatchConfig<TItem = unknown> {
    /** Items to process in parallel */
    items: TItem[];
    /** Name of the registered compute function */
    functionName: string;
    /** Maximum concurrent executions (default: all) */
    concurrency?: number;
    /** Compute options for batch items */
    options?: ComputeOptions;
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

export type { BatchItemResult as B, ComputeKitOptions as C, PoolStats as P, StageStatus as S, WasmModuleConfig as W, ComputeOptions as a, ComputeKitEvents as b, ComputeResult as c, ComputeProgress as d, ComputeFunction as e, WorkerInfo as f, StageInfo as g, StageConfig as h, PipelineMode as i, PipelineStatus as j, PipelineState as k, PipelineMetrics as l, PipelineOptions as m, PipelineEvents as n, ParallelBatchConfig as o, ParallelBatchResult as p };
