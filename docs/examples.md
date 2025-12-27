---
layout: default
title: Examples
nav_order: 6
description: 'Real-world examples using ComputeKit'
permalink: /examples
---

# Examples

{: .no_toc }

Real-world examples demonstrating ComputeKit's capabilities.
{: .fs-6 .fw-300 }

<!-- prettier-ignore -->
<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Basic Examples

### Fibonacci Sequence

Calculate large Fibonacci numbers without freezing the UI:

```typescript
import { ComputeKit } from '@computekit/core';

const kit = new ComputeKit();

kit.register('fibonacci', (n: number) => {
  if (n <= 1) return n;
  let a = 0n,
    b = 1n;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b.toString();
});

// Calculate fib(1000) without blocking
const result = await kit.run('fibonacci', 1000);
console.log(result); // Very large number!
```

### Sum Large Array

Process millions of items without blocking:

```typescript
kit.register('sum', (arr: number[]) => {
  return arr.reduce((a, b) => a + b, 0);
});

const bigArray = Array.from({ length: 10_000_000 }, () => Math.random());
const sum = await kit.run('sum', bigArray);
console.log(sum);
```

---

## Image Processing

### Grayscale Conversion

```typescript
kit.register('grayscale', (imageData: number[]) => {
  const result = new Uint8ClampedArray(imageData.length);

  for (let i = 0; i < imageData.length; i += 4) {
    const avg = (imageData[i] + imageData[i + 1] + imageData[i + 2]) / 3;
    result[i] = avg; // R
    result[i + 1] = avg; // G
    result[i + 2] = avg; // B
    result[i + 3] = imageData[i + 3]; // A (preserve alpha)
  }

  return Array.from(result);
});

// Usage with Canvas
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

const grayscaleData = await kit.run('grayscale', Array.from(imageData.data));
const newImageData = new ImageData(
  new Uint8ClampedArray(grayscaleData),
  canvas.width,
  canvas.height
);
ctx.putImageData(newImageData, 0, 0);
```

### Image Blur with Progress

```typescript
kit.register('blur', async (input, { reportProgress }) => {
  const { data, width, height, radius } = input;
  const result = new Uint8ClampedArray(data.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0,
        g = 0,
        b = 0,
        count = 0;

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;

          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const i = (ny * width + nx) * 4;
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
          }
        }
      }

      const i = (y * width + x) * 4;
      result[i] = r / count;
      result[i + 1] = g / count;
      result[i + 2] = b / count;
      result[i + 3] = data[i + 3];
    }

    // Report progress every row
    if (y % 10 === 0) {
      reportProgress({ percent: (y / height) * 100 });
    }
  }

  return Array.from(result);
});
```

---

## Data Processing

### CSV Parsing

```typescript
kit.register('parseCSV', (csv: string) => {
  const lines = csv.split('\n');
  const headers = lines[0].split(',').map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(',');
    return headers.reduce(
      (obj, header, i) => {
        obj[header] = values[i]?.trim();
        return obj;
      },
      {} as Record<string, string>
    );
  });
});

const csvData = await fetch('/large-data.csv').then((r) => r.text());
const parsed = await kit.run('parseCSV', csvData);
```

### JSON Processing with Progress

```typescript
kit.register('processRecords', async (records, { reportProgress }) => {
  const total = records.length;
  const results = [];

  for (let i = 0; i < total; i++) {
    // Expensive processing
    const processed = {
      ...records[i],
      score: calculateScore(records[i]),
      category: categorize(records[i]),
    };
    results.push(processed);

    // Report every 1000 records
    if (i % 1000 === 0) {
      reportProgress({
        percent: (i / total) * 100,
        phase: 'Processing',
        data: { processed: i, total },
      });
    }
  }

  return results;
});
```

---

## Mathematical Computations

### Mandelbrot Set

