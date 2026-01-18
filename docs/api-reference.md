---
layout: default
title: API Reference
nav_order: 4
description: 'Complete API reference for ComputeKit'
permalink: /api-reference
---

# API Reference

{: .no_toc }

Complete API documentation for the ComputeKit core library.
{: .fs-6 .fw-300 }

<!-- prettier-ignore -->
<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## ComputeKit Class

The main entry point for using ComputeKit.

### Constructor

```typescript
new ComputeKit(options?: ComputeKitOptions)
```

### ComputeKitOptions

| Property             | Type       | Default                                | Description                           |
| -------------------- | ---------- | -------------------------------------- | ------------------------------------- |
| `maxWorkers`         | `number`   | `navigator.hardwareConcurrency \|\| 4` | Maximum number of workers in the pool |
| `timeout`            | `number`   | `30000`                                | Default timeout for operations (ms)   |
| `debug`              | `boolean`  | `false`                                | Enable debug logging                  |
| `workerPath`         | `string`   | `''`                                   | Custom path to worker script          |
| `useSharedMemory`    | `boolean`  | `true`                                 | Use SharedArrayBuffer when available  |
| `remoteDependencies` | `string[]` | `[]`                                   | External scripts to load in workers   |

---

## Typed Registry

ComputeKit supports **type-safe function registration** using TypeScript's declaration merging. This provides:

- **Autocomplete** for registered function names
- **Type inference** for input and output types
- **Compile-time errors** for incorrect usage

### Setting Up the Typed Registry

Extend the `ComputeFunctionRegistry` interface to define your function signatures:

```typescript
// In a .d.ts file or at the top of your main file
declare module '@computekit/core' {
  interface ComputeFunctionRegistry {
    fibonacci: { input: number; output: number };
    sum: { input: number[]; output: number };
    processData: { input: { items: string[] }; output: { count: number } };
  }
}
```

### Using DefineFunction Helper

For cleaner syntax, use the `DefineFunction` type helper:

```typescript
import type { DefineFunction } from '@computekit/core';

declare module '@computekit/core' {
  interface ComputeFunctionRegistry {
    fibonacci: DefineFunction<number, number>;
    sum: DefineFunction<number[], number>;
    processData: DefineFunction<{ items: string[] }, { count: number }>;
  }
}
```

### Benefits

Once you've extended the registry, you get full type safety:

```typescript
import { ComputeKit } from '@computekit/core';

const kit = new ComputeKit();

// ✅ Types are inferred - no need for generics!
kit.register('fibonacci', (n) => {
  // n is inferred as number
  if (n <= 1) return n;
  let a = 0,
    b = 1;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b; // return type must be number
});

// ✅ Input type is enforced
const result = await kit.run('fibonacci', 50); // result is number

// ❌ TypeScript error: 'unknownFunc' is not in the registry
await kit.run('unknownFunc', 42);

// ❌ TypeScript error: Argument of type 'string' is not assignable to 'number'
await kit.run('fibonacci', 'not a number');
```

### With React Hooks

The typed registry works seamlessly with React hooks:

```tsx
import { useCompute, useComputeCallback } from '@computekit/react';

function FibonacciCalculator() {
  // ✅ Types are inferred from the registry
  const { data, loading, run } = useCompute('fibonacci');
  // data is number | null
  // run expects (input: number) => void

  return (
    <button onClick={() => run(50)}>
      {loading ? 'Computing...' : `Result: ${data}`}
    </button>
  );
}
```

### Registry Type Helpers

| Type                      | Description                                                |
| ------------------------- | ---------------------------------------------------------- |
| `ComputeFunctionRegistry` | The base interface to extend with your functions           |
| `RegisteredFunctionName`  | Union of all registered function names                     |
| `FunctionInput<Name>`     | Get the input type for a function                          |
| `FunctionOutput<Name>`    | Get the output type for a function                         |
| `DefineFunction<I, O>`    | Helper to define `{ input: I; output: O }`                 |
| `ComputeFn<I, O>`         | Type for compute functions `(input: I) => O \| Promise<O>` |
| `InferComputeFn<Name>`    | Infer the full function type from a name                   |
| `HasRegisteredFunctions`  | Boolean type indicating if registry has entries            |

### Fallback Behavior

If you don't extend the registry, ComputeKit falls back to the original behavior with explicit generics:

```typescript
// Still works without registry extension
const { data, run } = useCompute<number, number>('fibonacci');
const result = await kit.run<number, number>('fibonacci', 50);
```

---

## Methods

