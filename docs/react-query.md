---
layout: default
title: React Query
nav_order: 7
description: 'React Query integration for ComputeKit'
permalink: /react-query
---

# React Query Integration

{: .no_toc }

Seamlessly integrate ComputeKit with TanStack React Query.
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

```bash
npm install @computekit/core @computekit/react-query @tanstack/react-query
```

---

## Setup

Wrap your app with both providers:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ComputeKitProvider } from '@computekit/react';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ComputeKitProvider>
        <MyApp />
      </ComputeKitProvider>
    </QueryClientProvider>
  );
}
```

---

## useComputeQuery

Use ComputeKit functions with React Query's caching and refetching.

```tsx
import { useComputeQuery } from '@computekit/react-query';

function DataProcessor() {
  const { data, isLoading, error, refetch } = useComputeQuery(
    ['processData', dataId], // Query key
    'heavyProcess', // Function name
    inputData, // Input
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 30 * 60 * 1000, // 30 minutes
    }
  );

  return (
    <div>
      {isLoading && <Spinner />}
      {data && <Results data={data} />}
      <button onClick={() => refetch()}>Refresh</button>
    </div>
  );
}
```

---

## useComputeMutation

For on-demand computations:

```tsx
import { useComputeMutation } from '@computekit/react-query';

function ImageEditor() {
  const mutation = useComputeMutation<ImageInput, ImageOutput>('processImage', {
    onSuccess: (data) => {
      console.log('Processed:', data);
    },
    onError: (error) => {
      console.error('Failed:', error);
    },
  });

  return (
    <div>
      <button onClick={() => mutation.mutate(imageData)} disabled={mutation.isLoading}>
        {mutation.isLoading ? 'Processing...' : 'Apply Filter'}
      </button>
    </div>
  );
}
```

---

## Benefits

| Feature                | Description                                            |
| ---------------------- | ------------------------------------------------------ |
| **Caching**            | Results are cached and reused automatically            |
| **Background Updates** | Stale data is refreshed in the background              |
| **Deduplication**      | Identical queries are deduplicated                     |
| **DevTools**           | Use React Query DevTools to inspect compute operations |
| **Suspense**           | Works with React Suspense for loading states           |

---

## Example: Cached Computation

```tsx
function ExpensiveCalculation({ params }) {
  const { data } = useComputeQuery(['calculate', params], 'expensiveCalc', params, {
    staleTime: Infinity, // Never refetch automatically
    cacheTime: 60 * 60 * 1000, // Keep in cache for 1 hour
  });

  // If the same params are used again, the cached result is returned instantly
  return <Result value={data} />;
}
```
