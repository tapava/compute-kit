/**
 * ComputeKit React Bindings
 * React hooks and utilities for ComputeKit
 */

import {
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
}: ComputeKitProviderProps): JSX.Element {
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

  const [state, setState] = useState<UseComputeState<TOutput>>({
    data: null,
    loading: false,
    error: null,
    progress: null,
  });

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
      progress: null,
    });
  }, []);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const run = useCallback(
    async (input: TInput, runOptions?: ComputeOptions) => {
      // Cancel any ongoing computation
      cancel();

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
        }));
      } else {
        setState((prev) => ({ ...prev, loading: true }));
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
          });
        }
      } catch (err) {
        if (!abortController.signal.aborted) {
          setState({
            data: null,
            loading: false,
            error: err instanceof Error ? err : new Error(String(err)),
            progress: null,
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
// Exports
// ============================================================================

export type {
  ComputeKitOptions,
  ComputeOptions,
  ComputeProgress,
  PoolStats,
} from '@computekit/core';

export { ComputeKit } from '@computekit/core';
