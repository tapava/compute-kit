/** Exported memory */
export declare const memory: WebAssembly.Memory;
/**
 * compute/sum/sum
 * @param arr `~lib/typedarray/Int32Array`
 * @returns `i32`
 */
export declare function sum(arr: Int32Array): number;
/**
 * compute/sum/sumFloat
 * @param arr `~lib/typedarray/Float64Array`
 * @returns `f64`
 */
export declare function sumFloat(arr: Float64Array): number;
/**
 * compute/sum/average
 * @param arr `~lib/typedarray/Int32Array`
 * @returns `f64`
 */
export declare function average(arr: Int32Array): number;
/**
 * compute/fibonacci/fibonacci
 * @param n `i32`
 * @returns `i64`
 */
export declare function fibonacci(n: number): bigint;
/**
 * compute/fibonacci/fibonacciSequence
 * @param n `i32`
 * @returns `~lib/typedarray/Int64Array`
 */
export declare function fibonacciSequence(n: number): BigInt64Array;
/**
 * compute/fibonacci/isFibonacci
 * @param num `i64`
 * @returns `bool`
 */
export declare function isFibonacci(num: bigint): boolean;
/**
 * compute/mandelbrot/mandelbrot
 * @param width `i32`
 * @param height `i32`
 * @param zoom `f64`
 * @param panX `f64`
 * @param panY `f64`
 * @param maxIter `i32`
 * @returns `~lib/typedarray/Uint32Array`
 */
export declare function mandelbrot(width: number, height: number, zoom: number, panX: number, panY: number, maxIter: number): Uint32Array;
/**
 * compute/mandelbrot/julia
 * @param width `i32`
 * @param height `i32`
 * @param cRe `f64`
 * @param cIm `f64`
 * @param zoom `f64`
 * @param maxIter `i32`
 * @returns `~lib/typedarray/Uint32Array`
 */
export declare function julia(width: number, height: number, cRe: number, cIm: number, zoom: number, maxIter: number): Uint32Array;
/**
 * compute/matrix/matrixMultiply
 * @param a `~lib/typedarray/Float64Array`
 * @param b `~lib/typedarray/Float64Array`
 * @param aRows `i32`
 * @param aCols `i32`
 * @param bCols `i32`
 * @returns `~lib/typedarray/Float64Array`
 */
export declare function matrixMultiply(a: Float64Array, b: Float64Array, aRows: number, aCols: number, bCols: number): Float64Array;
/**
 * compute/matrix/matrixTranspose
 * @param matrix `~lib/typedarray/Float64Array`
 * @param rows `i32`
 * @param cols `i32`
 * @returns `~lib/typedarray/Float64Array`
 */
export declare function matrixTranspose(matrix: Float64Array, rows: number, cols: number): Float64Array;
/**
 * compute/matrix/matrixAdd
 * @param a `~lib/typedarray/Float64Array`
 * @param b `~lib/typedarray/Float64Array`
 * @returns `~lib/typedarray/Float64Array`
 */
export declare function matrixAdd(a: Float64Array, b: Float64Array): Float64Array;
/**
 * compute/matrix/matrixScale
 * @param matrix `~lib/typedarray/Float64Array`
 * @param scalar `f64`
 * @returns `~lib/typedarray/Float64Array`
 */
export declare function matrixScale(matrix: Float64Array, scalar: number): Float64Array;
/**
 * compute/matrix/dotProduct
 * @param a `~lib/typedarray/Float64Array`
 * @param b `~lib/typedarray/Float64Array`
 * @returns `f64`
 */
export declare function dotProduct(a: Float64Array, b: Float64Array): number;
/**
 * compute/matrix/vectorMagnitude
 * @param v `~lib/typedarray/Float64Array`
 * @returns `f64`
 */
export declare function vectorMagnitude(v: Float64Array): number;
/**
 * compute/matrix/vectorNormalize
 * @param v `~lib/typedarray/Float64Array`
 * @returns `~lib/typedarray/Float64Array`
 */
export declare function vectorNormalize(v: Float64Array): Float64Array;
/**
 * compute/blur/getBufferPtr
 * @returns `usize`
 */
export declare function getBufferPtr(): number;
/**
 * compute/blur/blurImage
 * @param width `i32`
 * @param height `i32`
 * @param passes `i32`
 */
export declare function blurImage(width: number, height: number, passes: number): void;
