# @computekit/react

React bindings for ComputeKit - run heavy computations in Web Workers with simple hooks.

## Installation

```bash
npm install @computekit/core @computekit/react
```

## Quick Start

```tsx
import { ComputeKitProvider, useComputeKit, useCompute } from '@computekit/react';

// 1. Wrap your app with the provider
function App() {
  return (
    <ComputeKitProvider options={{ maxWorkers: 4 }}>
      <MyApp />
    </ComputeKitProvider>
  );
}

// 2. Register functions and use them
function MyApp() {
  const kit = useComputeKit();

  useEffect(() => {
    kit.register('fibonacci', (n: number) => {
      let a = 0,
        b = 1;
      for (let i = 0; i < n; i++) {
        [a, b] = [b, a + b];
      }
      return a;
    });
  }, [kit]);

  return <FibCalculator />;
}

// 3. Use the compute function
function FibCalculator() {
  const { data, loading, error, run } = useCompute<number, number>('fibonacci');

  return (
    <div>
      <button onClick={() => run(50)} disabled={loading}>
        Calculate Fibonacci(50)
      </button>
      {loading && <p>Computing...</p>}
      {error && <p>Error: {error.message}</p>}
      {data !== null && <p>Result: {data}</p>}
    </div>
  );
}
```

## API Reference

### `<ComputeKitProvider>`

Provider component that creates and manages the ComputeKit instance.

```tsx
<ComputeKitProvider
  options={{
    maxWorkers: 4, // Max workers in pool (default: CPU cores)
    timeout: 30000, // Default timeout in ms
    debug: false, // Enable debug logging
  }}
>
  {children}
</ComputeKitProvider>
```

**Props:**

| Prop       | Type                | Description                           |
| ---------- | ------------------- | ------------------------------------- |
| `options`  | `ComputeKitOptions` | Configuration options                 |
| `instance` | `ComputeKit`        | Custom ComputeKit instance (optional) |
| `children` | `ReactNode`         | Child components                      |

### `useComputeKit()`

Get the ComputeKit instance from context.

```tsx
const kit = useComputeKit();

// Register functions
kit.register('myFunc', (input) => /* ... */);

// Run directly
const result = await kit.run('myFunc', data);
```

### `useCompute<TInput, TOutput>(name, options?)`

Hook for running compute functions with full state management.

```tsx
const {
  data, // Result (null until complete)
  loading, // Boolean loading state
  error, // Error object if failed
  progress, // Progress info for long tasks
  status, // 'idle' | 'running' | 'success' | 'error' | 'cancelled'
  run, // Function to execute
  reset, // Reset state
  cancel, // Cancel ongoing computation
} = useCompute<number, number>('fibonacci');

// Execute
await run(50);

// With options
await run(50, { timeout: 5000 });

// React to status changes
if (status === 'success') {
  console.log('Completed!', data);
} else if (status === 'error') {
  console.error('Failed:', error);
}
```

**Status values:**

| Status      | Description                         |
| ----------- | ----------------------------------- |
| `idle`      | Initial state, no computation yet   |
| `running`   | Computation in progress             |
| `success`   | Completed successfully              |
| `error`     | Failed with an error                |
| `cancelled` | Cancelled via `cancel()` or unmount |

**Options:**

| Option         | Type                 | Description                            |
| -------------- | -------------------- | -------------------------------------- |
| `timeout`      | `number`             | Operation timeout in ms                |
| `autoRun`      | `boolean`            | Auto-run on mount                      |
| `initialInput` | `unknown`            | Input for autoRun                      |
| `resetOnRun`   | `boolean`            | Reset state on new run (default: true) |
| `onProgress`   | `(progress) => void` | Progress callback                      |

### `useComputeCallback<TInput, TOutput>(name, options?)`

Returns a memoized async function for simple use cases.

```tsx
const calculate = useComputeCallback<number[], number>('sum');

const handleClick = async () => {
  const result = await calculate([1, 2, 3, 4, 5]);
  console.log(result); // 15
};
```

### `useComputeFunction<TInput, TOutput>(name, fn, options?)`

Register and use a function in one hook. Useful for component-local compute functions.

```tsx
const { data, loading, run } = useComputeFunction('double', (n: number) => n * 2);

// Function is registered automatically
run(21); // data will be 42
```

### `usePoolStats(refreshInterval?)`

Get worker pool statistics.

```tsx
const stats = usePoolStats(1000); // Refresh every second

return (
  <div>
    <p>
      Active: {stats.activeWorkers}/{stats.totalWorkers}
    </p>
    <p>Queue: {stats.queueLength}</p>
    <p>Completed: {stats.tasksCompleted}</p>
  </div>
);
```

**Returns `PoolStats`:**

| Property         | Type     | Description            |
| ---------------- | -------- | ---------------------- |
| `totalWorkers`   | `number` | Total worker count     |
| `activeWorkers`  | `number` | Currently busy workers |
| `idleWorkers`    | `number` | Currently idle workers |
| `queueLength`    | `number` | Tasks waiting in queue |
| `tasksCompleted` | `number` | Total completed tasks  |
| `tasksFailed`    | `number` | Total failed tasks     |

### `useWasmSupport()`

Check if WebAssembly is supported.

```tsx
const isSupported = useWasmSupport();

if (!isSupported) {
  return <p>WebAssembly not supported</p>;
}
```

## Patterns

### Cancellation on Unmount

The `useCompute` hook automatically cancels pending operations when the component unmounts:

```tsx
function MyComponent() {
  const { run, loading } = useCompute('heavyTask');

  useEffect(() => {
    run(data); // Automatically cancelled if component unmounts
  }, []);

  // ...
}
```

### Manual Cancellation

```tsx
function MyComponent() {
  const { run, cancel, loading } = useCompute('heavyTask');

  return (
    <>
      <button onClick={() => run(data)}>Start</button>
      <button onClick={cancel} disabled={!loading}>
        Cancel
      </button>
    </>
  );
}
```

### Progress Tracking

```tsx
function MyComponent() {
  const { run, progress, loading } = useCompute('heavyTask', {
    onProgress: (p) => console.log(`${p.percent}%`),
  });

  return (
    <div>{loading && progress && <progress value={progress.percent} max={100} />}</div>
  );
}
```

### With AbortController

```tsx
function MyComponent() {
  const controller = useRef(new AbortController());
  const { run } = useCompute('task');

  const handleRun = () => {
    run(data, { signal: controller.current.signal });
  };

  const handleCancel = () => {
    controller.current.abort();
    controller.current = new AbortController();
  };
}
```

## TypeScript

Full type inference is supported:

```tsx
// Types are inferred from registration
kit.register('add', (nums: number[]) => nums.reduce((a, b) => a + b, 0));

// Explicit types for hooks
const { data, run } = useCompute<number[], number>('add');
// data: number | null
// run: (input: number[]) => Promise<void>
```

## License

MIT
