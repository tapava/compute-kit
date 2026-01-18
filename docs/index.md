---
layout: home
title: Home
nav_order: 1
description: 'ComputeKit - The React-first toolkit for WASM and Web Workers'
permalink: /
---

<div align="center">
  <img src="{{ site.baseurl }}/assets/logo.svg" alt="ComputeKit Logo" width="120" />
</div>

# ComputeKit

{: .fs-9 }

A tiny toolkit for heavy computations using Web Workers
{: .fs-6 .fw-300 }

Integration with React hooks and WASM.
{: .fs-5 .fw-300 }

[Get Started](#getting-started){: .btn .btn-primary .fs-5 .mb-4 .mb-md-0 .mr-2 }
[View on GitHub](https://github.com/tapava/compute-kit){: .btn .fs-5 .mb-4 .mb-md-0 }
[Try on StackBlitz](https://stackblitz.com/edit/compute-kit?file=README.md){: .btn .btn-outline .fs-5 .mb-4 .mb-md-0 }

---

## ✨ Features

| Feature                      | Description                                                                    |
| :--------------------------- | :----------------------------------------------------------------------------- |
| ⚛️ **React-first**           | Purpose-built hooks like `useCompute` with loading, error, and progress states |
| 🦀 **WASM integration**      | Load and call AssemblyScript/Rust WASM modules with zero boilerplate           |
| 🚀 **Non-blocking**          | Everything runs in Web Workers                                                 |
| 🔧 **Zero config**           | No manual worker files, postMessage handlers, or WASM glue code                |
| 📦 **Tiny**                  | Core library is ~5KB gzipped                                                   |
| 🎯 **TypeScript**            | Full type safety for your compute functions and WASM bindings                  |
| 🔄 **Worker pool**           | Automatic load balancing across CPU cores                                      |
| 📊 **Progress tracking**     | Built-in progress reporting for long-running tasks                             |
| 🔗 **Multi-stage pipelines** | Chain compute operations with `usePipeline` for complex workflows              |

---

## 🤔 Why ComputeKit?

You _can_ use Web Workers and WASM without a library. But here's the reality:

| Task                  | Without ComputeKit                                                  | With ComputeKit                    |
| --------------------- | ------------------------------------------------------------------- | ---------------------------------- |
| Web Worker setup      | Create separate `.js` files, handle `postMessage`, manage callbacks | `kit.register('fn', myFunc)`       |
| WASM loading          | Fetch, instantiate, memory management, glue code                    | `await loadWasmModule('/my.wasm')` |
| React integration     | Manual state, effects, cleanup, abort handling                      | `useCompute()` hook                |
| Worker pooling        | Build your own pool, queue, and load balancer                       | Built-in                           |
| Multi-stage workflows | Manual chaining, error handling per stage, retry logic              | `usePipeline()` hook               |
| TypeScript            | Tricky worker typing, no WASM types                                 | Full type inference                |
| Error handling        | Try-catch across message boundaries                                 | Automatic with React error states  |

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
| Multi-file processing pipelines    | Simple single-step tasks     |

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

## Getting Started

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
console.log(result); // 12586269025 (UI never froze!)
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

---

## Quick Links

- [Getting Started Guide]({{ site.baseurl }}/getting-started)
- [React Hooks Reference]({{ site.baseurl }}/react-hooks)
- [Multi-Stage Pipelines]({{ site.baseurl }}/pipeline)
- [Debugging Guide]({{ site.baseurl }}/debugging)
- [Performance & Data Transfer]({{ site.baseurl }}/performance)
- [API Reference]({{ site.baseurl }}/api-reference)
- [WASM Guide]({{ site.baseurl }}/wasm)
- [Examples]({{ site.baseurl }}/examples)

---

## 📄 License

MIT © [Ghassen Lassoued](https://github.com/tapava)
