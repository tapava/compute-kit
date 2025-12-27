/**
 * ComputeKit React Query Integration
 * Lightweight TanStack Query bindings for ComputeKit
 */

import { useMemo, createContext, useContext, type ReactNode } from 'react';
import {
  useQuery,
  useMutation,
  type UseQueryOptions,
  type UseMutationOptions,
  type QueryKey,
} from '@tanstack/react-query';
import {
  ComputeKit,
  type ComputeKitOptions,
  type ComputeOptions,
} from '@computekit/core';

// ============================================================================
// Context
// ============================================================================

const ComputeKitContext = createContext<ComputeKit | null>(null);

export interface ComputeKitProviderProps {
  /** ComputeKit options */
  options?: ComputeKitOptions;
  /** Custom ComputeKit instance (if you want to share with @computekit/react) */
  instance?: ComputeKit;
  /** Children */
  children: ReactNode;
}

/**
 * Provider component for ComputeKit with React Query
 *
 * @example
 * ```tsx
 * import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
 * import { ComputeKitProvider } from '@computekit/react-query';
 *
 * const queryClient = new QueryClient();
 *
 * function App() {
 *   return (
 *     <QueryClientProvider client={queryClient}>
 *       <ComputeKitProvider options={{ maxWorkers: 4 }}>
 *         <MyApp />
 *       </ComputeKitProvider>
 *     </QueryClientProvider>
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
// Query Hook
// ============================================================================

export interface UseComputeQueryOptions<TOutput> extends Omit<
  UseQueryOptions<TOutput, Error, TOutput, QueryKey>,
  'queryKey' | 'queryFn'
> {
  /** ComputeKit run options */
  computeOptions?: ComputeOptions;
}

/**
 * Execute a registered compute function with React Query
 *
 * This hook integrates ComputeKit with TanStack Query, giving you:
 * - Automatic caching
 * - Background refetching
 * - Stale-while-revalidate
 * - Retry logic
 * - DevTools support
 *
 * @example
 * ```tsx
 * // First, register the function
 * kit.register('fibonacci', (n: number) => {
 *   let a = 0, b = 1;
 *   for (let i = 2; i <= n; i++) [a, b] = [b, a + b];
 *   return b;
 * });
 *
 * // Then use it in your component
 * function Fibonacci({ n }: { n: number }) {
 *   const { data, isLoading, error } = useComputeQuery('fibonacci', n);
 *
 *   if (isLoading) return <div>Computing...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   return <div>Result: {data}</div>;
 * }
 * ```
 */
export function useComputeQuery<TInput, TOutput>(
  /** Name of the registered compute function */
  name: string,
  /** Input to pass to the function */
  input: TInput,
  /** React Query and ComputeKit options */
  options?: UseComputeQueryOptions<TOutput>
) {
  const kit = useComputeKit();
  const { computeOptions, ...queryOptions } = options ?? {};

  return useQuery<TOutput, Error>({
    queryKey: ['compute', name, input] as const,
    queryFn: async () => {
      const result = await kit.run<TInput, TOutput>(name, input, computeOptions);
      return result;
    },
    ...queryOptions,
  });
}

// ============================================================================
// Mutation Hook
// ============================================================================

export interface UseComputeMutationOptions<TInput, TOutput> extends Omit<
  UseMutationOptions<TOutput, Error, TInput>,
  'mutationFn'
> {
  /** ComputeKit run options */
  computeOptions?: ComputeOptions;
}

/**
 * Execute a registered compute function as a mutation
 *
 * Use this when you want to trigger computation manually (e.g., on button click)
 * rather than automatically on mount/input change.
 *
 * @example
 * ```tsx
 * function ImageProcessor() {
 *   const { mutate, data, isPending, error } = useComputeMutation<ImageData, ImageData>('blur');
 *
 *   return (
 *     <div>
 *       <button onClick={() => mutate(imageData)} disabled={isPending}>
 *         {isPending ? 'Processing...' : 'Apply Blur'}
 *       </button>
 *       {data && <img src={data.url} />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useComputeMutation<TInput, TOutput>(
  /** Name of the registered compute function */
  name: string,
  /** React Query and ComputeKit options */
  options?: UseComputeMutationOptions<TInput, TOutput>
) {
  const kit = useComputeKit();
  const { computeOptions, ...mutationOptions } = options ?? {};

  return useMutation<TOutput, Error, TInput>({
    mutationFn: async (input: TInput) => {
      const result = await kit.run<TInput, TOutput>(name, input, computeOptions);
      return result;
    },
    ...mutationOptions,
  });
}

// ============================================================================
// Factory for standalone usage (without context)
// ============================================================================

/**
 * Create compute query/mutation hooks bound to a specific ComputeKit instance
 *
 * Use this if you don't want to use the context provider, or need multiple
 * ComputeKit instances.
 *
 * @example
 * ```tsx
 * import { ComputeKit } from '@computekit/core';
 * import { createComputeHooks } from '@computekit/react-query';
 *
 * const kit = new ComputeKit();
 * kit.register('fibonacci', (n: number) => { ... });
 *
 * const { useQuery, useMutation } = createComputeHooks(kit);
 *
 * function MyComponent() {
 *   const { data } = useQuery('fibonacci', 50);
 *   return <div>{data}</div>;
 * }
 * ```
 */
export function createComputeHooks(kit: ComputeKit) {
  return {
    /**
     * Query hook bound to this ComputeKit instance
     */
    useQuery: <TInput, TOutput>(
      name: string,
      input: TInput,
      options?: Omit<UseComputeQueryOptions<TOutput>, 'computeOptions'> & {
        computeOptions?: ComputeOptions;
      }
    ) => {
      const { computeOptions, ...queryOptions } = options ?? {};

      return useQuery<TOutput, Error>({
        queryKey: ['compute', name, input] as const,
        queryFn: async () => kit.run<TInput, TOutput>(name, input, computeOptions),
        ...queryOptions,
      });
    },

    /**
     * Mutation hook bound to this ComputeKit instance
     */
    useMutation: <TInput, TOutput>(
      name: string,
      options?: Omit<UseComputeMutationOptions<TInput, TOutput>, 'computeOptions'> & {
        computeOptions?: ComputeOptions;
      }
    ) => {
      const { computeOptions, ...mutationOptions } = options ?? {};

      return useMutation<TOutput, Error, TInput>({
        mutationFn: async (input: TInput) =>
          kit.run<TInput, TOutput>(name, input, computeOptions),
        ...mutationOptions,
      });
    },

    /** The ComputeKit instance */
    kit,
  };
}

// ============================================================================
// Exports
// ============================================================================

export type { ComputeKitOptions, ComputeOptions } from '@computekit/core';
export { ComputeKit } from '@computekit/core';
