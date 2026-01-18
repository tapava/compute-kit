---
layout: default
title: Performance & Data Transfer
nav_order: 9
---

# Performance & Data Transfer

{: .no_toc }

Understand data transfer costs, optimize payloads, and get the best performance from ComputeKit.
{: .fs-6 .fw-300 }

## Table of contents

{: .no_toc .text-delta }

1. TOC
   {:toc}

---

## Overview

When using Web Workers, data must be transferred between the main thread and worker threads. Understanding how this works is crucial for optimal performance.

**Key concepts:**

- **Structured Cloning** - Default method; copies data (slow for large payloads)
- **Transferable Objects** - Zero-copy transfer; ownership moves (fast, but original becomes unusable)
- **SharedArrayBuffer** - Shared memory; no transfer needed (fastest, but requires setup)

---

## How Data Transfer Works

### Structured Cloning (Default)

When you pass data to a compute function, JavaScript uses the [Structured Clone Algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm) to copy the data:

```typescript
kit.register('processImages', (images: ImageData[]) => {
  // images is a COPY of the original data
  return images.map((img) => applyFilter(img));
});

// This copies ALL data to the worker, then copies the result back
const result = await kit.run('processImages', largeImageArray);
```

**Performance characteristics:**
| Payload Size | Clone Time (approx) |
|--------------|---------------------|
| 1 KB | < 1ms |
| 100 KB | 1-5ms |
| 1 MB | 10-50ms |
| 10 MB | 100-500ms |
| 100 MB | 1-5 seconds |

{: .warning }

> For payloads over **1 MB**, consider using Transferables or SharedArrayBuffer to avoid cloning overhead.

### What Can Be Cloned?

✅ **Cloneable types:**

- Primitives (strings, numbers, booleans, null, undefined)
- Arrays and typed arrays (Uint8Array, Float32Array, etc.)
- Plain objects
- Map, Set
- Date, RegExp
- Blob, File, FileList
- ImageData
- ArrayBuffer

❌ **NOT cloneable:**

- Functions
- DOM nodes
- Error objects (clone `{ message, stack }` instead)
- Symbols
- WeakMap, WeakSet

---

## Transferable Objects

Transferables use zero-copy transfer by moving ownership of memory:

```typescript
// Input: ArrayBuffer that will be transferred (not copied)
const buffer = new ArrayBuffer(10_000_000); // 10MB

kit.register('processBuffer', (data: ArrayBuffer) => {
  const view = new Uint8Array(data);
  // Process the data...
  return view.buffer; // Return the same buffer (transferred back)
});

// Use the transfer option
const result = await kit.run('processBuffer', buffer, {
  transfer: [buffer], // Transfer ownership to worker
});

// ⚠️ buffer is now "neutered" - unusable on main thread
console.log(buffer.byteLength); // 0
```

### Transferable Types

- `ArrayBuffer`
- `MessagePort`
- `ImageBitmap`
- `OffscreenCanvas`
- `ReadableStream`, `WritableStream`, `TransformStream`

### Automatic Transfer Detection

ComputeKit automatically detects and transfers ArrayBuffers in your return values:

```typescript
kit.register('createBuffer', () => {
  const buffer = new ArrayBuffer(1000000);
  const view = new Float32Array(buffer);
  // Fill with data...
  return buffer; // Automatically transferred back
});

// Result is transferred, not cloned
const result = await kit.run('createBuffer', null);
```

---

## SharedArrayBuffer

For the highest performance, use SharedArrayBuffer to share memory directly:

```typescript
import { ComputeKit } from '@computekit/core';

const kit = new ComputeKit({
  useSharedMemory: true, // Enable SharedArrayBuffer support
});

// Create shared memory
const shared = new SharedArrayBuffer(10_000_000); // 10MB
const view = new Float32Array(shared);

kit.register('processShared', (sharedBuffer: SharedArrayBuffer) => {
  const view = new Float32Array(sharedBuffer);
  // Modify in place - changes visible to main thread!
  for (let i = 0; i < view.length; i++) {
    view[i] = view[i] * 2;
  }
  return { processed: view.length };
});

// No data transfer - just passes a reference
await kit.run('processShared', shared);

// Main thread sees the changes immediately
console.log(view[0]); // Modified value
```

### SharedArrayBuffer Requirements

{: .important }

> SharedArrayBuffer requires specific HTTP headers for security:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

**Vite configuration:**

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
```

**Express configuration:**

```javascript
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});
```

---

## Measuring Payload Size

### Debug Mode Size Reporting

Enable debug mode to see payload sizes in the console:

```typescript
const kit = new ComputeKit({ debug: true });

kit.register('process', (data) => transform(data));

await kit.run('process', largeData);
// Console: [ComputeKit] Task xyz: input=4.2MB, output=3.8MB, duration=145ms
```

### Manual Size Estimation

```typescript
/**
 * Estimate the size of a value for structured cloning
 */
function estimateSize(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'boolean') return 4;
  if (typeof value === 'number') return 8;
  if (typeof value === 'string') return value.length * 2;

  if (value instanceof ArrayBuffer) return value.byteLength;
  if (ArrayBuffer.isView(value)) return value.byteLength;

  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + estimateSize(item), 0);
  }

  if (typeof value === 'object') {
    return Object.entries(value).reduce(
      (sum, [key, val]) => sum + key.length * 2 + estimateSize(val),
      0
    );
  }

  return 0;
}

