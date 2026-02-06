'use strict';

var react = require('react');
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
  react.useEffect(() => {
    return () => {
      if (!instance) {
        kit.terminate();
      }
    };
  }, [kit, instance]);
  return /* @__PURE__ */ jsxRuntime.jsx(ComputeKitContext.Provider, { value: kit, children });
}
function useComputeKit() {
  const kit = react.useContext(ComputeKitContext);
  if (!kit) {
    throw new Error("useComputeKit must be used within a ComputeKitProvider");
  }
  return kit;
}
function useCompute(functionName, options = {}) {
  const kit = useComputeKit();
  const abortControllerRef = react.useRef(null);
  const cancelledRef = react.useRef(false);
  const [state, setState] = react.useState({
    data: null,
    loading: false,
    error: null,
    progress: null,
    status: "idle"
  });
  const reset = react.useCallback(() => {
    cancelledRef.current = false;
    setState({
      data: null,
      loading: false,
      error: null,
      progress: null,
      status: "idle"
    });
  }, []);
  const cancel = react.useCallback(() => {
    if (abortControllerRef.current) {
      cancelledRef.current = true;
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setState((prev) => ({
        ...prev,
        loading: false,
        status: "cancelled"
      }));
    }
  }, []);
  const run = react.useCallback(
    async (input, runOptions) => {
      cancel();
      cancelledRef.current = false;
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      if (options.resetOnRun !== false) {
        setState((prev) => ({
          ...prev,
          loading: true,
          error: null,
          progress: null,
          status: "running"
        }));
      } else {
        setState((prev) => ({ ...prev, loading: true, status: "running" }));
      }
      try {
        const result = await kit.run(functionName, input, {
          ...options,
          ...runOptions,
          signal: runOptions?.signal ?? abortController.signal,
          onProgress: (progress) => {
            setState((prev) => ({ ...prev, progress }));
            options.onProgress?.(progress);
            runOptions?.onProgress?.(progress);
          }
        });
        if (!abortController.signal.aborted) {
          setState({
            data: result,
            loading: false,
            error: null,
            progress: null,
            status: "success"
          });
        }
      } catch (err) {
        if (!abortController.signal.aborted && !cancelledRef.current) {
          setState({
            data: null,
            loading: false,
            error: err instanceof Error ? err : new Error(String(err)),
            progress: null,
            status: "error"
          });
        }
      }
    },
    [kit, functionName, options, cancel]
  );
  react.useEffect(() => {
    if (options.autoRun && options.initialInput !== void 0) {
      run(options.initialInput);
    }
  }, []);
  react.useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);
  return {
    ...state,
    run,
    reset,
    cancel
  };
}
function useComputeCallback(functionName, options) {
  const kit = useComputeKit();
  return react.useCallback(
    (input, runOptions) => {
      return kit.run(functionName, input, {
        ...options,
        ...runOptions
      });
    },
    [kit, functionName, options]
  );
}
function useComputeFunction(name, fn, options) {
  const kit = useComputeKit();
  react.useEffect(() => {
    kit.register(name, fn);
  }, [kit, name, fn]);
  return useCompute(name, options);
}
function usePoolStats(refreshInterval = 0) {
  const kit = useComputeKit();
  const [stats, setStats] = react.useState(() => kit.getStats());
  react.useEffect(() => {
    if (refreshInterval <= 0) {
      return;
    }
    const interval = setInterval(() => {
      setStats(kit.getStats());
    }, refreshInterval);
    return () => clearInterval(interval);
  }, [kit, refreshInterval]);
  return stats;
}
function useWasmSupport() {
  const kit = useComputeKit();
  return kit.isWasmSupported();
}
function createInitialPipelineState(stages) {
  return {
    status: "idle",
    stages: stages.map((config) => ({
      id: config.id,
      name: config.name,
      functionName: config.functionName,
      status: "pending",
      retryCount: 0,
      options: config.options
    })),
    currentStageIndex: -1,
    currentStage: null,
    progress: 0,
    output: null,
    input: null,
    error: null,
    startedAt: null,
    completedAt: null,
    totalDuration: null,
    stageResults: [],
    metrics: {
      totalStages: stages.length,
      completedStages: 0,
      failedStages: 0,
      skippedStages: 0,
      totalRetries: 0,
      slowestStage: null,
      fastestStage: null,
      averageStageDuration: 0,
      timeline: []
    }
  };
}
function formatDuration(ms) {
  if (ms < 1e3) return `${ms.toFixed(0)}ms`;
  if (ms < 6e4) return `${(ms / 1e3).toFixed(2)}s`;
  return `${(ms / 6e4).toFixed(2)}min`;
}
function usePipeline(stageConfigs, options = {}) {
  const kit = useComputeKit();
  const abortControllerRef = react.useRef(null);
  const pausedRef = react.useRef(false);
  const resumePromiseRef = react.useRef(null);
  const [state, setState] = react.useState(
    () => createInitialPipelineState(stageConfigs)
  );
  const stages = react.useMemo(() => stageConfigs, [stageConfigs]);
  const addTimelineEvent = react.useCallback(
    (stageId, stageName, event, duration, error) => {
      if (options.trackTimeline === false) return;
      setState((prev) => ({
        ...prev,
        metrics: {
          ...prev.metrics,
          timeline: [
            ...prev.metrics.timeline,
            {
              stageId,
              stageName,
              event,
              timestamp: Date.now(),
              duration,
              error
            }
          ]
        }
      }));
    },
    [options.trackTimeline]
  );
  const updateMetrics = react.useCallback(
    (_completedStage, allStages) => {
      const completedStages = allStages.filter((s) => s.status === "completed");
      const durations = completedStages.filter((s) => s.duration !== void 0).map((s) => ({ id: s.id, name: s.name, duration: s.duration }));
      const slowest = durations.length ? durations.reduce((a, b) => a.duration > b.duration ? a : b) : null;
      const fastest = durations.length ? durations.reduce((a, b) => a.duration < b.duration ? a : b) : null;
      const avgDuration = durations.length ? durations.reduce((sum, d) => sum + d.duration, 0) / durations.length : 0;
      return {
        totalStages: allStages.length,
        completedStages: completedStages.length,
        failedStages: allStages.filter((s) => s.status === "failed").length,
        skippedStages: allStages.filter((s) => s.status === "skipped").length,
        totalRetries: allStages.reduce((sum, s) => sum + s.retryCount, 0),
        slowestStage: slowest,
        fastestStage: fastest,
        averageStageDuration: avgDuration
      };
    },
    []
  );
  const executeStage = react.useCallback(
    async (stageConfig, stageIndex, input, previousResults, signal) => {
      const maxRetries = stageConfig.maxRetries ?? 0;
      const retryDelay = stageConfig.retryDelay ?? 1e3;
      let lastError;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (signal.aborted) {
          return { success: false, error: new Error("Pipeline cancelled") };
        }
        if (pausedRef.current) {
          await new Promise((resolve, reject) => {
            resumePromiseRef.current = { resolve, reject };
          });
        }
        if (stageConfig.shouldSkip?.(input, previousResults)) {
          setState((prev) => {
            const newStages = [...prev.stages];
            newStages[stageIndex] = {
              ...newStages[stageIndex],
              status: "skipped"
            };
            return {
              ...prev,
              stages: newStages
            };
          });
          addTimelineEvent(stageConfig.id, stageConfig.name, "skipped");
          options.onStageComplete?.(state.stages[stageIndex]);
          return { success: true, output: previousResults[previousResults.length - 1] };
        }
        const transformedInput = stageConfig.transformInput ? stageConfig.transformInput(input, previousResults) : input;
        const startTime = performance.now();
        setState((prev) => {
          const newStages = [...prev.stages];
          newStages[stageIndex] = {
            ...newStages[stageIndex],
            status: "running",
            input: transformedInput,
            startedAt: Date.now(),
            retryCount: attempt
          };
          return {
            ...prev,
            stages: newStages,
            currentStageIndex: stageIndex,
            currentStage: newStages[stageIndex]
          };
        });
        if (attempt === 0) {
          addTimelineEvent(stageConfig.id, stageConfig.name, "started");
          options.onStageStart?.(state.stages[stageIndex]);
        } else {
          addTimelineEvent(stageConfig.id, stageConfig.name, "retry");
          options.onStageRetry?.(state.stages[stageIndex], attempt);
        }
        try {
          const result = await kit.run(stageConfig.functionName, transformedInput, {
            ...stageConfig.options,
            signal,
            onProgress: (progress) => {
              setState((prev) => {
                const newStages = [...prev.stages];
                newStages[stageIndex] = {
                  ...newStages[stageIndex],
                  progress: progress.percent
                };
                const stageProgress = progress.percent / 100;
                const overallProgress = (stageIndex + stageProgress) / stages.length * 100;
                return {
                  ...prev,
                  stages: newStages,
                  progress: overallProgress
                };
              });
            }
          });
          const duration = performance.now() - startTime;
          const transformedOutput = stageConfig.transformOutput ? stageConfig.transformOutput(result) : result;
          setState((prev) => {
            const newStages = [...prev.stages];
            newStages[stageIndex] = {
              ...newStages[stageIndex],
              status: "completed",
              output: transformedOutput,
              completedAt: Date.now(),
              duration,
              progress: 100
            };
            const newMetrics = {
              ...prev.metrics,
              ...updateMetrics(newStages[stageIndex], newStages)
            };
            return {
              ...prev,
              stages: newStages,
              metrics: newMetrics,
              progress: (stageIndex + 1) / stages.length * 100
            };
          });
          addTimelineEvent(stageConfig.id, stageConfig.name, "completed", duration);
          options.onStageComplete?.(state.stages[stageIndex]);
          return { success: true, output: transformedOutput };
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
            continue;
          }
          const duration = performance.now() - startTime;
          setState((prev) => {
            const newStages = [...prev.stages];
            newStages[stageIndex] = {
              ...newStages[stageIndex],
              status: "failed",
              error: lastError,
              completedAt: Date.now(),
              duration
            };
            return {
              ...prev,
              stages: newStages,
              metrics: {
                ...prev.metrics,
                failedStages: prev.metrics.failedStages + 1
              }
            };
          });
          addTimelineEvent(
            stageConfig.id,
            stageConfig.name,
            "failed",
            duration,
            lastError.message
          );
          options.onStageError?.(state.stages[stageIndex], lastError);
          return { success: false, error: lastError };
        }
      }
      return { success: false, error: lastError };
    },
    [kit, stages, state.stages, addTimelineEvent, updateMetrics, options]
  );
  const run = react.useCallback(
    async (input) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      pausedRef.current = false;
      const startTime = Date.now();
      setState(() => ({
        ...createInitialPipelineState(stages),
        status: "running",
        input,
        startedAt: startTime
      }));
      const stageResults = [];
      let currentInput = input;
      let finalError = null;
      for (let i = 0; i < stages.length; i++) {
        if (abortController.signal.aborted) {
          setState((prev) => ({
            ...prev,
            status: "cancelled",
            completedAt: Date.now(),
            totalDuration: Date.now() - startTime
          }));
          return;
        }
        const result = await executeStage(
          stages[i],
          i,
          currentInput,
          stageResults,
          abortController.signal
        );
        if (!result.success) {
          finalError = result.error ?? new Error("Stage failed");
          if (options.stopOnError !== false) {
            setState((prev) => ({
              ...prev,
              status: "failed",
              error: finalError,
              stageResults,
              completedAt: Date.now(),
              totalDuration: Date.now() - startTime
            }));
            return;
          }
        }
        if (result.output !== void 0) {
          stageResults.push(result.output);
          currentInput = result.output;
        }
      }
      setState((prev) => ({
        ...prev,
        status: finalError ? "failed" : "completed",
        output: currentInput ?? null,
        error: finalError,
        stageResults,
        completedAt: Date.now(),
        totalDuration: Date.now() - startTime,
        currentStageIndex: -1,
        currentStage: null,
        progress: 100
      }));
      options.onStateChange?.(state);
    },
    [stages, executeStage, options, state]
  );
  const cancel = react.useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (resumePromiseRef.current) {
      resumePromiseRef.current.reject(new Error("Pipeline cancelled"));
      resumePromiseRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      status: "cancelled",
      completedAt: Date.now(),
      totalDuration: prev.startedAt ? Date.now() - prev.startedAt : null
    }));
  }, []);
  const reset = react.useCallback(() => {
    cancel();
    setState(createInitialPipelineState(stages));
  }, [cancel, stages]);
  const pause = react.useCallback(() => {
    pausedRef.current = true;
    setState((prev) => ({
      ...prev,
      status: "paused"
    }));
  }, []);
  const resume = react.useCallback(() => {
    pausedRef.current = false;
    if (resumePromiseRef.current) {
      resumePromiseRef.current.resolve();
      resumePromiseRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      status: "running"
    }));
  }, []);
  const retry = react.useCallback(async () => {
    if (state.status !== "failed" || !state.input) return;
    const failedIndex = state.stages.findIndex((s) => s.status === "failed");
    if (failedIndex === -1) return;
    const retryInput = failedIndex === 0 ? state.input : state.stageResults[failedIndex - 1];
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setState((prev) => ({
      ...prev,
      status: "running",
      error: null
    }));
    const stageResults = [...state.stageResults.slice(0, failedIndex)];
    let currentInput = retryInput;
    for (let i = failedIndex; i < stages.length; i++) {
      if (abortController.signal.aborted) {
        setState((prev) => ({ ...prev, status: "cancelled" }));
        return;
      }
      const result = await executeStage(
        stages[i],
        i,
        currentInput,
        stageResults,
        abortController.signal
      );
      if (!result.success) {
        setState((prev) => ({
          ...prev,
          status: "failed",
          error: result.error ?? new Error("Stage failed"),
          stageResults
        }));
        return;
      }
      if (result.output !== void 0) {
        stageResults.push(result.output);
        currentInput = result.output;
      }
    }
    setState((prev) => ({
      ...prev,
      status: "completed",
      output: currentInput,
      stageResults,
      completedAt: Date.now(),
      totalDuration: prev.startedAt ? Date.now() - prev.startedAt : null,
      progress: 100
    }));
  }, [state, stages, executeStage]);
  const getReport = react.useCallback(() => {
    const stageDetails = state.stages.map((stage) => ({
      name: stage.name,
      status: stage.status,
      duration: stage.duration ? formatDuration(stage.duration) : "-",
      error: stage.error?.message
    }));
    const timeline = state.metrics.timeline.map((event) => {
      const time = new Date(event.timestamp).toISOString().split("T")[1].split(".")[0];
      const duration = event.duration ? ` (${formatDuration(event.duration)})` : "";
      const error = event.error ? ` - ${event.error}` : "";
      return `[${time}] ${event.stageName}: ${event.event}${duration}${error}`;
    });
    const insights = [];
    if (state.metrics.slowestStage) {
      insights.push(
        `Slowest stage: ${state.metrics.slowestStage.name} (${formatDuration(
          state.metrics.slowestStage.duration
        )})`
      );
    }
    if (state.metrics.fastestStage) {
      insights.push(
        `Fastest stage: ${state.metrics.fastestStage.name} (${formatDuration(
          state.metrics.fastestStage.duration
        )})`
      );
    }
    if (state.metrics.totalRetries > 0) {
      insights.push(`Total retries: ${state.metrics.totalRetries}`);
    }
    if (state.metrics.averageStageDuration > 0) {
      insights.push(
        `Average stage duration: ${formatDuration(state.metrics.averageStageDuration)}`
      );
    }
    const successRate = state.metrics.totalStages > 0 ? state.metrics.completedStages / state.metrics.totalStages * 100 : 0;
    const summary = [
      `Pipeline Status: ${state.status.toUpperCase()}`,
      `Stages: ${state.metrics.completedStages}/${state.metrics.totalStages} completed`,
      `Success Rate: ${successRate.toFixed(0)}%`,
      state.totalDuration ? `Total Duration: ${formatDuration(state.totalDuration)}` : "",
      state.error ? `Error: ${state.error.message}` : ""
    ].filter(Boolean).join("\n");
    return {
      summary,
      stageDetails,
      timeline,
      insights,
      metrics: state.metrics
    };
  }, [state]);
  const isStageComplete = react.useCallback(
    (stageId) => {
      const stage = state.stages.find((s) => s.id === stageId);
      return stage?.status === "completed";
    },
    [state.stages]
  );
  const getStage = react.useCallback(
    (stageId) => {
      return state.stages.find((s) => s.id === stageId);
    },
    [state.stages]
  );
  react.useEffect(() => {
    if (options.autoRun && options.initialInput !== void 0) {
      run(options.initialInput);
    }
  }, []);
  react.useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);
  return {
    ...state,
    run,
    cancel,
    reset,
    pause,
    resume,
    retry,
    getReport,
    isRunning: state.status === "running",
    isComplete: state.status === "completed",
    isFailed: state.status === "failed",
    isStageComplete,
    getStage
  };
}
function useParallelBatch(functionName, options = {}) {
  const kit = useComputeKit();
  const abortControllerRef = react.useRef(null);
  const [state, setState] = react.useState({
    result: null,
    loading: false,
    progress: 0,
    completedCount: 0,
    totalCount: 0
  });
  const run = react.useCallback(
    async (items) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      setState({
        result: null,
        loading: true,
        progress: 0,
        completedCount: 0,
        totalCount: items.length
      });
      const startTime = performance.now();
      const results = [];
      const concurrency = options.concurrency ?? items.length;
      for (let i = 0; i < items.length; i += concurrency) {
        if (abortController.signal.aborted) {
          break;
        }
        const batch = items.slice(i, i + concurrency);
        const batchPromises = batch.map(async (item, batchIndex) => {
          const index = i + batchIndex;
          const itemStart = performance.now();
          try {
            const data = await kit.run(functionName, item, {
              ...options.computeOptions,
              signal: abortController.signal
            });
            const itemResult = {
              index,
              success: true,
              data,
              duration: performance.now() - itemStart
            };
            return itemResult;
          } catch (err) {
            const itemResult = {
              index,
              success: false,
              error: err instanceof Error ? err : new Error(String(err)),
              duration: performance.now() - itemStart
            };
            return itemResult;
          }
        });
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        const completed = results.length;
        setState((prev) => ({
          ...prev,
          completedCount: completed,
          progress: completed / items.length * 100
        }));
      }
      const totalDuration = performance.now() - startTime;
      const successful = results.filter((r) => r.success && r.data !== void 0).map((r) => r.data);
      const failed = results.filter((r) => !r.success).map((r) => ({ index: r.index, error: r.error }));
      const finalResult = {
        results,
        successful,
        failed,
        totalDuration,
        successRate: successful.length / items.length
      };
      setState({
        result: finalResult,
        loading: false,
        progress: 100,
        completedCount: items.length,
        totalCount: items.length
      });
      return finalResult;
    },
    [kit, functionName, options.concurrency, options.computeOptions]
  );
  const cancel = react.useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      loading: false
    }));
  }, []);
  const reset = react.useCallback(() => {
    cancel();
    setState({
      result: null,
      loading: false,
      progress: 0,
      completedCount: 0,
      totalCount: 0
    });
  }, [cancel]);
  react.useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);
  return {
    ...state,
    run,
    cancel,
    reset
  };
}

Object.defineProperty(exports, "ComputeKit", {
  enumerable: true,
  get: function () { return core.ComputeKit; }
});
exports.ComputeKitProvider = ComputeKitProvider;
exports.useCompute = useCompute;
exports.useComputeCallback = useComputeCallback;
exports.useComputeFunction = useComputeFunction;
exports.useComputeKit = useComputeKit;
exports.useParallelBatch = useParallelBatch;
exports.usePipeline = usePipeline;
exports.usePoolStats = usePoolStats;
exports.useWasmSupport = useWasmSupport;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map