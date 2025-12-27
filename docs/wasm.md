---
layout: default
title: WebAssembly
nav_order: 5
description: 'WASM integration with ComputeKit'
permalink: /wasm
---

# WebAssembly Integration

{: .no_toc }

Use WASM for native-speed performance in your compute functions.
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

ComputeKit provides seamless WebAssembly integration, allowing you to:

- Load WASM modules from URLs, ArrayBuffers, or base64 strings
- Use AssemblyScript for easy TypeScript-to-WASM compilation
- Combine WASM with Web Workers for maximum performance
- Manage WASM memory efficiently

---

## WASM Utilities

### loadWasmModule()

Load a WASM module from various sources.

```typescript
import { loadWasmModule } from '@computekit/core';

// From URL
const module = await loadWasmModule('/path/to/module.wasm');

// From ArrayBuffer
const bytes = await fetch('/module.wasm').then((r) => r.arrayBuffer());
const module = await loadWasmModule(bytes);

// From base64
const module = await loadWasmModule('data:application/wasm;base64,...');
```

### loadAndInstantiate()

Load and instantiate a WASM module with custom imports.

```typescript
import { loadAndInstantiate } from '@computekit/core';

const { module, instance } = await loadAndInstantiate({
  source: '/module.wasm',
  imports: {
    env: {
      log: (value: number) => console.log(value),
      abort: () => {
        throw new Error('WASM abort');
      },
    },
  },
  memory: {
    initial: 256, // 256 pages = 16MB
    maximum: 512, // 512 pages = 32MB
    shared: true, // Use SharedArrayBuffer
  },
});

// Call exported functions
const result = instance.exports.compute(42);
```

### loadAssemblyScript()

Load an AssemblyScript-compiled WASM module with default imports.

```typescript
import { loadAssemblyScript } from '@computekit/core';

const { exports } = await loadAssemblyScript('/as-module.wasm');

// Call exported functions directly
const sum = exports.computeSum(new Int32Array([1, 2, 3, 4, 5]));
```

---

## Memory Utilities

### getMemoryView()

Create a typed array view into WASM memory.

```typescript
import { getMemoryView } from '@computekit/core';

const view = getMemoryView(memory, Float64Array, 0, 100);
// Now you can read/write to WASM memory through `view`
```

### copyToWasmMemory()

Copy data to WASM memory.

```typescript
import { copyToWasmMemory } from '@computekit/core';

const data = new Uint8Array([1, 2, 3, 4]);
copyToWasmMemory(wasmMemory, data, 0);
```

### copyFromWasmMemory()

Copy data from WASM memory.

```typescript
import { copyFromWasmMemory } from '@computekit/core';

const result = copyFromWasmMemory(wasmMemory, 0, 4);
// Uint8Array([1, 2, 3, 4])
```

---

## Cache Management

### clearWasmCache()

Clear the WASM module cache.

```typescript
import { clearWasmCache } from '@computekit/core';

clearWasmCache();
```

### getWasmCacheStats()

Get WASM cache statistics.

```typescript
import { getWasmCacheStats } from '@computekit/core';

const stats = getWasmCacheStats();
console.log(`Cached modules: ${stats.modules}`);
console.log(`Cached instances: ${stats.instances}`);
```

---

## AssemblyScript Guide

### 1. Write AssemblyScript

Create an AssemblyScript file with your compute functions:

```typescript
// compute/sum.ts
export function sum(arr: Int32Array): i32 {
  let total: i32 = 0;
  for (let i = 0; i < arr.length; i++) {
    total += unchecked(arr[i]);
  }
  return total;
}

export function fibonacci(n: i32): i64 {
  if (n <= 1) return n as i64;
  let a: i64 = 0;
  let b: i64 = 1;
  for (let i: i32 = 2; i <= n; i++) {
    let temp = a + b;
    a = b;
    b = temp;
  }
  return b;
}
```

### 2. Install AssemblyScript

```bash
npm install --save-dev assemblyscript
npx asinit .
```

### 3. Compile to WASM

```bash
npx asc compute/sum.ts -o public/sum.wasm --optimize
```

Or add a script to `package.json`:

```json
{
  "scripts": {
    "build:wasm": "asc compute/sum.ts -o public/sum.wasm --optimize"
  }
}
```

### 4. Use in ComputeKit

```typescript
import { ComputeKit, loadAssemblyScript } from '@computekit/core';

const kit = new ComputeKit();

kit.register('wasmSum', async (data: number[]) => {
  const { exports } = await loadAssemblyScript('/sum.wasm');
  const arr = new Int32Array(data);
  return exports.sum(arr);
});

const result = await kit.run('wasmSum', [1, 2, 3, 4, 5]);
console.log(result); // 15
```

---

## React + WASM Example

Combine `useCompute` with WASM for the ultimate performance:

```tsx
import { ComputeKitProvider, useComputeKit, useCompute } from '@computekit/react';
import { loadAssemblyScript } from '@computekit/core';
import { useEffect, useRef } from 'react';

function App() {
  return (
    <ComputeKitProvider>
      <ImageProcessor />
    </ComputeKitProvider>
  );
}

function ImageProcessor() {
  const kit = useComputeKit();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Register WASM-powered blur function
    kit.register(
      'blurImage',
      async (input: {
        data: number[];
        width: number;
        height: number;
        passes: number;
      }) => {
        const { exports, memory } = await loadAssemblyScript('/blur.wasm');
        const { data, width, height, passes } = input;

        // Copy input to WASM memory
        const ptr = exports.getBufferPtr();
        const wasmMem = new Uint8ClampedArray(memory.buffer, ptr, data.length);
        wasmMem.set(data);

        // Run WASM blur
        exports.blurImage(width, height, passes);

        // Return result
        return Array.from(new Uint8ClampedArray(memory.buffer, ptr, data.length));
      }
    );
  }, [kit]);

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
      passes: 10,
    });
  };

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

---

## Performance Tips

{: .note }
WASM functions can be 10-100x faster than JavaScript for numeric computations.

1. **Minimize memory copies** - Use typed arrays and transfer data efficiently
2. **Batch operations** - Process large chunks of data at once
3. **Use SIMD** - AssemblyScript supports SIMD for parallel math operations
4. **Pre-allocate memory** - Avoid growing WASM memory during computation

```typescript
// ❌ Slow: Many small WASM calls
for (const pixel of pixels) {
  wasm.processPixel(pixel);
}

// ✅ Fast: One batched WASM call
wasm.processAllPixels(pixelBuffer, width, height);
```

---

## Browser Support

| Browser     | WASM | SharedArrayBuffer |
| ----------- | ---- | ----------------- |
| Chrome 57+  | ✅   | ✅ (with headers) |
| Firefox 52+ | ✅   | ✅ (with headers) |
| Safari 11+  | ✅   | ✅ (Safari 15.2+) |
| Edge 16+    | ✅   | ✅ (with headers) |

{: .warning }
SharedArrayBuffer requires Cross-Origin Isolation headers. See the [Getting Started]({{ site.baseurl }}/getting-started#vitepwebpack-configuration) guide for configuration.
