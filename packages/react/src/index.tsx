/**
 * ComputeKit React Bindings
 * React hooks and utilities for ComputeKit
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  createContext,
  useContext,
  type ReactNode,
} from 'react';

import {
  ComputeKit,
  type ComputeKitOptions,
  type ComputeOptions,
  type ComputeProgress,
  type PoolStats,
} from '@computekit/core';

// ============================================================================
// Pipeline Types (defined here for React, also exported from @computekit/core)
// ============================================================================

/** Status of a pipeline stage */
export type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/** Detailed information about a single pipeline stage */
export interface StageInfo<TInput = unknown, TOutput = unknown> {
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
export interface StageConfig<TInput = unknown, TOutput = unknown> {
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
export type PipelineStatus =
  | 'idle' // Not started
  | 'running' // Currently executing
  | 'paused' // Paused mid-execution
  | 'completed' // All stages completed successfully
  | 'failed' // A stage failed (and wasn't recovered)
  | 'cancelled'; // User cancelled

/** Metrics for pipeline debugging and reporting */
export interface PipelineMetrics {
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
  slowestStage: { id: string; name: string; duration: number } | null;
  /** Fastest stage info */
  fastestStage: { id: string; name: string; duration: number } | null;
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
export interface PipelineState<TInput = unknown, TOutput = unknown> {
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
export interface BatchItemResult<TOutput = unknown> {
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
export interface ParallelBatchResult<TOutput = unknown> {
  /** All individual results */
  results: BatchItemResult<TOutput>[];
  /** Successfully processed items */
  successful: TOutput[];
  /** Failed items with their errors */
  failed: Array<{ index: number; error: Error }>;
  /** Total duration */
  totalDuration: number;
  /** Success rate (0-1) */
  successRate: number;
}

// ============================================================================
// Context
// ============================================================================

const ComputeKitContext = createContext<ComputeKit | null>(null);

/**
 * Props for ComputeKitProvider
 */
export interface ComputeKitProviderProps {
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
export function ComputeKitProvider({
  options,
  instance,
  children,
}: ComputeKitProviderProps): React.ReactElement {
  const kit = useMemo(() => {
    return instance ?? new ComputeKit(options);
  }, [instance, options]);

  useEffect(() => {
    return () => {
      // Only terminate if we created the instance
      if (!instance) {
        kit.terminate();
      }
    };
  }, [kit, instance]);

  return <ComputeKitContext.Provider value={kit}>{children}</ComputeKitContext.Provider>;
}

/**
 * Get the ComputeKit instance from context
 */
export function useComputeKit(): ComputeKit {
  const kit = useContext(ComputeKitContext);
  if (!kit) {
    throw new Error('useComputeKit must be used within a ComputeKitProvider');
  }
  return kit;
}

// ============================================================================
// useCompute Hook
// ============================================================================

/**
 * Status of a compute operation
 */
export type ComputeStatus = 'idle' | 'running' | 'success' | 'error' | 'cancelled';

/**
 * State returned by useCompute
 */
export interface UseComputeState<T> {
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
export interface UseComputeActions<TInput> {
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
export type UseComputeReturn<TInput, TOutput> = UseComputeState<TOutput> &
  UseComputeActions<TInput>;

/**
 * Options for useCompute hook
 */
export interface UseComputeOptions extends ComputeOptions {
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
 * ```
 */
export function useCompute<TInput = unknown, TOutput = unknown>(
  functionName: string,
  options: UseComputeOptions = {}
): UseComputeReturn<TInput, TOutput> {
  const kit = useComputeKit();
  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  const [state, setState] = useState<UseComputeState<TOutput>>({
    data: null,
    loading: false,
    error: null,
    progress: null,
    status: 'idle',
  });

  const reset = useCallback(() => {
    cancelledRef.current = false;
    setState({
      data: null,
      loading: false,
      error: null,
      progress: null,
      status: 'idle',
    });
  }, []);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      cancelledRef.current = true;
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setState((prev) => ({
        ...prev,
        loading: false,
        status: 'cancelled',
      }));
    }
  }, []);

  const run = useCallback(
    async (input: TInput, runOptions?: ComputeOptions) => {
      // Cancel any ongoing computation
      cancel();
      cancelledRef.current = false;

      // Create new abort controller
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Reset state if configured
      if (options.resetOnRun !== false) {
        setState((prev) => ({
          ...prev,
          loading: true,
          error: null,
          progress: null,
          status: 'running',
        }));
      } else {
        setState((prev) => ({ ...prev, loading: true, status: 'running' }));
      }

      try {
        const result = await kit.run<TInput, TOutput>(functionName, input, {
          ...options,
          ...runOptions,
          signal: runOptions?.signal ?? abortController.signal,
          onProgress: (progress) => {
            setState((prev) => ({ ...prev, progress }));
            options.onProgress?.(progress);
            runOptions?.onProgress?.(progress);
          },
        });

        if (!abortController.signal.aborted) {
          setState({
            data: result,
            loading: false,
            error: null,
            progress: null,
            status: 'success',
          });
        }
      } catch (err) {
        if (!abortController.signal.aborted && !cancelledRef.current) {
          setState({
            data: null,
            loading: false,
            error: err instanceof Error ? err : new Error(String(err)),
            progress: null,
            status: 'error',
          });
        }
      }
    },
    [kit, functionName, options, cancel]
  );

  // Auto-run on mount if configured
  useEffect(() => {
    if (options.autoRun && options.initialInput !== undefined) {
      run(options.initialInput as TInput);
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return {
    ...state,
    run,
    reset,
    cancel,
  };
}

// ============================================================================
// useComputeCallback Hook
// ============================================================================

/**
 * Hook that returns a memoized async function for compute operations
 *
 * @example
 * ```tsx
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
 * ```
 */
export function useComputeCallback<TInput = unknown, TOutput = unknown>(
  functionName: string,
  options?: ComputeOptions
): (input: TInput, runOptions?: ComputeOptions) => Promise<TOutput> {
  const kit = useComputeKit();

  return useCallback(
    (input: TInput, runOptions?: ComputeOptions) => {
      return kit.run<TInput, TOutput>(functionName, input, {
        ...options,
        ...runOptions,
      });
    },
    [kit, functionName, options]
  );
}

// ============================================================================
// useComputeFunction Hook
// ============================================================================

/**
 * Hook to register and use a compute function
 *
 * @example
 * ```tsx
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
 * ```
 */
export function useComputeFunction<TInput = unknown, TOutput = unknown>(
  name: string,
  fn: (input: TInput) => TOutput | Promise<TOutput>,
  options?: UseComputeOptions
): UseComputeReturn<TInput, TOutput> {
  const kit = useComputeKit();

  // Register function on mount
  useEffect(() => {
    kit.register(name, fn);
  }, [kit, name, fn]);

  return useCompute<TInput, TOutput>(name, options);
}

// ============================================================================
// usePoolStats Hook
// ============================================================================

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
export function usePoolStats(refreshInterval: number = 0): PoolStats {
  const kit = useComputeKit();
  const [stats, setStats] = useState<PoolStats>(() => kit.getStats());

  useEffect(() => {
    // For one-time fetch (refreshInterval <= 0), we rely on the initial state
    if (refreshInterval <= 0) {
      return;
    }

    const interval = setInterval(() => {
      setStats(kit.getStats());
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [kit, refreshInterval]);

  return stats;
}

// ============================================================================
// useWasmSupport Hook
// ============================================================================

/**
 * Hook to check WASM support
 */
export function useWasmSupport(): boolean {
  const kit = useComputeKit();
  return kit.isWasmSupported();
}

// ============================================================================
// usePipeline Hook - Multi-stage Processing
// ============================================================================

/**
 * Options for usePipeline hook
 */
export interface UsePipelineOptions {
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
export interface UsePipelineActions<TInput> {
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
export interface PipelineReport {
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
export type UsePipelineReturn<TInput, TOutput> = PipelineState<TInput, TOutput> &
  UsePipelineActions<TInput> & {
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
 * Create initial pipeline state
 */
function createInitialPipelineState<TInput, TOutput>(
  stages: StageConfig[]
): PipelineState<TInput, TOutput> {
  return {
    status: 'idle',
    stages: stages.map((config) => ({
      id: config.id,
      name: config.name,
      functionName: config.functionName,
      status: 'pending' as StageStatus,
      retryCount: 0,
      options: config.options,
    })),
    currentStageIndex: -1,
    currentStage: null,
    progress: 0,
    output: null,
    input: null,
    error: null,
    startedAt: null,
    completedAt: null,
    totalDuration: null,
    stageResults: [],
    metrics: {
      totalStages: stages.length,
      completedStages: 0,
      failedStages: 0,
      skippedStages: 0,
      totalRetries: 0,
      slowestStage: null,
      fastestStage: null,
      averageStageDuration: 0,
      timeline: [],
    },
  };
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}min`;
}

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
export function usePipeline<TInput = unknown, TOutput = unknown>(
  stageConfigs: StageConfig[],
  options: UsePipelineOptions = {}
): UsePipelineReturn<TInput, TOutput> {
  const kit = useComputeKit();
  const abortControllerRef = useRef<AbortController | null>(null);
  const pausedRef = useRef(false);
  const resumePromiseRef = useRef<{
    resolve: () => void;
    reject: (err: Error) => void;
  } | null>(null);

  const [state, setState] = useState<PipelineState<TInput, TOutput>>(() =>
    createInitialPipelineState<TInput, TOutput>(stageConfigs)
  );

  // Memoize stage configs to prevent unnecessary re-renders
  const stages = useMemo(() => stageConfigs, [stageConfigs]);

  /**
   * Add event to timeline
   */
  const addTimelineEvent = useCallback(
    (
      stageId: string,
      stageName: string,
      event: 'started' | 'completed' | 'failed' | 'skipped' | 'retry',
      duration?: number,
      error?: string
    ) => {
      if (options.trackTimeline === false) return;

      setState((prev) => ({
        ...prev,
        metrics: {
          ...prev.metrics,
          timeline: [
            ...prev.metrics.timeline,
            {
              stageId,
              stageName,
              event,
              timestamp: Date.now(),
              duration,
              error,
            },
          ],
        },
      }));
    },
    [options.trackTimeline]
  );

  /**
   * Update metrics after stage completion
   */
  const updateMetrics = useCallback(
    (_completedStage: StageInfo, allStages: StageInfo[]) => {
      const completedStages = allStages.filter((s) => s.status === 'completed');
      const durations = completedStages
        .filter((s) => s.duration !== undefined)
        .map((s) => ({ id: s.id, name: s.name, duration: s.duration! }));

      const slowest = durations.length
        ? durations.reduce((a, b) => (a.duration > b.duration ? a : b))
        : null;
      const fastest = durations.length
        ? durations.reduce((a, b) => (a.duration < b.duration ? a : b))
        : null;
      const avgDuration = durations.length
        ? durations.reduce((sum, d) => sum + d.duration, 0) / durations.length
        : 0;

      return {
        totalStages: allStages.length,
        completedStages: completedStages.length,
        failedStages: allStages.filter((s) => s.status === 'failed').length,
        skippedStages: allStages.filter((s) => s.status === 'skipped').length,
        totalRetries: allStages.reduce((sum, s) => sum + s.retryCount, 0),
        slowestStage: slowest,
        fastestStage: fastest,
        averageStageDuration: avgDuration,
      };
    },
    []
  );

  /**
   * Execute a single stage with retries
   */
  const executeStage = useCallback(
    async (
      stageConfig: StageConfig,
      stageIndex: number,
      input: unknown,
      previousResults: unknown[],
      signal: AbortSignal
    ): Promise<{ success: boolean; output?: unknown; error?: Error }> => {
      const maxRetries = stageConfig.maxRetries ?? 0;
      const retryDelay = stageConfig.retryDelay ?? 1000;
      let lastError: Error | undefined;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        // Check for abort
        if (signal.aborted) {
          return { success: false, error: new Error('Pipeline cancelled') };
        }

        // Check for pause
        if (pausedRef.current) {
          await new Promise<void>((resolve, reject) => {
            resumePromiseRef.current = { resolve, reject };
          });
        }

        // Check if should skip
        if (stageConfig.shouldSkip?.(input as never, previousResults)) {
          setState((prev) => {
            const newStages = [...prev.stages];
            newStages[stageIndex] = {
              ...newStages[stageIndex],
              status: 'skipped',
            };
            return {
              ...prev,
              stages: newStages,
            };
          });
          addTimelineEvent(stageConfig.id, stageConfig.name, 'skipped');
          options.onStageComplete?.(state.stages[stageIndex]);
          return { success: true, output: previousResults[previousResults.length - 1] };
        }

        // Transform input if needed
        const transformedInput = stageConfig.transformInput
          ? stageConfig.transformInput(input as never, previousResults)
          : input;

        const startTime = performance.now();

        // Update stage to running
        setState((prev) => {
          const newStages = [...prev.stages];
          newStages[stageIndex] = {
            ...newStages[stageIndex],
            status: 'running',
            input: transformedInput,
            startedAt: Date.now(),
            retryCount: attempt,
          };
          return {
            ...prev,
            stages: newStages,
            currentStageIndex: stageIndex,
            currentStage: newStages[stageIndex],
          };
        });

        if (attempt === 0) {
          addTimelineEvent(stageConfig.id, stageConfig.name, 'started');
          options.onStageStart?.(state.stages[stageIndex]);
        } else {
          addTimelineEvent(stageConfig.id, stageConfig.name, 'retry');
          options.onStageRetry?.(state.stages[stageIndex], attempt);
        }

        try {
          const result = await kit.run(stageConfig.functionName, transformedInput, {
            ...stageConfig.options,
            signal,
            onProgress: (progress) => {
              setState((prev) => {
                const newStages = [...prev.stages];
                newStages[stageIndex] = {
                  ...newStages[stageIndex],
                  progress: progress.percent,
                };
                // Calculate overall progress
                const stageProgress = progress.percent / 100;
                const overallProgress =
                  ((stageIndex + stageProgress) / stages.length) * 100;
                return {
                  ...prev,
                  stages: newStages,
                  progress: overallProgress,
                };
              });
            },
          });

          const duration = performance.now() - startTime;

          // Transform output if needed
          const transformedOutput = stageConfig.transformOutput
            ? stageConfig.transformOutput(result)
            : result;

          // Update stage to completed
          setState((prev) => {
            const newStages = [...prev.stages];
            newStages[stageIndex] = {
              ...newStages[stageIndex],
              status: 'completed',
              output: transformedOutput,
              completedAt: Date.now(),
              duration,
              progress: 100,
            };

            const newMetrics = {
              ...prev.metrics,
              ...updateMetrics(newStages[stageIndex], newStages),
            };

            return {
              ...prev,
              stages: newStages,
              metrics: newMetrics,
              progress: ((stageIndex + 1) / stages.length) * 100,
            };
          });

          addTimelineEvent(stageConfig.id, stageConfig.name, 'completed', duration);
          options.onStageComplete?.(state.stages[stageIndex]);

          return { success: true, output: transformedOutput };
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));

          if (attempt < maxRetries) {
            // Wait before retry
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
            continue;
          }

          // Final failure
          const duration = performance.now() - startTime;

          setState((prev) => {
            const newStages = [...prev.stages];
            newStages[stageIndex] = {
              ...newStages[stageIndex],
              status: 'failed',
              error: lastError,
              completedAt: Date.now(),
              duration,
            };
            return {
              ...prev,
              stages: newStages,
              metrics: {
                ...prev.metrics,
                failedStages: prev.metrics.failedStages + 1,
              },
            };
          });

          addTimelineEvent(
            stageConfig.id,
            stageConfig.name,
            'failed',
            duration,
            lastError.message
          );
          options.onStageError?.(state.stages[stageIndex], lastError);

          return { success: false, error: lastError };
        }
      }

