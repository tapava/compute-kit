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
    // Fetch from public folder - works in local dev, production, and StackBlitz
    const res = await fetch('/compute.wasm');
    if (!res.ok) {
      throw new Error(`Failed to fetch WASM: ${res.status} ${res.statusText}`);
    }

    const buffer = await res.arrayBuffer();
    // Verify WASM magic number (0x00 0x61 0x73 0x6D = "\0asm")
    const magic = new Uint8Array(buffer.slice(0, 4));
    if (
      magic[0] !== 0x00 ||
      magic[1] !== 0x61 ||
      magic[2] !== 0x73 ||
      magic[3] !== 0x6d
    ) {
      throw new Error(
        `Invalid WASM file (got ${Array.from(magic)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(' ')})`
      );
    }

    const module = await WebAssembly.compile(buffer);
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
