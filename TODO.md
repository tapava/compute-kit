# ComputeKit TODO

## Features

- [ ] **Progress throttling** - Add optional `progressThrottle` option to prevent state flooding when compute functions fire progress updates in tight loops. Should throttle/debounce progress callbacks to avoid choking the main thread with re-renders.
  - Add `progressThrottle?: number` option (ms) to `ComputeOptions`
  - Throttle `onProgress` calls in the React hook
  - Consider both throttle (regular intervals) and debounce (wait for pause) strategies

- [ ] **Typed registry** - Add TypeScript support to narrow function names to only registered functions for autocomplete and type safety.
  - Make `useCompute('functionName')` autocomplete only registered function names
  - Type safety on input/output based on registered function signatures
  - Consider using TypeScript's string literal types or const assertions

## Improvements

- [ ] Add more WASM examples (Rust, C++)
- [ ] Benchmark suite for comparing JS vs WASM performance
- [ ] Documentation site (Docusaurus or similar)

## Ideas

- [ ] `useComputeMultiple` hook for managing multiple parallel tasks
- [ ] `useComputeFile` hook for loading functions from separate files
- [ ] Built-in caching for compute results
- [ ] Streaming results for very large outputs
