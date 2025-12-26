/* eslint-disable @typescript-eslint/no-explicit-any */

interface WasmImports {
  env?: Record<string, unknown>;
}

interface WasmExports {
  memory: WebAssembly.Memory;
  __new?: (size: number, id: number) => number;
  __pin?: (ptr: number) => number;
  __unpin?: (ptr: number) => void;
  __collect?: () => void;
  __rtti_base?: number;
  getBufferPtr: () => number;
  blurImage: (width: number, height: number, passes: number) => void;
}

async function instantiate(
  module: WebAssembly.Module,
  imports: WasmImports = {}
): Promise<WasmExports> {
  const adaptedImports = {
    env: Object.assign(Object.create(globalThis), imports.env || {}, {
      abort(message: number, fileName: number, lineNumber: number, columnNumber: number) {
        // ~lib/builtins/abort(~lib/string/String | null?, ~lib/string/String | null?, u32?, u32?) => void
        const msg = __liftString(message >>> 0);
        const file = __liftString(fileName >>> 0);
        const line = lineNumber >>> 0;
        const col = columnNumber >>> 0;
        throw Error(`${msg} in ${file}:${line}:${col}`);
      },
    }),
  };

  const instance = await WebAssembly.instantiate(module, adaptedImports);
  const exports = instance.exports as unknown as WasmExports & Record<string, any>;
  const memory = exports.memory || (imports.env as any)?.memory;

  const adaptedExports: WasmExports = Object.setPrototypeOf(
    {
      getBufferPtr(): number {
        return exports.getBufferPtr() >>> 0;
      },
    },
    exports
  );

  function __liftString(pointer: number): string | null {
    if (!pointer) return null;
    const end = (pointer + new Uint32Array(memory.buffer)[(pointer - 4) >>> 2]) >>> 1,
      memoryU16 = new Uint16Array(memory.buffer);
    let start = pointer >>> 1,
      string = '';
    while (end - start > 1024)
      string += String.fromCharCode(...memoryU16.subarray(start, (start += 1024)));
    return string + String.fromCharCode(...memoryU16.subarray(start, end));
  }

  return adaptedExports;
}

const wasmExports = await (async (url: URL): Promise<WasmExports> =>
  instantiate(
    await (async () => {
      const isNodeOrBun =
        typeof process != 'undefined' &&
        process.versions != null &&
        (process.versions.node != null || process.versions.bun != null);
      if (isNodeOrBun) {
        return globalThis.WebAssembly.compile(
          await (await import('node:fs/promises')).readFile(url)
        );
      } else {
        return await globalThis.WebAssembly.compileStreaming(globalThis.fetch(url));
      }
    })(),
    {}
  ))(new URL('/compute.wasm', import.meta.url));

export const memory = wasmExports.memory;
export const __new = wasmExports.__new;
export const __pin = wasmExports.__pin;
export const __unpin = wasmExports.__unpin;
export const __collect = wasmExports.__collect;
export const __rtti_base = wasmExports.__rtti_base;
export const getBufferPtr = wasmExports.getBufferPtr;
export const blurImage = wasmExports.blurImage;
