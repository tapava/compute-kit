import * as _tanstack_react_query from '@tanstack/react-query';
import { UseQueryOptions, QueryKey, UseMutationOptions } from '@tanstack/react-query';
import * as _tanstack_query_core from '@tanstack/query-core';
import { ReactNode } from 'react';
import { ComputeKitOptions, ComputeKit, ComputeOptions, RegisteredFunctionName, FunctionInput, FunctionOutput, ComputeFunctionRegistry } from '@computekit/core';
export { ComputeFunctionRegistry, ComputeKit, ComputeKitOptions, ComputeOptions, FunctionInput, FunctionOutput, RegisteredFunctionName } from '@computekit/core';

interface ComputeKitProviderProps {
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
declare function ComputeKitProvider({ options, instance, children, }: ComputeKitProviderProps): React.ReactElement;
/**
 * Get the ComputeKit instance from context
 */
declare function useComputeKit(): ComputeKit;
interface UseComputeQueryOptions<TOutput> extends Omit<UseQueryOptions<TOutput, Error, TOutput, QueryKey>, 'queryKey' | 'queryFn'> {
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
declare function useComputeQuery<TName extends RegisteredFunctionName, TInput = FunctionInput<TName extends string ? TName : never>, TOutput = FunctionOutput<TName extends string ? TName : never>>(
/** Name of the registered compute function */
name: TName, 
/** Input to pass to the function */
input: TName extends keyof ComputeFunctionRegistry ? ComputeFunctionRegistry[TName]['input'] : TInput, 
/** React Query and ComputeKit options */
options?: UseComputeQueryOptions<TName extends keyof ComputeFunctionRegistry ? ComputeFunctionRegistry[TName]['output'] : TOutput>): _tanstack_react_query.UseQueryResult<_tanstack_query_core.NoInfer<TName extends never ? ComputeFunctionRegistry[TName]["output"] : TOutput>, Error>;
interface UseComputeMutationOptions<TInput, TOutput> extends Omit<UseMutationOptions<TOutput, Error, TInput>, 'mutationFn'> {
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
declare function useComputeMutation<TName extends RegisteredFunctionName, TInput = FunctionInput<TName extends string ? TName : never>, TOutput = FunctionOutput<TName extends string ? TName : never>>(
/** Name of the registered compute function */
name: TName, 
/** React Query and ComputeKit options */
options?: UseComputeMutationOptions<TName extends keyof ComputeFunctionRegistry ? ComputeFunctionRegistry[TName]['input'] : TInput, TName extends keyof ComputeFunctionRegistry ? ComputeFunctionRegistry[TName]['output'] : TOutput>): _tanstack_react_query.UseMutationResult<TName extends never ? ComputeFunctionRegistry[TName]["output"] : TOutput, Error, TName extends never ? ComputeFunctionRegistry[TName]["input"] : TInput, unknown>;
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
declare function createComputeHooks(kit: ComputeKit): {
    /**
     * Query hook bound to this ComputeKit instance
     */
    useQuery: <TName extends RegisteredFunctionName, TInput = FunctionInput<TName extends string ? TName : never>, TOutput = FunctionOutput<TName extends string ? TName : never>>(name: TName, input: TName extends keyof ComputeFunctionRegistry ? ComputeFunctionRegistry[TName]["input"] : TInput, options?: Omit<UseComputeQueryOptions<TName extends keyof ComputeFunctionRegistry ? ComputeFunctionRegistry[TName]["output"] : TOutput>, "computeOptions"> & {
        computeOptions?: ComputeOptions;
    }) => _tanstack_react_query.UseQueryResult<_tanstack_query_core.NoInfer<TName extends never ? ComputeFunctionRegistry[TName]["output"] : TOutput>, Error>;
    /**
     * Mutation hook bound to this ComputeKit instance
     */
    useMutation: <TName extends RegisteredFunctionName, TInput = FunctionInput<TName extends string ? TName : never>, TOutput = FunctionOutput<TName extends string ? TName : never>>(name: TName, options?: Omit<UseComputeMutationOptions<TName extends keyof ComputeFunctionRegistry ? ComputeFunctionRegistry[TName]["input"] : TInput, TName extends keyof ComputeFunctionRegistry ? ComputeFunctionRegistry[TName]["output"] : TOutput>, "computeOptions"> & {
        computeOptions?: ComputeOptions;
    }) => _tanstack_react_query.UseMutationResult<TName extends never ? ComputeFunctionRegistry[TName]["output"] : TOutput, Error, TName extends never ? ComputeFunctionRegistry[TName]["input"] : TInput, unknown>;
    /** The ComputeKit instance */
    kit: ComputeKit;
};

export { ComputeKitProvider, type ComputeKitProviderProps, type UseComputeMutationOptions, type UseComputeQueryOptions, createComputeHooks, useComputeKit, useComputeMutation, useComputeQuery };
