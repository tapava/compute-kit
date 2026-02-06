/**
 * ComputeKit WASM Loader
 * Utilities for loading and managing WebAssembly modules
 */

import type { WasmModuleConfig } from './types';
import { createLogger, LRUCache } from './utils';

const logger = createLogger('ComputeKit:WASM');

/** Cached WASM modules */
const moduleCache = new LRUCache<string, WebAssembly.Module>(10);

/** Cached WASM instances */
const instanceCache = new LRUCache<string, WebAssembly.Instance>(10);

/**
 * Load a WASM module from various sources
 */
export async function loadWasmModule(
  source: string | ArrayBuffer | Uint8Array
): Promise<WebAssembly.Module> {
  // Check cache for string sources
  if (typeof source === 'string') {
    const cached = moduleCache.get(source);
    if (cached) {
      logger.debug('Using cached WASM module:', source);
      return cached;
    }
  }

  let bytes: ArrayBuffer | Uint8Array;

  if (typeof source === 'string') {
    if (source.startsWith('data:')) {
      // Base64 encoded WASM
      const base64 = source.split(',')[1];
      bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    } else {
      // URL to WASM file
      logger.debug('Fetching WASM from:', source);
      const response = await fetch(source);

      if (!response.ok) {
        throw new Error(`Failed to fetch WASM: ${response.statusText}`);
      }

      // Use streaming compilation if available
      if (WebAssembly.compileStreaming) {
        const module = await WebAssembly.compileStreaming(response);
        moduleCache.set(source, module);
        return module;
      }

      bytes = await response.arrayBuffer();
    }
  } else {
    bytes = source;
  }

  // Compile the module
  const module = await WebAssembly.compile(bytes as BufferSource);

  if (typeof source === 'string') {
    moduleCache.set(source, module);
  }

  return module;
}

/**
 * Instantiate a WASM module with imports
 */
export async function instantiateWasm(
  module: WebAssembly.Module,
  imports: WebAssembly.Imports = {}
): Promise<WebAssembly.Instance> {
  return WebAssembly.instantiate(module, imports);
}

/**
 * Load and instantiate a WASM module in one step
 */
export async function loadAndInstantiate(
  config: WasmModuleConfig
): Promise<{ module: WebAssembly.Module; instance: WebAssembly.Instance }> {
  const { source, imports = {}, memory } = config;

  // Create memory if specified
  const wasmImports: WebAssembly.Imports = { ...imports };
  if (memory) {
    wasmImports.env = {
      ...wasmImports.env,
      memory: new WebAssembly.Memory({
        initial: memory.initial,
        maximum: memory.maximum,
        shared: memory.shared,
      }),
    };
  }

  const module = await loadWasmModule(source);
  const instance = await instantiateWasm(module, wasmImports);

  return { module, instance };
}

/**
 * Create a WASM module from AssemblyScript-compiled bytes
 */
export async function loadAssemblyScript(
  source: string | ArrayBuffer,
  imports: WebAssembly.Imports = {}
): Promise<{
  module: WebAssembly.Module;
  instance: WebAssembly.Instance;
  exports: Record<string, unknown>;
}> {
  // Default AssemblyScript imports
  const defaultImports: WebAssembly.Imports = {
    env: {
      abort: (_message: number, fileName: number, line: number, column: number) => {
        console.error(`AssemblyScript abort at ${fileName}:${line}:${column}`);
      },
      seed: () => Date.now(),
      ...((imports.env as object) || {}),
    },
    ...imports,
  };

  const { module, instance } = await loadAndInstantiate({
    source,
    imports: defaultImports,
  });

  return {
    module,
    instance,
    exports: instance.exports as Record<string, unknown>,
  };
}

/**
 * Helper to wrap WASM exports for easier use
 */
export function wrapWasmExports<T extends Record<string, unknown>>(
  instance: WebAssembly.Instance
): T {
  return instance.exports as T;
}

/**
 * Create a typed array view into WASM memory
 */
export function getMemoryView<T extends ArrayBufferView>(
  memory: WebAssembly.Memory,
  ArrayType: new (buffer: ArrayBuffer, byteOffset?: number, length?: number) => T,
  offset: number = 0,
  length?: number
): T {
  return new ArrayType(memory.buffer, offset, length);
}

/**
 * Copy data to WASM memory
 */
export function copyToWasmMemory(
  memory: WebAssembly.Memory,
  data: ArrayBufferView,
  offset: number
): void {
  const view = new Uint8Array(memory.buffer);
  const source = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  view.set(source, offset);
}

/**
 * Copy data from WASM memory
 */
export function copyFromWasmMemory(
  memory: WebAssembly.Memory,
  offset: number,
  length: number
): Uint8Array {
  const view = new Uint8Array(memory.buffer, offset, length);
  return new Uint8Array(view); // Copy to detach from WASM memory
}

/**
 * Clear module caches
 */
export function clearWasmCache(): void {
  moduleCache.clear();
  instanceCache.clear();
}

/**
 * Get cache statistics
 */
export function getWasmCacheStats(): { modules: number; instances: number } {
  return {
    modules: moduleCache.size,
    instances: instanceCache.size,
  };
}
