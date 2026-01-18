async function instantiate(module, imports = {}) {
  const adaptedImports = {
    env: Object.assign(Object.create(globalThis), imports.env || {}, {
      abort(message, fileName, lineNumber, columnNumber) {
        // ~lib/builtins/abort(~lib/string/String | null?, ~lib/string/String | null?, u32?, u32?) => void
        message = __liftString(message >>> 0);
        fileName = __liftString(fileName >>> 0);
        lineNumber = lineNumber >>> 0;
        columnNumber = columnNumber >>> 0;
        (() => {
          // @external.js
          throw Error(`${message} in ${fileName}:${lineNumber}:${columnNumber}`);
        })();
      },
    }),
  };
  const { exports } = await WebAssembly.instantiate(module, adaptedImports);
  const memory = exports.memory || imports.env.memory;
  const adaptedExports = Object.setPrototypeOf({
    sum(arr) {
      // compute/sum/sum(~lib/typedarray/Int32Array) => i32
      arr = __lowerTypedArray(Int32Array, 4, 2, arr) || __notnull();
      return exports.sum(arr);
    },
    sumFloat(arr) {
      // compute/sum/sumFloat(~lib/typedarray/Float64Array) => f64
      arr = __lowerTypedArray(Float64Array, 5, 3, arr) || __notnull();
      return exports.sumFloat(arr);
    },
    average(arr) {
      // compute/sum/average(~lib/typedarray/Int32Array) => f64
      arr = __lowerTypedArray(Int32Array, 4, 2, arr) || __notnull();
      return exports.average(arr);
    },
    fibonacciSequence(n) {
      // compute/fibonacci/fibonacciSequence(i32) => ~lib/typedarray/Int64Array
      return __liftTypedArray(BigInt64Array, exports.fibonacciSequence(n) >>> 0);
    },
    isFibonacci(num) {
      // compute/fibonacci/isFibonacci(i64) => bool
      num = num || 0n;
      return exports.isFibonacci(num) != 0;
    },
    mandelbrot(width, height, zoom, panX, panY, maxIter) {
      // compute/mandelbrot/mandelbrot(i32, i32, f64, f64, f64, i32) => ~lib/typedarray/Uint32Array
      return __liftTypedArray(Uint32Array, exports.mandelbrot(width, height, zoom, panX, panY, maxIter) >>> 0);
    },
    julia(width, height, cRe, cIm, zoom, maxIter) {
      // compute/mandelbrot/julia(i32, i32, f64, f64, f64, i32) => ~lib/typedarray/Uint32Array
      return __liftTypedArray(Uint32Array, exports.julia(width, height, cRe, cIm, zoom, maxIter) >>> 0);
    },
    matrixMultiply(a, b, aRows, aCols, bCols) {
      // compute/matrix/matrixMultiply(~lib/typedarray/Float64Array, ~lib/typedarray/Float64Array, i32, i32, i32) => ~lib/typedarray/Float64Array
      a = __retain(__lowerTypedArray(Float64Array, 5, 3, a) || __notnull());
      b = __lowerTypedArray(Float64Array, 5, 3, b) || __notnull();
      try {
        return __liftTypedArray(Float64Array, exports.matrixMultiply(a, b, aRows, aCols, bCols) >>> 0);
      } finally {
        __release(a);
      }
    },
    matrixTranspose(matrix, rows, cols) {
      // compute/matrix/matrixTranspose(~lib/typedarray/Float64Array, i32, i32) => ~lib/typedarray/Float64Array
      matrix = __lowerTypedArray(Float64Array, 5, 3, matrix) || __notnull();
      return __liftTypedArray(Float64Array, exports.matrixTranspose(matrix, rows, cols) >>> 0);
    },
    matrixAdd(a, b) {
      // compute/matrix/matrixAdd(~lib/typedarray/Float64Array, ~lib/typedarray/Float64Array) => ~lib/typedarray/Float64Array
      a = __retain(__lowerTypedArray(Float64Array, 5, 3, a) || __notnull());
      b = __lowerTypedArray(Float64Array, 5, 3, b) || __notnull();
      try {
        return __liftTypedArray(Float64Array, exports.matrixAdd(a, b) >>> 0);
      } finally {
        __release(a);
      }
    },
    matrixScale(matrix, scalar) {
      // compute/matrix/matrixScale(~lib/typedarray/Float64Array, f64) => ~lib/typedarray/Float64Array
      matrix = __lowerTypedArray(Float64Array, 5, 3, matrix) || __notnull();
      return __liftTypedArray(Float64Array, exports.matrixScale(matrix, scalar) >>> 0);
    },
    dotProduct(a, b) {
      // compute/matrix/dotProduct(~lib/typedarray/Float64Array, ~lib/typedarray/Float64Array) => f64
      a = __retain(__lowerTypedArray(Float64Array, 5, 3, a) || __notnull());
      b = __lowerTypedArray(Float64Array, 5, 3, b) || __notnull();
      try {
        return exports.dotProduct(a, b);
      } finally {
        __release(a);
      }
    },
    vectorMagnitude(v) {
      // compute/matrix/vectorMagnitude(~lib/typedarray/Float64Array) => f64
      v = __lowerTypedArray(Float64Array, 5, 3, v) || __notnull();
      return exports.vectorMagnitude(v);
    },
    vectorNormalize(v) {
      // compute/matrix/vectorNormalize(~lib/typedarray/Float64Array) => ~lib/typedarray/Float64Array
      v = __lowerTypedArray(Float64Array, 5, 3, v) || __notnull();
      return __liftTypedArray(Float64Array, exports.vectorNormalize(v) >>> 0);
    },
    getBufferPtr() {
      // compute/blur/getBufferPtr() => usize
      return exports.getBufferPtr() >>> 0;
    },
  }, exports);
  function __liftString(pointer) {
    if (!pointer) return null;
    const
      end = pointer + new Uint32Array(memory.buffer)[pointer - 4 >>> 2] >>> 1,
      memoryU16 = new Uint16Array(memory.buffer);
    let
      start = pointer >>> 1,
      string = "";
    while (end - start > 1024) string += String.fromCharCode(...memoryU16.subarray(start, start += 1024));
    return string + String.fromCharCode(...memoryU16.subarray(start, end));
  }
  function __liftTypedArray(constructor, pointer) {
    if (!pointer) return null;
    return new constructor(
      memory.buffer,
      __getU32(pointer + 4),
      __dataview.getUint32(pointer + 8, true) / constructor.BYTES_PER_ELEMENT
    ).slice();
  }
  function __lowerTypedArray(constructor, id, align, values) {
    if (values == null) return 0;
    const
      length = values.length,
      buffer = exports.__pin(exports.__new(length << align, 1)) >>> 0,
      header = exports.__new(12, id) >>> 0;
    __setU32(header + 0, buffer);
    __dataview.setUint32(header + 4, buffer, true);
    __dataview.setUint32(header + 8, length << align, true);
    new constructor(memory.buffer, buffer, length).set(values);
    exports.__unpin(buffer);
    return header;
  }
  const refcounts = new Map();
  function __retain(pointer) {
    if (pointer) {
      const refcount = refcounts.get(pointer);
      if (refcount) refcounts.set(pointer, refcount + 1);
      else refcounts.set(exports.__pin(pointer), 1);
    }
    return pointer;
  }
  function __release(pointer) {
    if (pointer) {
      const refcount = refcounts.get(pointer);
      if (refcount === 1) exports.__unpin(pointer), refcounts.delete(pointer);
      else if (refcount) refcounts.set(pointer, refcount - 1);
      else throw Error(`invalid refcount '${refcount}' for reference '${pointer}'`);
    }
  }
  function __notnull() {
    throw TypeError("value must not be null");
  }
  let __dataview = new DataView(memory.buffer);
  function __setU32(pointer, value) {
    try {
      __dataview.setUint32(pointer, value, true);
    } catch {
      __dataview = new DataView(memory.buffer);
      __dataview.setUint32(pointer, value, true);
    }
  }
  function __getU32(pointer) {
    try {
      return __dataview.getUint32(pointer, true);
    } catch {
      __dataview = new DataView(memory.buffer);
      return __dataview.getUint32(pointer, true);
    }
  }
  return adaptedExports;
}
export const {
  memory,
  sum,
  sumFloat,
  average,
  fibonacci,
  fibonacciSequence,
  isFibonacci,
  mandelbrot,
  julia,
  matrixMultiply,
  matrixTranspose,
  matrixAdd,
  matrixScale,
  dotProduct,
  vectorMagnitude,
  vectorNormalize,
  getBufferPtr,
  blurImage,
} = await (async url => instantiate(
  await (async () => {
    const isNodeOrBun = typeof process != "undefined" && process.versions != null && (process.versions.node != null || process.versions.bun != null);
    if (isNodeOrBun) { return globalThis.WebAssembly.compile(await (await import("node:fs/promises")).readFile(url)); }
    else { return await globalThis.WebAssembly.compileStreaming(globalThis.fetch(url)); }
  })(), {
  }
))(new URL("compute.wasm", import.meta.url));
