# @computekit/core

The core library for ComputeKit - run heavy computations in Web Workers with WASM support.

## Installation

```bash
npm install @computekit/core
```

## Quick Start

```typescript
import { ComputeKit } from '@computekit/core';

// Create an instance
const kit = new ComputeKit();

// Register a compute function
kit.register('fibonacci', (n: number) => {
  let a = 0,
    b = 1;
  for (let i = 0; i < n; i++) {
    [a, b] = [b, a + b];
  }
  return a;
});

// Run it (non-blocking!)
const result = await kit.run('fibonacci', 50);
console.log(result); // 12586269025
```

## API Reference

### `new ComputeKit(options?)`

Create a new ComputeKit instance.

```typescript
const kit = new ComputeKit({
  maxWorkers: 4, // Max workers (default: CPU cores)
  timeout: 30000, // Default timeout in ms
  debug: false, // Enable debug logging
  useSharedMemory: true, // Use SharedArrayBuffer when available
  remoteDependencies: [], // External scripts to load in workers
});
```

### Remote Dependencies

Load external scripts inside workers using `remoteDependencies`:

```typescript
const kit = new ComputeKit({
  remoteDependencies: [
    'https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js',
  ],
});

// Now you can use lodash inside your compute functions
kit.register('processData', (data: number[]) => {
  // @ts-ignore - lodash is loaded via importScripts
  return _.chunk(data, 3);
});
```

**Note:** Remote scripts must be served with proper CORS headers.

### `kit.register(name, fn)`

Register a function to run in workers.

```typescript
kit.register('sum', (numbers: number[]) => {
  return numbers.reduce((a, b) => a + b, 0);
});

// Async functions work too
kit.register('fetchAndProcess', async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  return processData(data);
});
```

### `kit.run(name, input, options?)`

Execute a registered function.

```typescript
const result = await kit.run('sum', [1, 2, 3, 4, 5]);
console.log(result); // 15
```

**Options:**

```typescript
await kit.run('task', data, {
  timeout: 5000, // Timeout in ms
  priority: 10, // Priority (0-10, higher = first)
  signal: abortController.signal, // AbortSignal for cancellation
  onProgress: (p) => {
    // Progress callback
    console.log(`${p.percent}%`);
  },
});
```

### `kit.runWithMetadata(name, input, options?)`

Execute and get execution metadata.

```typescript
const result = await kit.runWithMetadata('task', data);
console.log(result.data); // The result
console.log(result.duration); // Execution time in ms
console.log(result.workerId); // Which worker ran it
```

### `kit.getStats()`

Get worker pool statistics.

```typescript
const stats = kit.getStats();
console.log(stats.activeWorkers); // Currently busy workers
console.log(stats.queueLength); // Tasks waiting
console.log(stats.tasksCompleted); // Total completed
```

### `kit.terminate()`

Terminate all workers and clean up.

```typescript
await kit.terminate();
```

## WASM Support

Load and use WebAssembly modules:

```typescript
import { loadWasmModule, loadAssemblyScript } from '@computekit/core';

// Load a WASM module
const module = await loadWasmModule('/path/to/module.wasm');

// Load AssemblyScript with default imports
const { exports } = await loadAssemblyScript('/as-module.wasm');
const result = exports.compute(data);
```

### WASM Utilities

```typescript
import {
  loadWasmModule,
  loadAndInstantiate,
  loadAssemblyScript,
  getMemoryView,
  copyToWasmMemory,
  copyFromWasmMemory,
  isWasmSupported,
} from '@computekit/core';

// Check support
if (isWasmSupported()) {
  // Load and instantiate with custom imports
  const { instance } = await loadAndInstantiate({
    source: '/module.wasm',
    imports: { env: { log: console.log } },
    memory: { initial: 256, maximum: 512 },
  });
}
```

## Events

ComputeKit emits events for monitoring:

```typescript
kit.on('worker:created', (info) => console.log('Worker created:', info.id));
kit.on('worker:terminated', (info) => console.log('Worker terminated:', info.id));
kit.on('task:start', (taskId, name) => console.log('Task started:', name));
kit.on('task:complete', (taskId, duration) => console.log('Done in', duration, 'ms'));
kit.on('task:error', (taskId, error) => console.error('Task failed:', error));
kit.on('task:progress', (taskId, progress) => console.log(progress.percent, '%'));
```

## Error Handling

```typescript
try {
  await kit.run('task', data);
} catch (error) {
  if (error.message.includes('not registered')) {
    // Function not found
  } else if (error.message.includes('timed out')) {
    // Timeout exceeded
  } else if (error.message.includes('aborted')) {
    // Cancelled via AbortSignal
  }
}
```

## Cancellation

```typescript
const controller = new AbortController();

// Start a long task
const promise = kit.run('heavyTask', data, {
  signal: controller.signal,
});

// Cancel it
controller.abort();

try {
  await promise;
} catch (error) {
  // error.message contains 'aborted'
}
```

## TypeScript

Full type safety:

```typescript
// Generic types flow through
kit.register('double', (n: number) => n * 2);
const result = await kit.run<number, number>('double', 21);
// result is typed as number
```

## License

MIT
