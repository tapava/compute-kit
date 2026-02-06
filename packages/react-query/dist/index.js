import { createContext, useMemo, useContext } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ComputeKit } from '@computekit/core';
export { ComputeKit } from '@computekit/core';
import { jsx } from 'react/jsx-runtime';

// src/index.tsx
var ComputeKitContext = createContext(null);
function ComputeKitProvider({
  options,
  instance,
  children
}) {
  const kit = useMemo(() => {
    return instance ?? new ComputeKit(options);
  }, [instance, options]);
  return /* @__PURE__ */ jsx(ComputeKitContext.Provider, { value: kit, children });
}
function useComputeKit() {
  const kit = useContext(ComputeKitContext);
  if (!kit) {
    throw new Error("useComputeKit must be used within a ComputeKitProvider");
  }
  return kit;
}
function useComputeQuery(name, input, options) {
  const kit = useComputeKit();
  const { computeOptions, ...queryOptions } = options ?? {};
  return useQuery({
    queryKey: ["compute", name, input],
    queryFn: async () => {
      const result = await kit.run(name, input, computeOptions);
      return result;
    },
    ...queryOptions
  });
}
function useComputeMutation(name, options) {
  const kit = useComputeKit();
  const { computeOptions, ...mutationOptions } = options ?? {};
  return useMutation({
    mutationFn: async (input) => {
      const result = await kit.run(name, input, computeOptions);
      return result;
    },
    ...mutationOptions
  });
}
function createComputeHooks(kit) {
  return {
    /**
     * Query hook bound to this ComputeKit instance
     */
    useQuery: (name, input, options) => {
      const { computeOptions, ...queryOptions } = options ?? {};
      return useQuery({
        queryKey: ["compute", name, input],
        queryFn: async () => {
          const result = await kit.run(name, input, computeOptions);
          return result;
        },
        ...queryOptions
      });
    },
    /**
     * Mutation hook bound to this ComputeKit instance
     */
    useMutation: (name, options) => {
      const { computeOptions, ...mutationOptions } = options ?? {};
      return useMutation({
        mutationFn: async (input) => {
          const result = await kit.run(name, input, computeOptions);
          return result;
        },
        ...mutationOptions
      });
    },
    /** The ComputeKit instance */
    kit
  };
}

export { ComputeKitProvider, createComputeHooks, useComputeKit, useComputeMutation, useComputeQuery };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map