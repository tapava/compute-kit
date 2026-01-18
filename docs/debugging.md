---
layout: default
title: Debugging
nav_order: 8
---

# Debugging ComputeKit

{: .no_toc }

Learn how to debug worker code, understand errors, and troubleshoot issues in ComputeKit.
{: .fs-6 .fw-300 }

<!-- prettier-ignore -->
<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Overview

Debugging Web Workers can be tricky because they run in a separate thread with their own global scope. ComputeKit provides several tools to make debugging easier:

- Enhanced error messages with context
- Debug mode with verbose logging
- Console forwarding from workers
- Chrome DevTools integration
- Validation mode for main-thread debugging

---

## Enable Debug Mode

The simplest way to start debugging is to enable debug mode:

```typescript
import { ComputeKit } from '@computekit/core';

const kit = new ComputeKit({
  debug: true, // Enable verbose logging
});
```

With React:

```tsx
<ComputeKitProvider debug={true}>
  <App />
</ComputeKitProvider>
```

Debug mode logs:

- Worker creation and termination
- Function registration
- Task execution (start, complete, error)
- Message passing between main thread and workers
- Payload sizes for data transfer

---

## Understanding Error Messages

When a compute function throws an error, ComputeKit captures and enriches it with context:

```typescript
kit.register('riskyFunction', (input: number) => {
  if (input < 0) {
    throw new Error('Input must be non-negative');
  }
  return Math.sqrt(input);
});

try {
  await kit.run('riskyFunction', -5);
} catch (error) {
  console.error(error);
  // ComputeError: Input must be non-negative
  //   Function: riskyFunction
  //   Worker: worker-abc123
  //   Duration: 2ms
  //   Stack: ...original stack trace...
}
```

### Error Properties

All errors from ComputeKit include:

| Property       | Description                              |
| -------------- | ---------------------------------------- |
| `message`      | The original error message               |
| `functionName` | Name of the compute function that failed |
| `workerId`     | ID of the worker that processed the task |
| `duration`     | Time elapsed before the error occurred   |
| `stack`        | Full stack trace from the worker         |
| `inputSize`    | Size of the input data (in debug mode)   |

---

## Chrome DevTools Integration

### Debugging Workers Directly

Chrome DevTools supports debugging Web Workers:

1. Open DevTools (F12)
2. Go to **Sources** tab
3. In the left panel, find **Threads** section
4. Click on a worker thread to debug it

### Setting Breakpoints

To set breakpoints in your compute functions:

1. Enable source maps in your bundler (see below)
2. In DevTools Sources, find your worker code
3. Set breakpoints as normal
4. Use the worker thread selector to switch contexts

### Console Output

Worker `console.log()` calls appear in the main DevTools console, prefixed with the worker context. Enable **Verbose** log level to see all worker output:

```typescript
kit.register('debugMe', (input: number[]) => {
  console.log('Processing', input.length, 'items'); // Visible in DevTools
  console.time('processing');

  const result = input.map((x) => x * 2);

  console.timeEnd('processing');
  console.log('Result:', result.slice(0, 5), '...');

  return result;
});
```

---

## Source Maps

For the best debugging experience, configure your bundler to generate source maps for workers.

### Vite

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    sourcemap: true,
  },
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        sourcemap: true,
      },
    },
  },
});
```

### Webpack

```javascript
// webpack.config.js
module.exports = {
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.worker\.ts$/,
        use: {
          loader: 'worker-loader',
          options: {
            inline: 'fallback',
          },
        },
      },
    ],
  },
};
```

### esbuild

```typescript
import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  sourcemap: true,
  outfile: 'dist/bundle.js',
});
```

---

## Validation Mode (Main Thread Execution)

For difficult bugs, run your compute function on the main thread to use standard debugging tools:

```typescript
import { ComputeKit } from '@computekit/core';

const kit = new ComputeKit({
  // Force main thread execution (bypasses workers)
  forceMainThread: true,
});

// Now you can set breakpoints directly in your compute functions
kit.register('myFunction', (input) => {
  debugger; // This will pause execution in DevTools
  return processData(input);
});
```

{: .warning }

> **forceMainThread** should only be used for debugging. It defeats the purpose of using workers and will block the UI thread.

---

## Common Issues

### "Function not found in worker"

This error occurs when a compute function isn't registered before calling `run()`:

```typescript
// ❌ Wrong - function not registered
await kit.run('myFunction', data);

// ✅ Correct - register first
kit.register('myFunction', (data) => processData(data));
await kit.run('myFunction', data);
```

**In React**, ensure registration happens before the component that uses the function mounts:

```tsx
// ❌ Wrong - might race with child components
function App() {
  const kit = useComputeKit();

  useEffect(() => {
    kit.register('myFunction', fn);
  }, [kit]);

  return <ChildThatUsesMyFunction />;
}

