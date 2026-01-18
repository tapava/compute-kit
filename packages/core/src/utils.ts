/**
 * ComputeKit Utilities
 * Helper functions for the WASM + Worker toolkit
 */

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Check if running in a Web Worker context
 */
export function isWorkerContext(): boolean {
  return (
    typeof self !== 'undefined' &&
    typeof Window === 'undefined' &&
    typeof self.postMessage === 'function'
  );
}

/**
 * Check if running in a browser context
 */
export function isBrowserContext(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Check if SharedArrayBuffer is available
 */
export function isSharedArrayBufferAvailable(): boolean {
  try {
    return typeof SharedArrayBuffer !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * Check if WASM is supported
 */
export function isWasmSupported(): boolean {
  try {
    if (typeof WebAssembly === 'object') {
      const module = new WebAssembly.Module(
        Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00)
      );
      return module instanceof WebAssembly.Module;
    }
  } catch {
    // WASM not supported
  }
  return false;
}

/**
 * Get the number of logical processors
 */
export function getHardwareConcurrency(): number {
  if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
    return navigator.hardwareConcurrency;
  }
  return 4; // Reasonable default
}

/**
 * Create a deferred promise
 */
export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

export function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

/**
 * Create a timeout promise
 */
export function createTimeout(ms: number, message?: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(message || `Operation timed out after ${ms}ms`));
    }, ms);
  });
}

/**
 * Race a promise against a timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message?: string
): Promise<T> {
  return Promise.race([promise, createTimeout(ms, message)]);
}

/**
 * Detect transferable objects in data
 */
export function findTransferables(data: unknown): Transferable[] {
  const transferables: Transferable[] = [];
  const seen = new WeakSet();

  function traverse(obj: unknown): void {
    if (obj === null || typeof obj !== 'object') return;
    if (seen.has(obj as object)) return;
    seen.add(obj as object);

    if (obj instanceof ArrayBuffer) {
      transferables.push(obj);
      return;
    }

    if (ArrayBuffer.isView(obj)) {
      transferables.push(obj.buffer);
      return;
    }

    if (obj instanceof MessagePort) {
      transferables.push(obj);
      return;
    }

    if (typeof ImageBitmap !== 'undefined' && obj instanceof ImageBitmap) {
      transferables.push(obj);
      return;
    }

    if (typeof OffscreenCanvas !== 'undefined' && obj instanceof OffscreenCanvas) {
      transferables.push(obj);
      return;
    }

    if (Array.isArray(obj)) {
      obj.forEach(traverse);
      return;
    }

    if (obj instanceof Map) {
      obj.forEach((value, key) => {
        traverse(key);
        traverse(value);
      });
      return;
    }

    if (obj instanceof Set) {
      obj.forEach(traverse);
      return;
    }

    Object.values(obj).forEach(traverse);
  }

  traverse(data);
  return transferables;
}

/**
 * Clone data, detaching transferables
 */
export function cloneForTransfer<T>(data: T): { data: T; transfer: Transferable[] } {
  const transfer = findTransferables(data);
  return { data, transfer };
}

/**
 * Create a typed event emitter
 */
export type EventHandler<T = unknown> = (data: T) => void;

export class EventEmitter<TEvents extends Record<string, unknown>> {
  private handlers = new Map<keyof TEvents, Set<EventHandler>>();

  on<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as EventHandler);

    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  off<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): void {
    this.handlers.get(event)?.delete(handler as EventHandler);
  }

  emit<K extends keyof TEvents>(event: K, data: TEvents[K]): void {
    this.handlers.get(event)?.forEach((handler) => {
      try {
        handler(data);
      } catch (err) {
        console.error(`Error in event handler for ${String(event)}:`, err);
      }
    });
  }

  removeAllListeners(event?: keyof TEvents): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }
}

/**
 * Simple LRU cache
 */
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Delete oldest (first) entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * Serialize function to string for worker
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export function serializeFunction(fn: Function): string {
  return fn.toString();
}

/**
 * Estimate the byte size of a value for structured cloning.
 * This is an approximation useful for debugging and performance monitoring.
 */
export function estimatePayloadSize(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'boolean') return 4;
  if (typeof value === 'number') return 8;
  if (typeof value === 'string') return value.length * 2; // UTF-16

  if (value instanceof ArrayBuffer) return value.byteLength;
  if (ArrayBuffer.isView(value)) return value.byteLength;
  if (value instanceof Blob) return value.size;

  const seen = new WeakSet<object>();

  function traverse(obj: unknown): number {
    if (obj === null || typeof obj !== 'object') {
      if (typeof obj === 'boolean') return 4;
      if (typeof obj === 'number') return 8;
      if (typeof obj === 'string') return (obj as string).length * 2;
      return 0;
    }

    if (seen.has(obj)) return 0; // Avoid infinite loops
    seen.add(obj);

    if (obj instanceof ArrayBuffer) return obj.byteLength;
    if (ArrayBuffer.isView(obj)) return obj.byteLength;
    if (obj instanceof Blob) return obj.size;
    if (obj instanceof Date) return 8;
    if (obj instanceof RegExp) return obj.source.length * 2;

    if (Array.isArray(obj)) {
      return obj.reduce((sum, item) => sum + traverse(item), 0);
    }

    if (obj instanceof Map) {
      let size = 0;
      obj.forEach((val, key) => {
        size += traverse(key) + traverse(val);
      });
      return size;
    }

    if (obj instanceof Set) {
      let size = 0;
      obj.forEach((val) => {
        size += traverse(val);
      });
      return size;
    }

    // Plain object
    return Object.entries(obj).reduce(
      (sum, [key, val]) => sum + key.length * 2 + traverse(val),
      0
    );
  }

  return traverse(value);
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0)} ${sizes[i]}`;
}

/**
 * Logger utility
 */
export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export function createLogger(prefix: string, enabled: boolean = false): Logger {
  const noop = () => {};
  const log = (level: string) =>
    enabled ? (...args: unknown[]) => console.log(`[${prefix}:${level}]`, ...args) : noop;

  return {
    debug: log('debug'),
    info: log('info'),
    warn: enabled
      ? (...args: unknown[]) => console.warn(`[${prefix}:warn]`, ...args)
      : noop,
    error: (...args: unknown[]) => console.error(`[${prefix}:error]`, ...args),
  };
}
