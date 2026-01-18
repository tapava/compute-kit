---
layout: default
title: Core API (Detailed)
nav_order: 8
description: 'Detailed API reference for @computekit/core'
permalink: /core-api
---

# @computekit/core API Reference

Complete API documentation for the ComputeKit core library.

## Table of Contents

- [ComputeKit Class](#computekit-class)
- [WorkerPool Class](#workerpool-class)
- [WASM Utilities](#wasm-utilities)
- [Types](#types)
- [Utility Functions](#utility-functions)

---

## ComputeKit Class

The main entry point for using ComputeKit.

### Constructor

```typescript
new ComputeKit(options?: ComputeKitOptions)
```

#### ComputeKitOptions

| Property          | Type      | Default                                | Description                           |
| ----------------- | --------- | -------------------------------------- | ------------------------------------- |
| `maxWorkers`      | `number`  | `navigator.hardwareConcurrency \|\| 4` | Maximum number of workers in the pool |
| `timeout`         | `number`  | `30000`                                | Default timeout for operations (ms)   |
| `debug`           | `boolean` | `false`                                | Enable debug logging                  |
| `workerPath`      | `string`  | `''`                                   | Custom path to worker script          |
| `useSharedMemory` | `boolean` | `true`                                 | Use SharedArrayBuffer when available  |

### Methods

#### `initialize(): Promise<void>`

Manually initialize the worker pool. Called automatically on first `run()`.

```typescript
const kit = new ComputeKit();
await kit.initialize(); // Optional: eager initialization
```

#### `register<TInput, TOutput>(name: string, fn: (input: TInput) => TOutput | Promise<TOutput>): this`

Register a compute function.

```typescript
kit.register('double', (n: number) => n * 2);
kit.register('asyncTask', async (data) => {
  // async work
  return result;
});
```

**Parameters:**

- `name` - Unique identifier for the function
- `fn` - The function to execute (runs in a Web Worker)

**Returns:** `this` (for chaining)

#### `run<TInput, TOutput>(name: string, input: TInput, options?: ComputeOptions): Promise<TOutput>`

Execute a registered function.

```typescript
const result = await kit.run('double', 21);
console.log(result); // 42
```

**Parameters:**

- `name` - Name of the registered function
- `input` - Input data (will be serialized)
- `options` - Optional execution options

**Returns:** Promise resolving to the function result

#### `runWithMetadata<TInput, TOutput>(name: string, input: TInput, options?: ComputeOptions): Promise<ComputeResult<TOutput>>`

Execute a function and receive metadata about the execution.

```typescript
const result = await kit.runWithMetadata('heavy', data);
console.log(`Took ${result.duration}ms`);
```

**Returns:** Promise resolving to `ComputeResult<TOutput>`

#### `getStats(): PoolStats`

Get current worker pool statistics.

```typescript
const stats = kit.getStats();
console.log(`Active workers: ${stats.activeWorkers}`);
```

#### `isWasmSupported(): boolean`

Check if WebAssembly is supported in the current environment.

#### `terminate(): Promise<void>`

Terminate all workers and clean up resources.

```typescript
await kit.terminate();
```

---

## ComputeOptions

Options for individual compute operations.

| Property     | Type                                  | Description                           |
| ------------ | ------------------------------------- | ------------------------------------- |
| `timeout`    | `number`                              | Operation timeout in ms               |
| `transfer`   | `ArrayBuffer[]`                       | ArrayBuffers to transfer (not copy)   |
| `priority`   | `number`                              | Priority level (0-10, higher = first) |
| `signal`     | `AbortSignal`                         | Abort signal for cancellation         |
| `onProgress` | `(progress: ComputeProgress) => void` | Progress callback                     |

```typescript
const controller = new AbortController();

await kit.run('task', data, {
  timeout: 5000,
  priority: 10,
  signal: controller.signal,
  onProgress: (p) => console.log(`${p.percent}%`),
});
```

---

## ComputeProgress

Progress information for long-running tasks.

| Property                 | Type       | Description                 |
| ------------------------ | ---------- | --------------------------- |
| `percent`                | `number`   | Progress percentage (0-100) |
| `phase`                  | `string?`  | Current phase name          |
| `estimatedTimeRemaining` | `number?`  | Estimated ms remaining      |
| `data`                   | `unknown?` | Additional data             |

---

## ComputeResult<T>

Result wrapper with execution metadata.

| Property   | Type      | Description                          |
| ---------- | --------- | ------------------------------------ |
| `data`     | `T`       | The computed result                  |
| `duration` | `number`  | Execution time in ms                 |
| `cached`   | `boolean` | Whether result was cached            |
| `workerId` | `string`  | ID of the worker that processed this |

---

## PoolStats

Worker pool statistics.

| Property              | Type           | Description                |
| --------------------- | -------------- | -------------------------- |
| `workers`             | `WorkerInfo[]` | Info about each worker     |
| `totalWorkers`        | `number`       | Total worker count         |
| `activeWorkers`       | `number`       | Currently busy workers     |
| `idleWorkers`         | `number`       | Currently idle workers     |
| `queueLength`         | `number`       | Tasks waiting in queue     |
| `tasksCompleted`      | `number`       | Total completed tasks      |
| `tasksFailed`         | `number`       | Total failed tasks         |
| `averageTaskDuration` | `number`       | Average task duration (ms) |

---

## WASM Utilities

Functions for working with WebAssembly.

### `loadWasmModule(source: string | ArrayBuffer | Uint8Array): Promise<WebAssembly.Module>`

Load a WASM module from various sources.

```typescript
// From URL
const module = await loadWasmModule('/path/to/module.wasm');

// From ArrayBuffer
const bytes = await fetch('/module.wasm').then((r) => r.arrayBuffer());
const module = await loadWasmModule(bytes);

// From base64
const module = await loadWasmModule('data:application/wasm;base64,...');
```

### `loadAndInstantiate(config: WasmModuleConfig): Promise<{ module, instance }>`

Load and instantiate a WASM module.

```typescript
const { module, instance } = await loadAndInstantiate({
  source: '/module.wasm',
  imports: {
    env: { log: console.log },
  },
  memory: {
    initial: 256,
    maximum: 512,
    shared: true,
  },
});
```

### `loadAssemblyScript(source, imports?): Promise<{ module, instance, exports }>`

Load an AssemblyScript-compiled WASM module with default imports.

```typescript
const { exports } = await loadAssemblyScript('/as-module.wasm');
const result = exports.computeSum(data);
```

### `getMemoryView<T>(memory, ArrayType, offset?, length?): T`

Create a typed array view into WASM memory.

```typescript
const view = getMemoryView(memory, Float64Array, 0, 100);
```

### `copyToWasmMemory(memory, data, offset): void`

Copy data to WASM memory.

### `copyFromWasmMemory(memory, offset, length): Uint8Array`

Copy data from WASM memory.

### `clearWasmCache(): void`

Clear the WASM module cache.

### `getWasmCacheStats(): { modules: number, instances: number }`

Get WASM cache statistics.

---

## Utility Functions

### `isWasmSupported(): boolean`

Check if WebAssembly is available.

### `isSharedArrayBufferAvailable(): boolean`

Check if SharedArrayBuffer is available.

### `getHardwareConcurrency(): number`

Get the number of logical CPU cores.

### `findTransferables(data: unknown): Transferable[]`

Detect transferable objects in data for efficient worker communication.

---

## Event Handling

ComputeKit extends EventEmitter and emits events:

```typescript
kit.on('worker:created', (info) => console.log('New worker:', info.id));
kit.on('worker:terminated', (info) => console.log('Worker terminated:', info.id));
kit.on('task:start', (taskId, name) => console.log(`Starting ${name}`));
kit.on('task:complete', (taskId, duration) => console.log(`Done in ${duration}ms`));
kit.on('task:error', (taskId, error) => console.error('Task failed:', error));
kit.on('task:progress', (taskId, progress) => console.log(`${progress.percent}%`));
```

---

## Error Handling

ComputeKit throws errors in these cases:

- **Function not found**: When calling `run()` with an unregistered function name
- **Timeout**: When a task exceeds the timeout
- **Worker error**: When the worker encounters an error
- **Aborted**: When the operation is cancelled via AbortSignal

```typescript
try {
  await kit.run('unknown', data);
} catch (error) {
  if (error.message.includes('not registered')) {
    // Function not registered
  } else if (error.message.includes('timed out')) {
    // Timeout
  } else if (error.message.includes('aborted')) {
    // Cancelled
  }
}
```
