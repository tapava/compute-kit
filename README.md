<div align="center">
  <img src="./docs/logo.svg" alt="ComputeKit Logo" width="120" />
  
  # ComputeKit
  
  **A tiny toolkit for heavy computations using Web Workers**
  
  *Integration with React hooks and WASM*

[![npm version](https://img.shields.io/npm/v/@computekit/core.svg)](https://www.npmjs.com/package/@computekit/core)
[![Bundle Size Core](https://img.shields.io/bundlephobia/minzip/@computekit/core?label=core%20size)](https://bundlephobia.com/package/@computekit/core)
[![Bundle Size React](https://img.shields.io/bundlephobia/minzip/@computekit/react?label=react%20size)](https://bundlephobia.com/package/@computekit/react)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![MCP Server](https://img.shields.io/badge/MCP-Server-blueviolet)](https://gitmcp.io/tapava/compute-kit)
[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/edit/compute-kit?file=README.md)

[📚 Documentation](https://tapava.github.io/compute-kit) • [Live Demo](https://computekit-demo.vercel.app/) • [Getting Started](#-getting-started) • [Examples](#-examples) • [API](#-api) • [React Hooks](#-react-hooks) • [WASM](#-webassembly-support) • [🤖 MCP Server](#-mcp-server)

</div>

---

## ✨ Features

- 🔄 **Worker pool** : Automatic load balancing across CPU cores
- ⚛️ **React-first** : Provides hooks like `useCompute` with loading, error, and progress states
- 🦀 **WASM integration** : Easily load and call AssemblyScript/Rust WASM modules
- 🚀 **Non-blocking** : Everything runs in Web Workers
- 🔧 **Zero config** : No manual worker files or postMessage handlers
- 📦 **Tiny** : Core library is ~5KB gzipped
- 🎯 **TypeScript** : Full type safety with [typed registry](#-typed-registry) for autocomplete and compile-time checks
- 📊 **Progress tracking** : Built-in progress reporting for long-running tasks

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

## 🎯 When to use this toolkit (And when not to use it)

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
console.log(result); // 12586269025 :  UI never froze!
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

This is where ComputeKit shines : combining `useCompute` with WASM for native-speed performance:

```tsx
import { ComputeKitProvider, useComputeKit, useCompute } from '@computekit/react';
import { useEffect, useRef } from 'react';
import { loadWasm } from './wasmLoader'; // Your WASM loader

// 1. Wrap your app
function App() {
  return (
    <ComputeKitProvider>
      <ImageProcessor />
    </ComputeKitProvider>
  );
}

// 2. Register a WASM-powered compute function
function ImageProcessor() {
  const kit = useComputeKit();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Register a function that uses WASM internally
    kit.register(
      'blurImage',
      async (input: {
        data: number[];
        width: number;
        height: number;
        passes: number;
      }) => {
        const wasm = await loadWasm();
        const { data, width, height, passes } = input;

        // Copy input to WASM memory
        const ptr = wasm.getBufferPtr();
        const wasmMem = new Uint8ClampedArray(wasm.memory.buffer, ptr, data.length);
        wasmMem.set(data);

        // Run WASM blur
        wasm.blurImage(width, height, passes);

        // Return result
        return Array.from(new Uint8ClampedArray(wasm.memory.buffer, ptr, data.length));
      }
    );
  }, [kit]);

  // 3. Use useCompute like any other function!
  const { data, loading, run } = useCompute<
    { data: number[]; width: number; height: number; passes: number },
    number[]
  >('blurImage');

  const handleBlur = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    run({
      data: Array.from(imageData.data),
      width: canvas.width,
      height: canvas.height,
      passes: 100,
    });
  };

  // Update canvas when result arrives
  useEffect(() => {
    if (data && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d')!;
      const imageData = new ImageData(
        new Uint8ClampedArray(data),
        canvas.width,
        canvas.height
      );
      ctx.putImageData(imageData, 0, 0);
    }
  }, [data]);

  return (
    <div>
      <canvas ref={canvasRef} width={256} height={256} />
      <button onClick={handleBlur} disabled={loading}>
        {loading ? 'Processing...' : 'Blur Image (WASM)'}
      </button>
    </div>
  );
}
```

**Key benefits:**

- WASM runs in a Web Worker via `useCompute` : UI stays responsive
- Same familiar `loading`, `data`, `error` pattern as other compute functions
- WASM memory management encapsulated in the registered function
- Can easily add progress reporting, cancellation, etc.

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

## 🏷️ Typed Registry

Get **autocomplete** and **type safety** for your compute functions by extending the `ComputeFunctionRegistry` interface:

```typescript
// Extend the registry (in a .d.ts file or at the top of your file)
declare module '@computekit/core' {
  interface ComputeFunctionRegistry {
    fibonacci: { input: number; output: number };
    sum: { input: number[]; output: number };
  }
}
```

Now you get full type inference:

```typescript
// ✅ Types are inferred - no need for generics!
kit.register('fibonacci', (n) => {
  // n is inferred as number
  if (n <= 1) return n;
  let a = 0,
    b = 1;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
});

const result = await kit.run('fibonacci', 50); // result is number

// ❌ TypeScript error: Argument of type 'string' is not assignable
await kit.run('fibonacci', 'not a number');
```

Works with React hooks too:

```tsx
// Types inferred from registry
const { data, run } = useCompute('fibonacci');
// data: number | null, run: (n: number) => void
```

See the [API Reference](https://tapava.github.io/compute-kit/api-reference#typed-registry) for more details.

---

## 📖 API

### `ComputeKit`

Main class for managing compute operations.

```typescript
const kit = new ComputeKit(options?: ComputeKitOptions);
```

#### Options

| Option               | Type       | Default                         | Description                         |
| -------------------- | ---------- | ------------------------------- | ----------------------------------- |
| `maxWorkers`         | `number`   | `navigator.hardwareConcurrency` | Max workers in the pool             |
| `timeout`            | `number`   | `30000`                         | Default timeout in ms               |
| `debug`              | `boolean`  | `false`                         | Enable debug logging                |
| `remoteDependencies` | `string[]` | `[]`                            | External scripts to load in workers |

### Remote Dependencies

Load external libraries inside your workers:

```typescript
const kit = new ComputeKit({
  remoteDependencies: [
    'https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js',
  ],
});

// Declare the global type for TypeScript support
declare const _: typeof import('lodash');

kit.register('processData', (data: number[]) => {
  return _.chunk(data, 3);
});
```

> ⚠️ **Important: Minification Compatibility**
>
> When using remote dependencies, use `declare const` instead of `import` to ensure compatibility with production minifiers (Vite, esbuild, etc.).
>
> ```typescript
> // ✅ Correct - works after minification
> declare const dayjs: typeof import('dayjs');
> kit.register('format', (d) => dayjs(d).format());
>
> // ❌ Incorrect - breaks after minification
> import dayjs from 'dayjs';
> kit.register('format', (d) => dayjs(d).format());
> ```
>
> This is because minifiers rename imported variables but preserve free variables declared with `declare const`.

````

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
````

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
  status,    // 'idle' | 'running' | 'success' | 'error' | 'cancelled'
  run,       // Function to execute
  reset,     // Reset state
  cancel,    // Cancel current operation
} = useCompute<TInput, TOutput>(functionName, options?);
```

````

### `useComputeCallback`

Returns a memoized async function (similar to `useCallback`).

```typescript
const calculate = useComputeCallback('sum');
const result = await calculate([1, 2, 3, 4, 5]);
````

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

1. **Transfer large data** : Use typed arrays (Uint8Array, Float64Array) for automatic transfer optimization

2. **Batch small operations** : Combine many small tasks into one larger task

3. **Right-size your pool** : More workers ≠ better. Match to CPU cores.

4. **Use WASM for math** : AssemblyScript functions can be 10-100x faster for numeric work

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
│   ├── blur.ts
│   ├── fibonacci.ts
│   ├── mandelbrot.ts
│   ├── matrix.ts
│   └── sum.ts
│
├── examples/
│   └── react-demo/     # React example app
│
└── docs/               # Documentation
```

---

## � MCP Server

This repository has an [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that lets AI assistants access the ComputeKit documentation and codebase directly. Use it as context in tools like **VS Code Copilot**, **Cursor**, **Windsurf**, **Claude Desktop**, and others.

**MCP Server URL:**

```
https://gitmcp.io/tapava/compute-kit
```

### VS Code (GitHub Copilot)

Add the following to your `.vscode/mcp.json` (create the file if it doesn't exist):

```json
{
  "servers": {
    "computekit": {
      "type": "sse",
      "url": "https://gitmcp.io/tapava/compute-kit"
    }
  }
}
```

Alternatively, you can add it to your **User Settings** (`settings.json`):

```json
{
  "mcp": {
    "servers": {
      "computekit": {
        "type": "sse",
        "url": "https://gitmcp.io/tapava/compute-kit"
      }
    }
  }
}
```

### Cursor

Go to **Cursor Settings → MCP** and add a new server:

```json
{
  "mcpServers": {
    "computekit": {
      "url": "https://gitmcp.io/tapava/compute-kit"
    }
  }
}
```

### Windsurf

Add to your `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "computekit": {
      "serverUrl": "https://gitmcp.io/tapava/compute-kit"
    }
  }
}
```

### Claude Desktop

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "computekit": {
      "command": "npx",
      "args": [
        "-y",
        "@anthropic-ai/mcp-proxy@latest",
        "https://gitmcp.io/tapava/compute-kit"
      ]
    }
  }
}
```

> **Config file location:**
>
> - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
> - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

---

## �🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

```bash
# Clone the repo
git clone https://github.com/tapava/compute-kit.git
cd compute-kit

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

MIT © [Ghassen Lassoued](https://github.com/tapava)

---

<div align="center">
  <p>
    <sub>Built with ❤️ for the web platform</sub>
  </p>
  <p>
    <a href="https://tapava.github.io/compute-kit">📚 Read the Docs</a> •
    <a href="https://github.com/tapava/compute-kit">⭐ Star on GitHub</a>
  </p>
</div>