      return { success: false, error: lastError };
    },
    [kit, stages, state.stages, addTimelineEvent, updateMetrics, options]
  );

  /**
   * Run the pipeline
   */
  const run = useCallback(
    async (input: TInput): Promise<void> => {
      // Cancel any existing run
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      pausedRef.current = false;

      const startTime = Date.now();

      // Reset state
      setState(() => ({
        ...createInitialPipelineState<TInput, TOutput>(stages),
        status: 'running',
        input,
        startedAt: startTime,
      }));

      const stageResults: unknown[] = [];
      let currentInput: unknown = input;
      let finalError: Error | null = null;

      for (let i = 0; i < stages.length; i++) {
        if (abortController.signal.aborted) {
          setState((prev) => ({
            ...prev,
            status: 'cancelled',
            completedAt: Date.now(),
            totalDuration: Date.now() - startTime,
          }));
          return;
        }

        const result = await executeStage(
          stages[i],
          i,
          currentInput,
          stageResults,
          abortController.signal
        );

        if (!result.success) {
          finalError = result.error ?? new Error('Stage failed');

          if (options.stopOnError !== false) {
            setState((prev) => ({
              ...prev,
              status: 'failed',
              error: finalError,
              stageResults,
              completedAt: Date.now(),
              totalDuration: Date.now() - startTime,
            }));
            return;
          }
        }

        if (result.output !== undefined) {
          stageResults.push(result.output);
          currentInput = result.output;
        }
      }

      // Pipeline completed
      setState((prev) => ({
        ...prev,
        status: finalError ? 'failed' : 'completed',
        output: (currentInput as TOutput) ?? null,
        error: finalError,
        stageResults,
        completedAt: Date.now(),
        totalDuration: Date.now() - startTime,
        currentStageIndex: -1,
        currentStage: null,
        progress: 100,
      }));

      options.onStateChange?.(state);
    },
    [stages, executeStage, options, state]
  );

