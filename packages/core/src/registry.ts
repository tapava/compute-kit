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
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ComputeFunctionRegistry {}

/**
 * Helper type to get all registered function names.
 * If no functions are registered, falls back to string.
 */
export type RegisteredFunctionName = keyof ComputeFunctionRegistry extends never
  ? string
  : keyof ComputeFunctionRegistry;

/**
 * Helper type to check if the registry has any entries.
 */
export type HasRegisteredFunctions = keyof ComputeFunctionRegistry extends never
  ? false
  : true;

/**
 * Get the input type for a registered function.
 * Falls back to TFallback if the function is not registered.
 */
export type FunctionInput<
  TName extends string,
  TFallback = unknown,
> = TName extends keyof ComputeFunctionRegistry
  ? ComputeFunctionRegistry[TName]['input']
  : TFallback;

/**
 * Get the output type for a registered function.
 * Falls back to TFallback if the function is not registered.
 */
export type FunctionOutput<
  TName extends string,
  TFallback = unknown,
> = TName extends keyof ComputeFunctionRegistry
  ? ComputeFunctionRegistry[TName]['output']
  : TFallback;

/**
 * Type for a compute function based on registry or explicit types.
 */
export type ComputeFn<TInput, TOutput> = (input: TInput) => TOutput | Promise<TOutput>;

/**
 * Infer the compute function type for a registered function name.
 */
export type InferComputeFn<TName extends string> =
  TName extends keyof ComputeFunctionRegistry
    ? ComputeFn<
        ComputeFunctionRegistry[TName]['input'],
        ComputeFunctionRegistry[TName]['output']
      >
    : ComputeFn<unknown, unknown>;

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
export type DefineFunction<TInput, TOutput> = {
  input: TInput;
  output: TOutput;
};

/**
 * Helper type for typing the register method.
 * Provides proper type inference based on whether the function is in the registry.
 */
export type RegisterFn<
  TName extends string,
  TInput,
  TOutput,
> = TName extends keyof ComputeFunctionRegistry
  ? ComputeFn<
      ComputeFunctionRegistry[TName]['input'],
      ComputeFunctionRegistry[TName]['output']
    >
  : ComputeFn<TInput, TOutput>;
