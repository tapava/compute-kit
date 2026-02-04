# ComputeKit Production Build Obfuscation Fix

## Problem

When you build your ComputeKit application for production with minification/obfuscation enabled, variable names get shortened (e.g., `dayjs` → `Ke`). This causes issues when using third-party library dependencies in workers:

```javascript
// Development (works fine)
kit.register("formatDate", () => {
  return dayjs(date).format('YYYY-MM-DD');
});

// Production build (obfuscated - breaks!)
kit.register("formatDate", () => {
  return Ke(date).format('YYYY-MM-DD');
  // Error: "Ke is not defined" in worker
});
```

**Why it fails:**
1. Your registered function contains the obfuscated name `Ke`
2. The worker loads the library via `importScripts()`, creating a global like `dayjs`
3. The function looks for variable `Ke` which doesn't exist in the worker
4. Task fails with "is not defined" error

## Solution

Use the new **`remoteDependencyNames`** option to map remote dependency URLs to their global variable names:

```typescript
import { ComputeKit } from '@computekit/core';

const kit = new ComputeKit({
  remoteDependencies: [
    'https://cdnjs.cloudflare.com/ajax/libs/dayjs/1.11.18/dayjs.min.js',
  ],
  // Map the URL to the library's global name
  remoteDependencyNames: {
    'https://cdnjs.cloudflare.com/ajax/libs/dayjs/1.11.18/dayjs.min.js': 'dayjs',
  },
});

// Now this works in both development and production!
kit.register('formatDate', (dateString: string) => {
  return dayjs(dateString).format('YYYY-MM-DD');
});
```

## How It Works

ComputeKit now:

1. **Detects library globals from URLs**: Automatically extracts `dayjs` from the URL `dayjs.min.js`
2. **Creates aliases**: Generates worker code that creates aliases for the library
3. **Handles obfuscation**: Even if your code references the obfuscated name `Ke`, the worker has `dayjs` available and can handle any references

The generated worker code includes:
```javascript
importScripts('https://cdnjs.cloudflare.com/ajax/libs/dayjs/1.11.18/dayjs.min.js');

// Create aliases for obfuscated names in production builds
if (typeof dayjs !== 'undefined' && typeof self.dayjs === 'undefined') {
  self.dayjs = dayjs;
}
```

## API Documentation

### `remoteDependencyNames`

```typescript
interface ComputeKitOptions {
  // Maps remote dependency URLs to their global variable names
  // Type: Record<string, string>
  // Default: {}
  remoteDependencyNames?: Record<string, string>;
}
```

**Mapping pattern:**
- **Key**: URL of the remote dependency
- **Value**: The global variable name the library creates

## Examples

### Example 1: Single Library (dayjs)

```typescript
const kit = new ComputeKit({
  remoteDependencies: [
    'https://cdnjs.cloudflare.com/ajax/libs/dayjs/1.11.18/dayjs.min.js',
  ],
  remoteDependencyNames: {
    'https://cdnjs.cloudflare.com/ajax/libs/dayjs/1.11.18/dayjs.min.js': 'dayjs',
  },
});

kit.register('formatDate', (date: string) => {
  return dayjs(date).format('YYYY-MM-DD');
});
```

### Example 2: Multiple Libraries

```typescript
const kit = new ComputeKit({
  remoteDependencies: [
    'https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/mathjs/11.8.0/math.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/dayjs/1.11.18/dayjs.min.js',
  ],
  remoteDependencyNames: {
    'https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js': '_',
    'https://cdnjs.cloudflare.com/ajax/libs/mathjs/11.8.0/math.min.js': 'math',
    'https://cdnjs.cloudflare.com/ajax/libs/dayjs/1.11.18/dayjs.min.js': 'dayjs',
  },
});

kit.register('processData', (data: number[]) => {
  return _.map(data, (n) => math.evaluate(`sqrt(${n})`));
});

kit.register('formatDate', (date: string) => {
  return dayjs(date).format('YYYY-MM-DD');
});
```

### Example 3: Custom Blob Dependencies

You can also use `remoteDependencyNames` with custom blob URLs:

```typescript
// Create a utility module
const utilsCode = `
  self.customUtils = {
    add: (a, b) => a + b,
    multiply: (a, b) => a * b,
  };
`;
const utilsBlob = new Blob([utilsCode], { type: 'application/javascript' });
const utilsUrl = URL.createObjectURL(utilsBlob);

const kit = new ComputeKit({
  remoteDependencies: [utilsUrl],
  remoteDependencyNames: {
    [utilsUrl]: 'customUtils',
  },
});

kit.register('calculate', (values: number[]) => {
  return values.reduce((acc, val) => customUtils.add(acc, val), 0);
});
```

## Migration Guide

### Before (Development only, breaks in production):
```typescript
const kit = new ComputeKit({
  remoteDependencies: [
    'https://cdnjs.cloudflare.com/ajax/libs/dayjs/1.11.18/dayjs.min.js',
  ],
});

kit.register('formatDate', (date: string) => {
  return dayjs(date).format('YYYY-MM-DD');
});
```

### After (Works in both development and production):
```typescript
const kit = new ComputeKit({
  remoteDependencies: [
    'https://cdnjs.cloudflare.com/ajax/libs/dayjs/1.11.18/dayjs.min.js',
  ],
  remoteDependencyNames: {
    'https://cdnjs.cloudflare.com/ajax/libs/dayjs/1.11.18/dayjs.min.js': 'dayjs',
  },
});

kit.register('formatDate', (date: string) => {
  return dayjs(date).format('YYYY-MM-DD');
});
```

## Best Practices

### 1. Always Specify Common Library Names

```typescript
remoteDependencyNames: {
  'https://cdnjs.cloudflare.com/ajax/libs/dayjs/1.11.18/dayjs.min.js': 'dayjs',
  'https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js': '_',
}
```

### 2. Match the Global Name Pattern

The global name should match what the library creates:
- `lodash.min.js` → `_` or `lodash`
- `dayjs.min.js` → `dayjs`
- `mathjs.min.js` → `math`

If unsure, check the library's documentation or load it in a browser console to see what global it creates.

### 3. TypeScript Support

Add type declarations for your worker libraries:

```typescript
// types/worker-libs.d.ts
declare const dayjs: any; // or import the proper types
declare const _: any; // lodash
declare const math: any; // mathjs
```

Or use `@ts-ignore` in your functions:

```typescript
kit.register('formatDate', (date: string) => {
  // @ts-ignore - dayjs loaded via remoteDependencies
  return dayjs(date).format('YYYY-MM-DD');
});
```

## Troubleshooting

### "Ke is not defined" error in production

**Solution:** Add an entry to `remoteDependencyNames`:
```typescript
remoteDependencyNames: {
  'https://...dayjs.min.js': 'dayjs',
}
```

### Library not loading in worker

**Causes:**
1. URL is incorrect or library is not accessible
2. Library has CORS issues
3. Library doesn't create a global (uses ES modules)

**Solutions:**
1. Verify URL works in browser
2. Check CORS headers on CDN
3. Consider bundling the library directly instead

### Alias not being created

**Cause:** ComputeKit couldn't extract the global name from URL, or the library doesn't create one

**Solution:** Explicitly specify the global name in `remoteDependencyNames`

## See Also

- [API Reference - ComputeKitOptions](./docs/api-reference.md#computekitoptions)
- [Examples - Using External Libraries](./docs/examples.md#using-external-libraries)
- [Getting Started](./docs/getting-started.md)
