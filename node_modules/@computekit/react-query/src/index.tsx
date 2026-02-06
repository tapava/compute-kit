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
  type ComputeFunctionRegistry,
  type RegisteredFunctionName,
  type FunctionInput,
  type FunctionOutput,
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
 * // Basic usage with explicit types
 * const { data, isLoading } = useComputeQuery<number, number>('fibonacci', 50);
 *
 * // With typed registry - types are inferred!
 * // declare module '@computekit/core' {
 * //   interface ComputeFunctionRegistry {
 * //     fibonacci: { input: number; output: number };
 * //   }
 * // }
 * // const { data } = useComputeQuery('fibonacci', 50); // data is number
 * ```
 */
export function useComputeQuery<
  TName extends RegisteredFunctionName,
  TInput = FunctionInput<TName extends string ? TName : never>,
  TOutput = FunctionOutput<TName extends string ? TName : never>,
>(
  /** Name of the registered compute function */
  name: TName,
  /** Input to pass to the function */
  input: TName extends keyof ComputeFunctionRegistry
    ? ComputeFunctionRegistry[TName]['input']
    : TInput,
  /** React Query and ComputeKit options */
  options?: UseComputeQueryOptions<
    TName extends keyof ComputeFunctionRegistry
      ? ComputeFunctionRegistry[TName]['output']
      : TOutput
  >
) {
  type ActualOutput = TName extends keyof ComputeFunctionRegistry
    ? ComputeFunctionRegistry[TName]['output']
    : TOutput;

  const kit = useComputeKit();
  const { computeOptions, ...queryOptions } = options ?? {};

  return useQuery<ActualOutput, Error>({
    queryKey: ['compute', name, input] as const,
    queryFn: async () => {
      const result = await kit.run(name, input, computeOptions);
      return result as ActualOutput;
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
 * // Basic usage with explicit types
 * const { mutate, isPending } = useComputeMutation<ImageData, ImageData>('blur');
 *
 * // With typed registry - types are inferred!
 * // const { mutate } = useComputeMutation('blur');
 * // mutate(imageData); // input type enforced
 * ```
 */
export function useComputeMutation<
  TName extends RegisteredFunctionName,
  TInput = FunctionInput<TName extends string ? TName : never>,
  TOutput = FunctionOutput<TName extends string ? TName : never>,
>(
  /** Name of the registered compute function */
  name: TName,
  /** React Query and ComputeKit options */
  options?: UseComputeMutationOptions<
    TName extends keyof ComputeFunctionRegistry
      ? ComputeFunctionRegistry[TName]['input']
      : TInput,
    TName extends keyof ComputeFunctionRegistry
      ? ComputeFunctionRegistry[TName]['output']
      : TOutput
  >
) {
  type ActualInput = TName extends keyof ComputeFunctionRegistry
    ? ComputeFunctionRegistry[TName]['input']
    : TInput;
  type ActualOutput = TName extends keyof ComputeFunctionRegistry
    ? ComputeFunctionRegistry[TName]['output']
    : TOutput;

  const kit = useComputeKit();
  const { computeOptions, ...mutationOptions } = options ?? {};

  return useMutation<ActualOutput, Error, ActualInput>({
    mutationFn: async (input: ActualInput) => {
      const result = await kit.run(name, input as never, computeOptions);
      return result as ActualOutput;
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
 * // With typed registry - types are inferred!
 * const { data } = useQuery('fibonacci', 50); // data is number
 * ```
 */
export function createComputeHooks(kit: ComputeKit) {
  return {
    /**
     * Query hook bound to this ComputeKit instance
     */
    useQuery: <
      TName extends RegisteredFunctionName,
      TInput = FunctionInput<TName extends string ? TName : never>,
      TOutput = FunctionOutput<TName extends string ? TName : never>,
    >(
      name: TName,
      input: TName extends keyof ComputeFunctionRegistry
        ? ComputeFunctionRegistry[TName]['input']
        : TInput,
      options?: Omit<
        UseComputeQueryOptions<
          TName extends keyof ComputeFunctionRegistry
            ? ComputeFunctionRegistry[TName]['output']
            : TOutput
        >,
        'computeOptions'
      > & {
        computeOptions?: ComputeOptions;
      }
    ) => {
      type ActualOutput = TName extends keyof ComputeFunctionRegistry
        ? ComputeFunctionRegistry[TName]['output']
        : TOutput;

      const { computeOptions, ...queryOptions } = options ?? {};

      return useQuery<ActualOutput, Error>({
        queryKey: ['compute', name, input] as const,
        queryFn: async () => {
          const result = await kit.run(name, input, computeOptions);
          return result as ActualOutput;
        },
        ...queryOptions,
      });
    },

    /**
     * Mutation hook bound to this ComputeKit instance
     */
    useMutation: <
      TName extends RegisteredFunctionName,
      TInput = FunctionInput<TName extends string ? TName : never>,
      TOutput = FunctionOutput<TName extends string ? TName : never>,
    >(
      name: TName,
      options?: Omit<
        UseComputeMutationOptions<
          TName extends keyof ComputeFunctionRegistry
            ? ComputeFunctionRegistry[TName]['input']
            : TInput,
          TName extends keyof ComputeFunctionRegistry
            ? ComputeFunctionRegistry[TName]['output']
            : TOutput
        >,
        'computeOptions'
      > & {
        computeOptions?: ComputeOptions;
      }
    ) => {
      type ActualInput = TName extends keyof ComputeFunctionRegistry
        ? ComputeFunctionRegistry[TName]['input']
        : TInput;
      type ActualOutput = TName extends keyof ComputeFunctionRegistry
        ? ComputeFunctionRegistry[TName]['output']
        : TOutput;

      const { computeOptions, ...mutationOptions } = options ?? {};

      return useMutation<ActualOutput, Error, ActualInput>({
        mutationFn: async (input: ActualInput) => {
          const result = await kit.run(name, input as never, computeOptions);
          return result as ActualOutput;
        },
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

export type {
  ComputeKitOptions,
  ComputeOptions,
  // Typed registry exports
  ComputeFunctionRegistry,
  RegisteredFunctionName,
  FunctionInput,
  FunctionOutput,
} from '@computekit/core';
export { ComputeKit } from '@computekit/core';