### initialize()

Manually initialize the worker pool. Called automatically on first `run()`.

```typescript
const kit = new ComputeKit();
await kit.initialize(); // Optional: eager initialization
```

### register()

Register a compute function.

```typescript
register<TInput, TOutput>(
  name: string,
  fn: (input: TInput, context: ComputeContext) => TOutput | Promise<TOutput>
): this
```

**Parameters:**

- `name` - Unique identifier for the function
- `fn` - The function to execute (runs in a Web Worker)

**Returns:** `this` (for chaining)

```typescript
kit.register('double', (n: number) => n * 2);

kit.register('asyncTask', async (data, { reportProgress }) => {
  // Report progress during long operations
  reportProgress({ percent: 50 });
  return await processData(data);
});

// Chaining
kit.register('add', (a, b) => a + b).register('multiply', (a, b) => a * b);
```

### run()

Execute a registered function.

```typescript
run<TInput, TOutput>(
  name: string,
  input: TInput,
  options?: ComputeOptions
): Promise<TOutput>
```

**Parameters:**

- `name` - Name of the registered function
- `input` - Input data (will be serialized)
- `options` - Optional execution options

```typescript
const result = await kit.run('double', 21);
console.log(result); // 42
```

### runWithMetadata()

Execute a function and receive metadata about the execution.

```typescript
runWithMetadata<TInput, TOutput>(
  name: string,
  input: TInput,
  options?: ComputeOptions
): Promise<ComputeResult<TOutput>>
```

```typescript
const result = await kit.runWithMetadata('heavy', data);
console.log(`Took ${result.duration}ms on worker ${result.workerId}`);
```

### getStats()

Get current worker pool statistics.

```typescript
const stats = kit.getStats();
console.log(`Active workers: ${stats.activeWorkers}`);
console.log(`Queue length: ${stats.queueLength}`);
```

### isWasmSupported()

Check if WebAssembly is supported in the current environment.

```typescript
if (kit.isWasmSupported()) {
  // Load WASM module
}
```

### terminate()

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

// Cancel the operation
controller.abort();
```

---

## ComputeProgress

Progress information for long-running tasks.

| Property                 | Type       | Description                 |
| ------------------------ | ---------- | --------------------------- |
| `percent`                | `number`   | Progress percentage (0-100) |
| `phase`                  | `string?`  | Current phase name          |
| `estimatedTimeRemaining` | `number?`  | Estimated ms remaining      |
| `data`                   | `unknown?` | Additional custom data      |

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

## Event Handling

ComputeKit extends EventEmitter and emits events:

```typescript
kit.on('worker:created', (info) => {
  console.log('New worker:', info.id);
});

kit.on('worker:terminated', (info) => {
  console.log('Worker terminated:', info.id);
});

kit.on('task:start', (taskId, name) => {
  console.log(`Starting ${name}`);
});

kit.on('task:complete', (taskId, duration) => {
  console.log(`Done in ${duration}ms`);
});

kit.on('task:error', (taskId, error) => {
  console.error('Task failed:', error);
});

kit.on('task:progress', (taskId, progress) => {
  console.log(`${progress.percent}%`);
});
```

---

## Utility Functions

### isWasmSupported()

Check if WebAssembly is available.

```typescript
import { isWasmSupported } from '@computekit/core';

if (isWasmSupported()) {
  // Use WASM
}
```

### isSharedArrayBufferAvailable()

Check if SharedArrayBuffer is available.

```typescript
import { isSharedArrayBufferAvailable } from '@computekit/core';

if (isSharedArrayBufferAvailable()) {
  // Use shared memory
}
```

### getHardwareConcurrency()

Get the number of logical CPU cores.

```typescript
import { getHardwareConcurrency } from '@computekit/core';

const cores = getHardwareConcurrency();
console.log(`${cores} CPU cores available`);
```

### findTransferables()

Detect transferable objects in data for efficient worker communication.

```typescript
import { findTransferables } from '@computekit/core';

const data = { buffer: new ArrayBuffer(1024), values: [1, 2, 3] };
const transferables = findTransferables(data);
// [ArrayBuffer(1024)]
```

---

## Error Handling

ComputeKit throws errors in these cases:

```typescript
try {
  await kit.run('unknown', data);
} catch (error) {
  if (error.message.includes('not registered')) {
    // Function not registered
  } else if (error.message.includes('timed out')) {
    // Timeout
  } else if (error.message.includes('aborted')) {
    // Cancelled via AbortSignal
  } else {
    // Worker error
  }
}
```
