import { d as ComputeProgress } from './types-BOEbxzLO.cjs';

/**
 * ComputeKit Worker Runtime
 * Code that runs inside Web Workers
 */

/** Registry of compute functions available in the worker */
declare const functionRegistry: Map<string, Function>;
/**
 * Report progress from within a compute function
 */
declare function reportProgress(progress: Partial<ComputeProgress>): void;
/**
 * Register a compute function in the worker
 */
declare function registerFunction(name: string, fn: Function): void;
/**
 * Initialize the worker runtime
 */
declare function initWorkerRuntime(): void;

export { functionRegistry, initWorkerRuntime, registerFunction, reportProgress };
