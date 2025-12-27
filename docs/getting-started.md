---
layout: default
title: Getting Started
nav_order: 2
description: 'Get started with ComputeKit in minutes'
permalink: /getting-started
---

# Getting Started

{: .no_toc }

Get up and running with ComputeKit in just a few minutes.
{: .fs-6 .fw-300 }

<!-- prettier-ignore -->
<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Installation

### Core Package

```bash
npm install @computekit/core
```

### With React Bindings

```bash
npm install @computekit/core @computekit/react
```

### With React Query Integration

```bash
npm install @computekit/core @computekit/react-query @tanstack/react-query
```

---

## Basic Usage

### Vanilla JavaScript/TypeScript

```typescript
import { ComputeKit } from '@computekit/core';

// Create an instance
const kit = new ComputeKit();

// Register compute functions
kit.register('fibonacci', (n: number) => {
  if (n <= 1) return n;
  let a = 0,
    b = 1;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
});

kit.register('sum', (arr: number[]) => {
  return arr.reduce((a, b) => a + b, 0);
});

// Run computations (non-blocking!)
const fib = await kit.run('fibonacci', 50);
console.log(fib); // 12586269025

const total = await kit.run('sum', [1, 2, 3, 4, 5]);
console.log(total); // 15
```

### React

```tsx
import { ComputeKitProvider, useComputeKit, useCompute } from '@computekit/react';
import { useEffect } from 'react';

// Wrap your app
function App() {
  return (
    <ComputeKitProvider>
      <MyApp />
    </ComputeKitProvider>
  );
}

// Register functions once
function MyApp() {
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

// Use in components
function Calculator() {
  const { data, loading, error, run } = useCompute<number, number>('fibonacci');

  return (
    <div>
      <button onClick={() => run(50)} disabled={loading}>
        {loading ? 'Computing...' : 'Calculate'}
      </button>
      {data && <p>Result: {data}</p>}
      {error && <p>Error: {error.message}</p>}
    </div>
  );
}
```

---

## Configuration Options

```typescript
const kit = new ComputeKit({
  // Maximum number of workers in the pool
  maxWorkers: navigator.hardwareConcurrency || 4,

  // Default timeout for operations (ms)
  timeout: 30000,

  // Enable debug logging
  debug: false,

  // Custom worker script path
  workerPath: '',

  // Use SharedArrayBuffer when available
  useSharedMemory: true,

  // External scripts to load in workers
  remoteDependencies: [
    'https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js',
  ],
});
```

---

## Vite/Webpack Configuration

For SharedArrayBuffer support, you need to add COOP/COEP headers:

### Vite

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

### Webpack (Next.js)

```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ];
  },
};
```

---

## Next Steps

- Learn about [React Hooks]({{ site.baseurl }}/react-hooks) for the full React experience
- Check the [API Reference]({{ site.baseurl }}/api-reference) for all available methods
- Explore [WASM integration]({{ site.baseurl }}/wasm) for maximum performance
- See [Examples]({{ site.baseurl }}/examples) for real-world use cases