// Usage
const size = estimateSize(myData);
console.log(`Payload: ${(size / 1024 / 1024).toFixed(2)} MB`);
```

---

## Optimization Strategies

### 1. Minimize Data Transfer

Only send what's needed:

```typescript
// ❌ Sending entire objects
kit.register('processUsers', (users: User[]) => {
  return users.map((u) => ({ id: u.id, score: calculateScore(u.age) }));
});
await kit.run('processUsers', fullUserObjects); // Transfers everything

// ✅ Send only required fields
kit.register('processAges', (ages: number[]) => {
  return ages.map((age) => calculateScore(age));
});
const ages = users.map((u) => u.age);
await kit.run('processAges', ages); // Much smaller payload
```

### 2. Use Typed Arrays

Typed arrays are more efficient than regular arrays:

```typescript
// ❌ Regular array of numbers
const numbers = [1.5, 2.3, 3.7, ...]; // Each number is a JS object

// ✅ Typed array
const numbers = new Float32Array([1.5, 2.3, 3.7, ...]); // Compact binary
```

**Size comparison for 1 million numbers:**
| Type | Approx Size |
|------|-------------|
| `number[]` | ~8-16 MB |
| `Float64Array` | 8 MB |
| `Float32Array` | 4 MB |
| `Int16Array` | 2 MB |
| `Uint8Array` | 1 MB |

### 3. Batch Operations

Reduce transfer overhead by batching:

```typescript
// ❌ Many small transfers
for (const item of items) {
  await kit.run('process', item); // Transfer overhead for each call
}

// ✅ One large transfer
await kit.run('processBatch', items); // Single transfer
```

### 4. Use Transferables for Large ArrayBuffers

```typescript
// Processing a large image
const imageBuffer = await fetchImageAsArrayBuffer(url);

// Transfer instead of clone
const result = await kit.run('processImage', imageBuffer, {
  transfer: [imageBuffer],
});
```

### 5. Return Minimal Results

```typescript
// ❌ Returning large intermediate data
kit.register('analyze', (data: number[]) => {
  const allResults = heavyComputation(data);
  return allResults; // Might be huge
});

// ✅ Return only what's needed
kit.register('analyze', (data: number[]) => {
  const allResults = heavyComputation(data);
  return {
    summary: summarize(allResults),
    count: allResults.length,
    // Don't return allResults unless needed
  };
});
```

---

## Performance Benchmarking

### Built-in Timing

Every compute result includes timing information:

```typescript
const result = await kit.run('myFunction', data);
// Returns: { data: ..., duration: 145, workerId: 'w1', cached: false }
```

### Comparing Strategies

```typescript
async function benchmark() {
  const largeArray = new Float32Array(1_000_000);

  // Strategy 1: Structured clone
  console.time('clone');
  await kit.run('process', largeArray.slice()); // Copy
  console.timeEnd('clone');

  // Strategy 2: Transfer
  console.time('transfer');
  const toTransfer = largeArray.slice();
  await kit.run('process', toTransfer.buffer, {
    transfer: [toTransfer.buffer],
  });
  console.timeEnd('transfer');

  // Strategy 3: Shared memory
  console.time('shared');
  const shared = new SharedArrayBuffer(largeArray.byteLength);
  new Float32Array(shared).set(largeArray);
  await kit.run('processShared', shared);
  console.timeEnd('shared');
}
```

**Typical results (10MB payload):**
| Strategy | Transfer Time | Processing Time |
|----------|---------------|-----------------|
| Clone | ~50-100ms | + computation |
| Transfer | ~1-5ms | + computation |
| Shared | ~0ms | + computation |

---

## When to Use Each Strategy

| Scenario                         | Recommended Approach        |
| -------------------------------- | --------------------------- |
| Small data (< 100KB)             | Structured clone (default)  |
| Large ArrayBuffers               | Transferables               |
| Multiple operations on same data | SharedArrayBuffer           |
| Read-only shared data            | SharedArrayBuffer           |
| Data needed after transfer       | Structured clone            |
| Maximum performance              | SharedArrayBuffer + Atomics |

---

## Avoiding Common Pitfalls

### Pitfall 1: Accidental Large Clones

```typescript
// ❌ Accidentally including large data
const context = {
  config: { threshold: 0.5 },
  cache: hugeCache, // Oops! This gets cloned
};
await kit.run('process', context);

// ✅ Send only what's needed
await kit.run('process', { threshold: 0.5 });
```

### Pitfall 2: Using Transferred Data

```typescript
const buffer = new ArrayBuffer(1000);
await kit.run('process', buffer, { transfer: [buffer] });

// ❌ Error! Buffer is neutered
console.log(buffer.byteLength); // 0

// ✅ Copy first if you need the original
const copy = buffer.slice();
await kit.run('process', buffer, { transfer: [buffer] });
console.log(copy.byteLength); // 1000
```

### Pitfall 3: Circular References

```typescript
// ❌ Circular reference - can't be cloned
const obj: any = { name: 'test' };
obj.self = obj;
await kit.run('process', obj); // Error!

// ✅ Remove circular references first
const { self, ...safeObj } = obj;
await kit.run('process', safeObj);
```

---

## Summary

1. **Under 100KB**: Don't worry about it, structured cloning is fine
2. **100KB - 1MB**: Consider typed arrays and minimal payloads
3. **Over 1MB**: Use Transferables for ArrayBuffers
4. **Repeated operations**: Use SharedArrayBuffer
5. **Always measure**: Enable `debug: true` to see actual payload sizes