// ✅ Correct - use a registration component or context
function App() {
  return (
    <ComputeKitProvider>
      <RegisterFunctions />
      <MainApp />
    </ComputeKitProvider>
  );
}

function RegisterFunctions() {
  const kit = useComputeKit();

  useEffect(() => {
    kit.register('myFunction', fn);
  }, [kit]);

  return null;
}
```

### "DataCloneError: Failed to execute 'postMessage'"

This error occurs when trying to transfer non-cloneable data:

```typescript
// ❌ Wrong - functions can't be cloned
kit.register('bad', () => {
  return {
    data: [1, 2, 3],
    callback: () => console.log('hi'), // Can't clone functions!
  };
});

// ✅ Correct - return only cloneable data
kit.register('good', () => {
  return {
    data: [1, 2, 3],
    callbackName: 'logHi', // Return a reference instead
  };
});
```

**Non-cloneable types include:**

- Functions
- DOM nodes
- Error objects (use `{ message, stack }` instead)
- Symbols
- WeakMap/WeakSet

### Timeout Errors

If tasks are timing out unexpectedly:

```typescript
// Increase timeout for long-running operations
const result = await kit.run('heavyComputation', data, {
  timeout: 120000, // 2 minutes
});

// Or set a global default
const kit = new ComputeKit({
  timeout: 60000, // 1 minute default
});
```

### Worker Creation Failures

If workers fail to create, check:

1. **Content Security Policy** - Ensure your CSP allows `worker-src 'self' blob:`
2. **Cross-origin issues** - Workers must be same-origin
3. **Memory limits** - Each worker uses ~2-5MB of memory

---

## Logging Events

Subscribe to ComputeKit events for detailed logging:

```typescript
const kit = new ComputeKit();

kit.on('worker:created', ({ info }) => {
  console.log(`Worker ${info.id} created`);
});

kit.on('worker:error', ({ error, info }) => {
  console.error(`Worker ${info.id} error:`, error);
});

kit.on('task:start', ({ taskId, functionName }) => {
  console.log(`Task ${taskId} started: ${functionName}`);
});

kit.on('task:complete', ({ taskId, duration }) => {
  console.log(`Task ${taskId} completed in ${duration}ms`);
});

kit.on('task:error', ({ taskId, error }) => {
  console.error(`Task ${taskId} failed:`, error);
});

kit.on('task:progress', ({ taskId, progress }) => {
  console.log(`Task ${taskId}: ${progress.percent}%`);
});
```

---

## Pool Statistics

Monitor worker pool health:

```typescript
const stats = kit.getStats();

console.log(stats);
// {
//   workers: [
//     { id: 'w1', state: 'idle', tasksCompleted: 42, errors: 0 },
//     { id: 'w2', state: 'busy', tasksCompleted: 38, errors: 1 },
//   ],
//   totalWorkers: 2,
//   activeWorkers: 1,
//   idleWorkers: 1,
//   queueLength: 0,
//   tasksCompleted: 80,
//   tasksFailed: 1,
//   averageTaskDuration: 145,
// }
```

In React, use the `usePoolStats` hook:

```tsx
function PoolMonitor() {
  const stats = usePoolStats();

  return (
    <div>
      <p>
        Workers: {stats.activeWorkers}/{stats.totalWorkers} active
      </p>
      <p>Queue: {stats.queueLength} pending</p>
      <p>Completed: {stats.tasksCompleted}</p>
      <p>Failed: {stats.tasksFailed}</p>
    </div>
  );
}
```

---

## Debugging Pipelines

For multi-stage pipelines, use the built-in debugging features:

```tsx
const pipeline = usePipeline(stages);

// Get a detailed report
const report = pipeline.getReport();
console.log(report.summary);
console.log(report.timeline);
console.log(report.insights);

// Access metrics
console.log(pipeline.metrics);
// {
//   totalStages: 4,
//   completedStages: 3,
//   failedStages: 1,
//   slowestStage: { id: 'process', duration: 2340 },
//   timeline: [...]
// }

// Check individual stage status
pipeline.stages.forEach((stage) => {
  console.log(`${stage.name}: ${stage.status}`);
  if (stage.error) {
    console.error(`  Error: ${stage.error.message}`);
  }
  if (stage.duration) {
    console.log(`  Duration: ${stage.duration}ms`);
  }
});
```

---

## Getting Help

If you're stuck:

1. Enable `debug: true` and check the console
2. Check the [Common Issues](#common-issues) section
3. Use `forceMainThread: true` to debug on the main thread
4. [Open an issue](https://github.com/pzaino/compute-kit/issues) with:
   - ComputeKit version
   - Browser and version
   - Minimal reproduction code
   - Console output with debug mode enabled
