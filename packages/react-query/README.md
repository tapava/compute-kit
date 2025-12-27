# @computekit/react-query

TanStack Query integration for [ComputeKit](https://github.com/tapava/compute-kit) - run heavy computations in Web Workers with automatic caching, background refetching, and all the goodies from React Query.

## Why?

If you're already using TanStack Query (React Query), this package lets you use ComputeKit as a "fetcher" while React Query handles:

- ✅ Caching & deduplication
- ✅ Background refetching
- ✅ Stale-while-revalidate
- ✅ Retry logic
- ✅ DevTools support
- ✅ Optimistic updates (via mutations)

## Installation

```bash
npm install @computekit/react-query @computekit/core @tanstack/react-query
```

## Quick Start

### 1. Setup Providers

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ComputeKitProvider } from '@computekit/react-query';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ComputeKitProvider options={{ maxWorkers: 4 }}>
        <MyApp />
      </ComputeKitProvider>
    </QueryClientProvider>
  );
}
```

### 2. Register Compute Functions

```tsx
import { useComputeKit } from '@computekit/react-query';

function Setup() {
  const kit = useComputeKit();

  useEffect(() => {
    kit.register('fibonacci', (n: number) => {
      let a = 0,
        b = 1;
      for (let i = 2; i <= n; i++) [a, b] = [b, a + b];
      return b;
    });
  }, [kit]);

  return <MyComponent />;
}
```

### 3. Use with React Query

```tsx
import { useComputeQuery } from '@computekit/react-query';

function Fibonacci({ n }: { n: number }) {
  const { data, isLoading, error } = useComputeQuery('fibonacci', n);

  if (isLoading) return <div>Computing...</div>;
  if (error) return <div>Error: {error.message}</div>;
  return (
    <div>
      fib({n}) = {data}
    </div>
  );
}
```

## API

### `useComputeQuery(name, input, options?)`

Execute a compute function with React Query's `useQuery`.

```tsx
const { data, isLoading, error, refetch } = useComputeQuery('functionName', inputData, {
  // React Query options
  staleTime: 1000 * 60 * 5, // 5 minutes
  retry: 3,
  enabled: shouldRun,

  // ComputeKit options
  computeOptions: {
    priority: 'high',
    timeout: 5000,
  },
});
```

### `useComputeMutation(name, options?)`

Execute a compute function manually with React Query's `useMutation`.

```tsx
function ImageProcessor() {
  const { mutate, data, isPending } = useComputeMutation<ImageData, ImageData>('blur');

  return (
    <button onClick={() => mutate(imageData)} disabled={isPending}>
      {isPending ? 'Processing...' : 'Apply Blur'}
    </button>
  );
}
```

### `createComputeHooks(kit)`

Create hooks without using the context provider - useful for multiple instances or custom setups.

```tsx
import { ComputeKit } from '@computekit/core';
import { createComputeHooks } from '@computekit/react-query';

const kit = new ComputeKit();
kit.register('fibonacci', (n) => /* ... */);

const { useQuery, useMutation } = createComputeHooks(kit);

// Now use these hooks directly
function MyComponent() {
  const { data } = useQuery('fibonacci', 50);
  return <div>{data}</div>;
}
```

## Comparison with @computekit/react

| Feature                   | `@computekit/react` | `@computekit/react-query` |
| ------------------------- | ------------------- | ------------------------- |
| Built-in state management | ✅ Yes              | ❌ Uses React Query       |
| Caching                   | ❌ Manual           | ✅ Automatic              |
| Background refetch        | ❌ No               | ✅ Yes                    |
| DevTools                  | ❌ No               | ✅ React Query DevTools   |
| Progress tracking         | ✅ Yes              | ❌ Not yet                |
| Bundle size               | Smaller             | Requires React Query      |

**Use `@computekit/react`** if you want a simple, standalone solution.

**Use `@computekit/react-query`** if you're already using TanStack Query and want consistent patterns across your app.

## License

MIT
