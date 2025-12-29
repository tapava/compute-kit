/* eslint-disable @typescript-eslint/no-explicit-any */

interface WasmImports {
  env?: Record<string, unknown>;
}

export interface WasmExports {
  memory: WebAssembly.Memory;
  __new?: (size: number, id: number) => number;
  __pin?: (ptr: number) => number;
  __unpin?: (ptr: number) => void;
  __collect?: () => void;
  __rtti_base?: number;
  getBufferPtr: () => number;
  blurImage: (width: number, height: number, passes: number) => void;
}

let cachedExports: WasmExports | null = null;
let loadingPromise: Promise<WasmExports> | null = null;

async function instantiate(
  module: WebAssembly.Module,
  imports: WasmImports = {}
): Promise<WasmExports> {
  const memory = new WebAssembly.Memory({ initial: 256 });

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

  const adaptedImports = {
    env: Object.assign(Object.create(globalThis), imports.env || {}, {
      memory,
      abort(message: number, fileName: number, lineNumber: number, columnNumber: number) {
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

  const adaptedExports: WasmExports = Object.setPrototypeOf(
    {
      getBufferPtr(): number {
        return exports.getBufferPtr() >>> 0;
      },
    },
    exports
  );

  return adaptedExports;
}

/**
 * Load and initialize the WASM module.
 * Returns cached instance if already loaded.
 */
export async function loadWasm(): Promise<WasmExports> {
  if (cachedExports) {
    return cachedExports;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    // Use relative path that works in both local dev and StackBlitz
    // Try multiple paths to handle different environments
    const possiblePaths = [
      new URL('/compute.wasm', import.meta.url).href,
      new URL('../public/compute.wasm', import.meta.url).href,
      '/compute.wasm',
    ];

    let response: Response | null = null;
    let lastError: Error | null = null;

    for (const wasmUrl of possiblePaths) {
      try {
        const res = await fetch(wasmUrl);
        // Check if we got a valid WASM response (not an HTML fallback)
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && !contentType.includes('text/html')) {
          response = res;
          break;
        }
      } catch (e) {
        lastError = e as Error;
      }
    }

    if (!response) {
      throw new Error(
        `Failed to fetch WASM from any path. Last error: ${lastError?.message}`
      );
    }

    const module = await WebAssembly.compileStreaming(
      // Create a new Response with the correct MIME type if needed
      response.headers.get('content-type')?.includes('application/wasm')
        ? response
        : new Response(await response.arrayBuffer(), {
            headers: { 'Content-Type': 'application/wasm' },
          })
    );
    cachedExports = await instantiate(module, {});
    return cachedExports;
  })();

  return loadingPromise;
}

// For convenience, also export a getter that throws if not loaded
export function getWasm(): WasmExports {
  if (!cachedExports) {
    throw new Error('WASM not loaded. Call loadWasm() first.');
  }
  return cachedExports;
}
