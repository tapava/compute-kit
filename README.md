<div align="center">
  <img src="./docs/logo.svg" alt="ComputeKit Logo" width="120" />
  
  # ComputeKit
  
  **The React-first toolkit for WASM and Web Workers**
  
  *Run heavy computations with React hooks. Use WASM for native-speed performance. Keep your UI at 60fps.*

[![npm version](https://img.shields.io/npm/v/@computekit/core.svg)](https://www.npmjs.com/package/@computekit/core)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@computekit/core)](https://bundlephobia.com/package/@computekit/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)

[Getting Started](#-getting-started) • [Examples](#-examples) • [API](#-api) • [React Hooks](#-react-hooks) • [WASM](#-webassembly-support)

</div>

---

## ✨ Features

- ⚛️ **React-first** — Purpose-built hooks like `useCompute` with loading, error, and progress states
- 🦀 **WASM integration** — Load and call AssemblyScript/Rust WASM modules with zero boilerplate
- 🚀 **Non-blocking** — Everything runs in Web Workers, keeping your UI at 60fps
- 🔧 **Zero config** — No manual worker files, postMessage handlers, or WASM glue code
- 📦 **Tiny** — Core library is ~3KB gzipped
- 🎯 **TypeScript** — Full type safety for your compute functions and WASM bindings
- 🔄 **Worker pool** — Automatic load balancing across CPU cores
- 📊 **Progress tracking** — Built-in progress reporting for long-running tasks

---

## 🤔 Why ComputeKit?

You _can_ use Web Workers and WASM without a library. But here's the reality:

| Task              | Without ComputeKit                                                  | With ComputeKit                    |
| ----------------- | ------------------------------------------------------------------- | ---------------------------------- |
| Web Worker setup  | Create separate `.js` files, handle `postMessage`, manage callbacks | `kit.register('fn', myFunc)`       |
| WASM loading      | Fetch, instantiate, memory management, glue code                    | `await loadWasmModule('/my.wasm')` |
| React integration | Manual state, effects, cleanup, abort handling                      | `useCompute()` hook                |
| Worker pooling    | Build your own pool, queue, and load balancer                       | Built-in                           |
| TypeScript        | Tricky worker typing, no WASM types                                 | Full type inference                |
| Error handling    | Try-catch across message boundaries                                 | Automatic with React error states  |

**ComputeKit's unique value:** The only library that combines **React hooks + WASM + Worker pool** into one cohesive, type-safe developer experience.

---

## 🎯 When to use ComputeKit

| ✅ Use ComputeKit                  | ❌ Don't use ComputeKit      |
| ---------------------------------- | ---------------------------- |
| Image/video processing             | Simple DOM updates           |
| Data transformations (100K+ items) | Small array operations       |
| Mathematical computations          | API calls (use native fetch) |
| Parsing large files                | String formatting            |
| Cryptographic operations           | UI state management          |
| Real-time data analysis            | Small form validations       |

---

## 📦 Installation

```bash
# npm
npm install @computekit/core

# With React bindings
npm install @computekit/core @computekit/react

# pnpm
pnpm add @computekit/core @computekit/react

# yarn
yarn add @computekit/core @computekit/react
```

---

## 🚀 Getting Started

### Basic Usage (Vanilla JS)

```typescript
import { ComputeKit } from '@computekit/core';

// 1. Create a ComputeKit instance
const kit = new ComputeKit();

// 2. Register a compute function
kit.register('fibonacci', (n: number) => {
  if (n <= 1) return n;
  let a = 0,
    b = 1;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
});

// 3. Run it (non-blocking!)
const result = await kit.run('fibonacci', 50);
console.log(result); // 12586269025 — UI never froze!
```

### React Usage

```tsx
import { ComputeKitProvider, useComputeKit, useCompute } from '@computekit/react';
import { useEffect } from 'react';

// 1. Wrap your app with the provider
function App() {
  return (
    <ComputeKitProvider>
      <AppContent />
    </ComputeKitProvider>
  );
}

// 2. Register functions at the app level
function AppContent() {
  const kit = useComputeKit();

  useEffect(() => {
    // Register your compute functions once
    kit.register('fibonacci', (n: number) => {
      if (n <= 1) return n;
      let a = 0,
        b = 1;
      for (let i = 2; i <= n; i++) {
        [a, b] = [b, a + b];
      }
      return b;
    });
  }, [kit]);

  return <Calculator />;
}

// 3. Use the hook in any component
function Calculator() {
  const { data, loading, error, run } = useCompute<number, number>('fibonacci');

  return (
    <div>
      <button onClick={() => run(50)} disabled={loading}>
        {loading ? 'Computing...' : 'Calculate Fibonacci(50)'}
      </button>
      {data && <p>Result: {data}</p>}
      {error && <p>Error: {error.message}</p>}
    </div>
  );
}
```

### React + WASM (Full Example)

This is where ComputeKit shines — using WASM for compute-heavy operations with React hooks:

```tsx
// 1. Your AssemblyScript WASM module (compile with: npx asc blur.ts -o blur.wasm -O3)
// blur.ts:
// export function blurImage(width: i32, height: i32, passes: i32): void { ... }

// 2. Your React component
import { useEffect, useRef, useState } from 'react';

// Load WASM module (generated loader or manual instantiation)
import * as wasmModule from './wasmLoader';

function ImageBlur() {
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const runBlur = async () => {
    setLoading(true);

    // Get image data from canvas
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Copy to WASM memory
    const ptr = wasmModule.getBufferPtr();
    const wasmMemory = new Uint8ClampedArray(
      wasmModule.memory.buffer,
      ptr,
      imageData.data.length
    );
    wasmMemory.set(imageData.data);

    // Run WASM blur (this is the fast part!)
    const start = performance.now();
    wasmModule.blurImage(canvas.width, canvas.height, 100); // 100 blur passes
    setTime(performance.now() - start);

    // Copy result back to canvas
    const result = new Uint8ClampedArray(
      wasmModule.memory.buffer,
      ptr,
      imageData.data.length
    );
    const newImageData = new ImageData(
      new Uint8ClampedArray(result),
      canvas.width,
      canvas.height
    );
    ctx.putImageData(newImageData, 0, 0);

    setLoading(false);
  };

  return (
    <div>
      <canvas ref={canvasRef} width={256} height={256} />
      <button onClick={runBlur} disabled={loading}>
        {loading ? 'Processing...' : 'Blur Image (WASM)'}
      </button>
      {time && <p>Completed in {time.toFixed(2)}ms</p>}
    </div>
  );
}
```

**Why is this better than raw WASM?**

- No manual `WebAssembly.instantiate()` boilerplate
- Memory management handled for you
- React-friendly with hooks and state
- Type-safe WASM function calls

---

## 📚 Examples

### Sum Large Array

```typescript
kit.register('sum', (arr: number[]) => {
  return arr.reduce((a, b) => a + b, 0);
});

const bigArray = Array.from({ length: 10_000_000 }, () => Math.random());
const sum = await kit.run('sum', bigArray);
```

### Image Processing

```typescript
kit.register('grayscale', (imageData: Uint8ClampedArray) => {
  const result = new Uint8ClampedArray(imageData.length);
  for (let i = 0; i < imageData.length; i += 4) {
    const avg = (imageData[i] + imageData[i + 1] + imageData[i + 2]) / 3;
    result[i] = result[i + 1] = result[i + 2] = avg;
    result[i + 3] = imageData[i + 3]; // Alpha
  }
  return result;
});
```

### With Progress Reporting

```typescript
kit.register('longTask', async (data, { reportProgress }) => {
  const total = data.items.length;
  const results = [];

  for (let i = 0; i < total; i++) {
    results.push(process(data.items[i]));
    if (i % 100 === 0) {
      reportProgress({ percent: (i / total) * 100 });
    }
  }

  return results;
});

// React: track progress
const { progress, run } = useCompute('longTask', {
  onProgress: (p) => console.log(`${p.percent}% complete`),
});
```

---

## 📖 API

### `ComputeKit`

Main class for managing compute operations.

```typescript
const kit = new ComputeKit(options?: ComputeKitOptions);
```

#### Options

| Option       | Type      | Default                         | Description             |
| ------------ | --------- | ------------------------------- | ----------------------- |
| `maxWorkers` | `number`  | `navigator.hardwareConcurrency` | Max workers in the pool |
| `timeout`    | `number`  | `30000`                         | Default timeout in ms   |
| `debug`      | `boolean` | `false`                         | Enable debug logging    |

#### Methods

| Method                       | Description                   |
| ---------------------------- | ----------------------------- |
| `register(name, fn)`         | Register a compute function   |
| `run(name, input, options?)` | Execute a function            |
| `getStats()`                 | Get pool statistics           |
| `terminate()`                | Cleanup and terminate workers |

### Compute Options

```typescript
await kit.run('myFunction', data, {
  timeout: 5000, // Override default timeout
  priority: 10, // Higher = runs first (0-10)
  signal: abortController.signal, // Abort support
  onProgress: (p) => {}, // Progress callback
});
```

---

## ⚛️ React Hooks

### `useCompute`

Primary hook for running compute functions.

```typescript
const {
  data,      // Result data
  loading,   // Boolean loading state
  error,     // Error if failed
  progress,  // Progress info
  run,       // Function to execute
  reset,     // Reset state
  cancel,    // Cancel current operation
} = useCompute<TInput, TOutput>(functionName, options?);
```

### `useComputeCallback`

Returns a memoized async function (similar to `useCallback`).

```typescript
const calculate = useComputeCallback('sum');
const result = await calculate([1, 2, 3, 4, 5]);
```

### `usePoolStats`

Monitor worker pool performance.

```typescript
const stats = usePoolStats(1000); // Refresh every 1s
// stats.activeWorkers, stats.queueLength, stats.averageTaskDuration
```

### `useComputeFunction`

Register and use a function in one hook.

```typescript
const { run, data } = useComputeFunction('double', (n: number) => n * 2);
```

---

## 🦀 WebAssembly Support

ComputeKit supports WASM via AssemblyScript for maximum performance.

### 1. Write AssemblyScript

```typescript
// compute/sum.ts
export function sum(arr: Int32Array): i32 {
  let total: i32 = 0;
  for (let i = 0; i < arr.length; i++) {
    total += unchecked(arr[i]);
  }
  return total;
}
```

### 2. Compile

```bash
npx asc compute/sum.ts -o compute/sum.wasm --optimize
```

### 3. Load WASM

```typescript
import { loadWasmModule } from '@computekit/core';

const wasmModule = await loadWasmModule('/compute/sum.wasm');
// Use with your compute functions
```

---

## ⚡ Performance Tips

1. **Transfer large data** — Use typed arrays (Uint8Array, Float64Array) for automatic transfer optimization

2. **Batch small operations** — Combine many small tasks into one larger task

3. **Right-size your pool** — More workers ≠ better. Match to CPU cores.

4. **Use WASM for math** — AssemblyScript functions can be 10-100x faster for numeric work

```typescript
// ❌ Slow: Many small calls
for (const item of items) {
  await kit.run('process', item);
}

// ✅ Fast: One batched call
await kit.run('processBatch', items);
```

---

## 🔧 Advanced Configuration

### Custom Worker Path

```typescript
const kit = new ComputeKit({
  workerPath: '/workers/compute-worker.js',
});
```

### Vite/Webpack Setup

For SharedArrayBuffer support, add these headers:

```typescript
// vite.config.ts
export default {
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
};
```

---

## 🗂️ Project Structure

```
computekit/
├── packages/
│   ├── core/           # @computekit/core
│   │   ├── src/
│   │   │   ├── index.ts       # Main exports
│   │   │   ├── pool.ts        # Worker pool
│   │   │   ├── wasm.ts        # WASM utilities
│   │   │   └── types.ts       # TypeScript types
│   │   └── package.json
│   │
│   └── react/          # @computekit/react
│       ├── src/
│       │   └── index.ts       # React hooks
│       └── package.json
│
├── compute/            # AssemblyScript functions
│   ├── fibonacci.ts
│   ├── mandelbrot.ts
│   └── matrix.ts
│
├── examples/
│   ├── react-demo/     # React example app
│   └── vanilla-demo/   # Vanilla JS example
│
└── docs/               # Documentation
```

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

```bash
# Clone the repo
git clone https://github.com/your-username/computekit.git
cd computekit

# Install dependencies
npm install

# Build all packages
npm run build

# Run React demo
npm run dev

# Run tests
npm test
```

---

## 📄 License

MIT © [Your Name](https://github.com/your-username)

---

<div align="center">
  <p>
    <sub>Built with ❤️ for the web platform</sub>
  </p>
  <p>
    <a href="https://github.com/your-username/computekit">⭐ Star on GitHub</a>
  </p>
</div>