  /**
   * Cancel the pipeline
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (resumePromiseRef.current) {
      resumePromiseRef.current.reject(new Error('Pipeline cancelled'));
      resumePromiseRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      status: 'cancelled',
      completedAt: Date.now(),
      totalDuration: prev.startedAt ? Date.now() - prev.startedAt : null,
    }));
  }, []);

  /**
   * Reset the pipeline
   */
  const reset = useCallback(() => {
    cancel();
    setState(createInitialPipelineState<TInput, TOutput>(stages));
  }, [cancel, stages]);

  /**
   * Pause the pipeline
   */
  const pause = useCallback(() => {
    pausedRef.current = true;
    setState((prev) => ({
      ...prev,
      status: 'paused',
    }));
  }, []);

  /**
   * Resume the pipeline
   */
  const resume = useCallback(() => {
    pausedRef.current = false;
    if (resumePromiseRef.current) {
      resumePromiseRef.current.resolve();
      resumePromiseRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      status: 'running',
    }));
  }, []);

  /**
   * Retry failed stages
   */
  const retry = useCallback(async (): Promise<void> => {
    if (state.status !== 'failed' || !state.input) return;

    // Find first failed stage
    const failedIndex = state.stages.findIndex((s) => s.status === 'failed');
    if (failedIndex === -1) return;

    // Get input for failed stage (output of previous stage or original input)
    const retryInput =
      failedIndex === 0 ? state.input : state.stageResults[failedIndex - 1];

    // Create new abort controller
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setState((prev) => ({
      ...prev,
      status: 'running',
      error: null,
    }));

    const stageResults = [...state.stageResults.slice(0, failedIndex)];
    let currentInput = retryInput;

    for (let i = failedIndex; i < stages.length; i++) {
      if (abortController.signal.aborted) {
        setState((prev) => ({ ...prev, status: 'cancelled' }));
        return;
      }

      const result = await executeStage(
        stages[i],
        i,
        currentInput,
        stageResults,
        abortController.signal
      );

      if (!result.success) {
        setState((prev) => ({
          ...prev,
          status: 'failed',
          error: result.error ?? new Error('Stage failed'),
          stageResults,
        }));
        return;
      }

      if (result.output !== undefined) {
        stageResults.push(result.output);
        currentInput = result.output;
      }
    }

    setState((prev) => ({
      ...prev,
      status: 'completed',
      output: currentInput as TOutput,
      stageResults,
      completedAt: Date.now(),
      totalDuration: prev.startedAt ? Date.now() - prev.startedAt : null,
      progress: 100,
    }));
  }, [state, stages, executeStage]);

