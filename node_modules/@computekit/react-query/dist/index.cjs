'use strict';

var react = require('react');
var reactQuery = require('@tanstack/react-query');
var core = require('@computekit/core');
var jsxRuntime = require('react/jsx-runtime');

// src/index.tsx
var ComputeKitContext = react.createContext(null);
function ComputeKitProvider({
  options,
  instance,
  children
}) {
  const kit = react.useMemo(() => {
    return instance ?? new core.ComputeKit(options);
  }, [instance, options]);
  return /* @__PURE__ */ jsxRuntime.jsx(ComputeKitContext.Provider, { value: kit, children });
}
function useComputeKit() {
  const kit = react.useContext(ComputeKitContext);
  if (!kit) {
    throw new Error("useComputeKit must be used within a ComputeKitProvider");
  }
  return kit;
}
function useComputeQuery(name, input, options) {
  const kit = useComputeKit();
  const { computeOptions, ...queryOptions } = options ?? {};
  return reactQuery.useQuery({
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
  return reactQuery.useMutation({
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
      return reactQuery.useQuery({
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
      return reactQuery.useMutation({
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

Object.defineProperty(exports, "ComputeKit", {
  enumerable: true,
  get: function () { return core.ComputeKit; }
});
exports.ComputeKitProvider = ComputeKitProvider;
exports.createComputeHooks = createComputeHooks;
exports.useComputeKit = useComputeKit;
exports.useComputeMutation = useComputeMutation;
exports.useComputeQuery = useComputeQuery;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map