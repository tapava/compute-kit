---
layout: default
title: React Hooks
nav_order: 3
description: 'React hooks for ComputeKit'
permalink: /react-hooks
---

# React Hooks

{: .no_toc }

ComputeKit provides purpose-built React hooks for seamless integration.
{: .fs-6 .fw-300 }

<!-- prettier-ignore -->
<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## ComputeKitProvider

Wrap your application with the provider to enable all hooks.

{% raw %}

```tsx
import { ComputeKitProvider } from '@computekit/react';

function App() {
  return (
    <ComputeKitProvider options={{ maxWorkers: 4 }}>
      <MyApp />
    </ComputeKitProvider>
  );
}
```

{% endraw %}

### Provider Options

| Option               | Type       | Default                         | Description                  |
| -------------------- | ---------- | ------------------------------- | ---------------------------- |
| `maxWorkers`         | `number`   | `navigator.hardwareConcurrency` | Max workers in the pool      |
| `timeout`            | `number`   | `30000`                         | Default timeout in ms        |
| `debug`              | `boolean`  | `false`                         | Enable debug logging         |
| `remoteDependencies` | `string[]` | `[]`                            | External scripts for workers |

---

## useComputeKit

Access the ComputeKit instance directly.

```tsx
import { useComputeKit } from '@computekit/react';

function MyComponent() {
  const kit = useComputeKit();

  useEffect(() => {
    // Register functions
    kit.register('myFunction', (data) => {
      // Heavy computation
      return result;
    });
  }, [kit]);

  return <div>...</div>;
}
```

---

## useCompute

The primary hook for running compute functions.

```tsx
import { useCompute } from '@computekit/react';

function Calculator() {
  const {
    data, // Result data (TOutput | undefined)
    loading, // Boolean loading state
    error, // Error if failed (Error | null)
    progress, // Progress info (ComputeProgress | undefined)
    status, // 'idle' | 'running' | 'success' | 'error' | 'cancelled'
    run, // Function to execute
    reset, // Reset state to idle
    cancel, // Cancel current operation
  } = useCompute<TInput, TOutput>('functionName');

  return (
    <div>
      <button onClick={() => run(50)} disabled={loading}>
        {loading ? 'Computing...' : 'Calculate'}
      </button>

      {progress && <progress value={progress.percent} max={100} />}
      {data && <p>Result: {data}</p>}
      {error && <p className="error">{error.message}</p>}
    </div>
  );
}
```

### Options

```tsx
const { run } = useCompute('functionName', {
  // Initial input to run on mount
  initialInput: undefined,

  // Run immediately on mount
  runOnMount: false,

  // Timeout for this specific function
  timeout: 5000,

  // Progress callback
  onProgress: (progress) => {
    console.log(`${progress.percent}% complete`);
  },

  // Success callback
  onSuccess: (data) => {
    console.log('Completed:', data);
  },

  // Error callback
  onError: (error) => {
    console.error('Failed:', error);
  },
});
```

---

## useComputeCallback

Returns a memoized async function, similar to `useCallback`.

```tsx
import { useComputeCallback } from '@computekit/react';

function MyComponent() {
  const calculate = useComputeCallback<number[], number>('sum');

  const handleClick = async () => {
    const result = await calculate([1, 2, 3, 4, 5]);
    console.log(result); // 15
  };

  return <button onClick={handleClick}>Calculate</button>;
}
```

---

## useComputeFunction

Register and use a function in a single hook.

```tsx
import { useComputeFunction } from '@computekit/react';

function MyComponent() {
  const { data, loading, run } = useComputeFunction('double', (n: number) => n * 2);

  return (
    <button onClick={() => run(21)} disabled={loading}>
      {data ?? 'Click to double 21'}
    </button>
  );
}
```

---

## usePoolStats

Monitor worker pool performance in real-time.

```tsx
import { usePoolStats } from '@computekit/react';

function PoolMonitor() {
  // Refresh every 1000ms
  const stats = usePoolStats(1000);

  return (
    <div className="monitor">
      <p>Total Workers: {stats.totalWorkers}</p>
      <p>Active: {stats.activeWorkers}</p>
      <p>Idle: {stats.idleWorkers}</p>
      <p>Queue: {stats.queueLength}</p>
      <p>Completed: {stats.tasksCompleted}</p>
      <p>Failed: {stats.tasksFailed}</p>
      <p>Avg Duration: {stats.averageTaskDuration.toFixed(2)}ms</p>
    </div>
  );
}
```

---

## Progress Reporting

Track progress for long-running operations:

```tsx
// Register function with progress reporting
kit.register('longTask', async (data, { reportProgress }) => {
  const total = data.items.length;
  const results = [];

  for (let i = 0; i < total; i++) {
    results.push(await process(data.items[i]));

    // Report progress
    reportProgress({
      percent: ((i + 1) / total) * 100,
      phase: 'Processing',
      data: { current: i + 1, total },
    });
  }

  return results;
});

// Use with progress tracking
function LongTaskComponent() {
  const { progress, loading, run } = useCompute('longTask');

  return (
    <div>
      <button onClick={() => run({ items: largeArray })}>Start Processing</button>

      {loading && progress && (
        <div>
          <progress value={progress.percent} max={100} />
          <span>
            {progress.phase}: {progress.percent.toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  );
}
```

---

## Cancellation

Cancel running operations using AbortController:

```tsx
function CancellableTask() {
  const { data, loading, run, cancel } = useCompute('longTask');

  return (
    <div>
      <button onClick={() => run(data)} disabled={loading}>
        Start
      </button>

      <button onClick={cancel} disabled={!loading}>
        Cancel
      </button>
    </div>
  );
}
```

---

## TypeScript Support

Full type inference for inputs and outputs:

```tsx
// Define your types
interface ImageInput {
  data: number[];
  width: number;
  height: number;
}

interface ImageOutput {
  data: number[];
  processingTime: number;
}

// Types are inferred in the hook
const { data, run } = useCompute<ImageInput, ImageOutput>('processImage');

// data is ImageOutput | undefined
// run expects ImageInput
run({ data: [...], width: 256, height: 256 });
```

---

## usePipeline & useParallelBatch

For complex multi-stage workflows and parallel batch processing, see the dedicated [Multi-Stage Pipelines]({{ site.baseurl }}/pipeline) guide.

Quick preview:

```tsx
// Multi-stage pipeline
const pipeline = usePipeline([
  { id: 'download', name: 'Download', functionName: 'downloadFiles' },
  { id: 'process', name: 'Process', functionName: 'processFiles' },
  { id: 'compress', name: 'Compress', functionName: 'compressFiles' },
]);

// Parallel batch processing
const batch = useParallelBatch<string, ProcessedFile>('processFile', {
  concurrency: 4,
});
```

---

## Next Steps

- Check the [Multi-Stage Pipelines]({{ site.baseurl }}/pipeline) for complex workflows
- Check the [API Reference]({{ site.baseurl }}/api-reference) for the complete API
- Learn about [WASM integration]({{ site.baseurl }}/wasm) for native-speed performance