```typescript
kit.register(
  'mandelbrot',
  (config: {
    width: number;
    height: number;
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    maxIterations: number;
  }) => {
    const { width, height, xMin, xMax, yMin, yMax, maxIterations } = config;
    const data = new Uint8Array(width * height * 4);

    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const x0 = xMin + (px / width) * (xMax - xMin);
        const y0 = yMin + (py / height) * (yMax - yMin);

        let x = 0,
          y = 0;
        let iteration = 0;

        while (x * x + y * y <= 4 && iteration < maxIterations) {
          const xTemp = x * x - y * y + x0;
          y = 2 * x * y + y0;
          x = xTemp;
          iteration++;
        }

        const i = (py * width + px) * 4;
        const color = iteration === maxIterations ? 0 : (iteration / maxIterations) * 255;

        data[i] = color;
        data[i + 1] = color * 0.5;
        data[i + 2] = color * 2;
        data[i + 3] = 255;
      }
    }

    return Array.from(data);
  }
);
```

### Matrix Multiplication

```typescript
kit.register('matrixMultiply', (input: { a: number[][]; b: number[][] }) => {
  const { a, b } = input;
  const rows = a.length;
  const cols = b[0].length;
  const n = b.length;

  const result: number[][] = Array(rows)
    .fill(null)
    .map(() => Array(cols).fill(0));

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      for (let k = 0; k < n; k++) {
        result[i][j] += a[i][k] * b[k][j];
      }
    }
  }

  return result;
});
```

---

## React Examples

### Debounced Search with Compute

```tsx
import { useCompute } from '@computekit/react';
import { useState, useMemo } from 'react';
import { useDebouncedValue } from './hooks';

function SearchComponent() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);

  const { data: results, loading } = useCompute<{ query: string; items: Item[] }, Item[]>(
    'fuzzySearch',
    {
      runOnMount: false,
    }
  );

  // Register the fuzzy search function
  useEffect(() => {
    kit.register('fuzzySearch', ({ query, items }) => {
      return items
        .filter(
          (item) =>
            item.name.toLowerCase().includes(query.toLowerCase()) ||
            item.description.toLowerCase().includes(query.toLowerCase())
        )
        .sort((a, b) => {
          // Score by relevance
          const aScore = getMatchScore(a, query);
          const bScore = getMatchScore(b, query);
          return bScore - aScore;
        });
    });
  }, []);

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
      />
      {loading && <Spinner />}
      {results?.map((item) => (
        <ItemCard key={item.id} item={item} />
      ))}
    </div>
  );
}
```

### Real-time Data Visualization

```tsx
function DataVisualization() {
  const { data, loading, run } = useCompute<number[], ChartData>('processData');
  const stats = usePoolStats(500);

  useEffect(() => {
    const interval = setInterval(() => {
      const newData = generateRandomData(10000);
      run(newData);
    }, 1000);

    return () => clearInterval(interval);
  }, [run]);

  return (
    <div>
      <div className="stats">
        Workers: {stats.activeWorkers}/{stats.totalWorkers}
      </div>
      {loading && <LoadingOverlay />}
      {data && <Chart data={data} />}
    </div>
  );
}
```

---

## Using External Libraries

Load external libraries inside workers:

```typescript
const kit = new ComputeKit({
  remoteDependencies: [
    'https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/mathjs/11.8.0/math.min.js',
  ],
});

kit.register('advancedMath', (expression: string) => {
  // @ts-ignore - math.js loaded via importScripts
  return math.evaluate(expression);
});

kit.register('processData', (data: number[]) => {
  // @ts-ignore - lodash loaded via importScripts
  return _.chain(data)
    .filter((n) => n > 0)
    .map((n) => n * 2)
    .sortBy()
    .value();
});

const result = await kit.run('advancedMath', 'sqrt(16) + sin(pi/2)');
console.log(result); // 5
```

---

## Live Demo

Try the interactive demo:

[View Live Demo]({{ site.baseurl }}/demo.html){: .btn .btn-primary }