  /**
   * Generate execution report
   */
  const getReport = useCallback((): PipelineReport => {
    const stageDetails = state.stages.map((stage) => ({
      name: stage.name,
      status: stage.status,
      duration: stage.duration ? formatDuration(stage.duration) : '-',
      error: stage.error?.message,
    }));

    const timeline = state.metrics.timeline.map((event) => {
      const time = new Date(event.timestamp).toISOString().split('T')[1].split('.')[0];
      const duration = event.duration ? ` (${formatDuration(event.duration)})` : '';
      const error = event.error ? ` - ${event.error}` : '';
      return `[${time}] ${event.stageName}: ${event.event}${duration}${error}`;
    });

    const insights: string[] = [];

    if (state.metrics.slowestStage) {
      insights.push(
        `Slowest stage: ${state.metrics.slowestStage.name} (${formatDuration(
          state.metrics.slowestStage.duration
        )})`
      );
    }

    if (state.metrics.fastestStage) {
      insights.push(
        `Fastest stage: ${state.metrics.fastestStage.name} (${formatDuration(
          state.metrics.fastestStage.duration
        )})`
      );
    }

    if (state.metrics.totalRetries > 0) {
      insights.push(`Total retries: ${state.metrics.totalRetries}`);
    }

    if (state.metrics.averageStageDuration > 0) {
      insights.push(
        `Average stage duration: ${formatDuration(state.metrics.averageStageDuration)}`
      );
    }

    const successRate =
      state.metrics.totalStages > 0
        ? (state.metrics.completedStages / state.metrics.totalStages) * 100
        : 0;

    const summary = [
      `Pipeline Status: ${state.status.toUpperCase()}`,
      `Stages: ${state.metrics.completedStages}/${state.metrics.totalStages} completed`,
      `Success Rate: ${successRate.toFixed(0)}%`,
      state.totalDuration ? `Total Duration: ${formatDuration(state.totalDuration)}` : '',
      state.error ? `Error: ${state.error.message}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      summary,
      stageDetails,
      timeline,
      insights,
      metrics: state.metrics,
    };
  }, [state]);

  /**
   * Check if a stage is complete
   */
  const isStageComplete = useCallback(
    (stageId: string): boolean => {
      const stage = state.stages.find((s) => s.id === stageId);
      return stage?.status === 'completed';
    },
    [state.stages]
  );

  /**
   * Get a stage by ID
   */
  const getStage = useCallback(
    (stageId: string): StageInfo | undefined => {
      return state.stages.find((s) => s.id === stageId);
    },
    [state.stages]
  );

  // Auto-run on mount if configured
  useEffect(() => {
    if (options.autoRun && options.initialInput !== undefined) {
      run(options.initialInput as TInput);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return {
    ...state,
    run,
    cancel,
    reset,
    pause,
    resume,
    retry,
    getReport,
    isRunning: state.status === 'running',
    isComplete: state.status === 'completed',
    isFailed: state.status === 'failed',
    isStageComplete,
    getStage,
  };
}

// ============================================================================
// useParallelBatch Hook - Parallel Processing Within Stages
// ============================================================================

/**
 * Result type for useParallelBatch
 */
export interface UseParallelBatchReturn<TItem, TOutput> {
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
 * ```
 */
export function useParallelBatch<TItem = unknown, TOutput = unknown>(
  functionName: string,
  options: {
    concurrency?: number;
    computeOptions?: ComputeOptions;
  } = {}
): UseParallelBatchReturn<TItem, TOutput> {
  const kit = useComputeKit();
  const abortControllerRef = useRef<AbortController | null>(null);

  const [state, setState] = useState<{
    result: ParallelBatchResult<TOutput> | null;
    loading: boolean;
    progress: number;
    completedCount: number;
    totalCount: number;
  }>({
    result: null,
    loading: false,
    progress: 0,
    completedCount: 0,
    totalCount: 0,
  });

  const run = useCallback(
    async (items: TItem[]): Promise<ParallelBatchResult<TOutput>> => {
      // Cancel any existing batch
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setState({
        result: null,
        loading: true,
        progress: 0,
        completedCount: 0,
        totalCount: items.length,
      });

      const startTime = performance.now();
      const results: BatchItemResult<TOutput>[] = [];
      const concurrency = options.concurrency ?? items.length;

      // Process in batches based on concurrency
      for (let i = 0; i < items.length; i += concurrency) {
        if (abortController.signal.aborted) {
          break;
        }

        const batch = items.slice(i, i + concurrency);
        const batchPromises = batch.map(async (item, batchIndex) => {
          const index = i + batchIndex;
          const itemStart = performance.now();

          try {
            const data = await kit.run<TItem, TOutput>(functionName, item, {
              ...options.computeOptions,
              signal: abortController.signal,
            });

            const itemResult: BatchItemResult<TOutput> = {
              index,
              success: true,
              data,
              duration: performance.now() - itemStart,
            };

            return itemResult;
          } catch (err) {
            const itemResult: BatchItemResult<TOutput> = {
              index,
              success: false,
              error: err instanceof Error ? err : new Error(String(err)),
              duration: performance.now() - itemStart,
            };

            return itemResult;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Update progress
        const completed = results.length;
        setState((prev) => ({
          ...prev,
          completedCount: completed,
          progress: (completed / items.length) * 100,
        }));
      }

      const totalDuration = performance.now() - startTime;
      const successful = results
        .filter((r) => r.success && r.data !== undefined)
        .map((r) => r.data as TOutput);
      const failed = results
        .filter((r) => !r.success)
        .map((r) => ({ index: r.index, error: r.error! }));

      const finalResult: ParallelBatchResult<TOutput> = {
        results,
        successful,
        failed,
        totalDuration,
        successRate: successful.length / items.length,
      };

      setState({
        result: finalResult,
        loading: false,
        progress: 100,
        completedCount: items.length,
        totalCount: items.length,
      });

      return finalResult;
    },
    [kit, functionName, options.concurrency, options.computeOptions]
  );

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      loading: false,
    }));
  }, []);

  const reset = useCallback(() => {
    cancel();
    setState({
      result: null,
      loading: false,
      progress: 0,
      completedCount: 0,
      totalCount: 0,
    });
  }, [cancel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return {
    ...state,
    run,
    cancel,
    reset,
  };
}

// ============================================================================
// Exports
// ============================================================================

export type {
  ComputeKitOptions,
  ComputeOptions,
  ComputeProgress,
  PoolStats,
} from '@computekit/core';

export { ComputeKit } from '@computekit/core';

// Pipeline types are exported from interface declarations above
