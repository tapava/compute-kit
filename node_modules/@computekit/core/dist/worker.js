// src/utils.ts
function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}
function findTransferables(data) {
  const transferables = [];
  const seen = /* @__PURE__ */ new WeakSet();
  function traverse(obj) {
    if (obj === null || typeof obj !== "object") return;
    if (seen.has(obj)) return;
    seen.add(obj);
    if (obj instanceof ArrayBuffer) {
      transferables.push(obj);
      return;
    }
    if (ArrayBuffer.isView(obj)) {
      transferables.push(obj.buffer);
      return;
    }
    if (obj instanceof MessagePort) {
      transferables.push(obj);
      return;
    }
    if (typeof ImageBitmap !== "undefined" && obj instanceof ImageBitmap) {
      transferables.push(obj);
      return;
    }
    if (typeof OffscreenCanvas !== "undefined" && obj instanceof OffscreenCanvas) {
      transferables.push(obj);
      return;
    }
    if (Array.isArray(obj)) {
      obj.forEach(traverse);
      return;
    }
    if (obj instanceof Map) {
      obj.forEach((value, key) => {
        traverse(key);
        traverse(value);
      });
      return;
    }
    if (obj instanceof Set) {
      obj.forEach(traverse);
      return;
    }
    Object.values(obj).forEach(traverse);
  }
  traverse(data);
  return transferables;
}
function estimatePayloadSize(value) {
  if (value === null || value === void 0) return 0;
  if (typeof value === "boolean") return 4;
  if (typeof value === "number") return 8;
  if (typeof value === "string") return value.length * 2;
  if (value instanceof ArrayBuffer) return value.byteLength;
  if (ArrayBuffer.isView(value)) return value.byteLength;
  if (value instanceof Blob) return value.size;
  const seen = /* @__PURE__ */ new WeakSet();
  function traverse(obj) {
    if (obj === null || typeof obj !== "object") {
      if (typeof obj === "boolean") return 4;
      if (typeof obj === "number") return 8;
      if (typeof obj === "string") return obj.length * 2;
      return 0;
    }
    if (seen.has(obj)) return 0;
    seen.add(obj);
    if (obj instanceof ArrayBuffer) return obj.byteLength;
    if (ArrayBuffer.isView(obj)) return obj.byteLength;
    if (obj instanceof Blob) return obj.size;
    if (obj instanceof Date) return 8;
    if (obj instanceof RegExp) return obj.source.length * 2;
    if (Array.isArray(obj)) {
      return obj.reduce((sum, item) => sum + traverse(item), 0);
    }
    if (obj instanceof Map) {
      let size = 0;
      obj.forEach((val, key) => {
        size += traverse(key) + traverse(val);
      });
      return size;
    }
    if (obj instanceof Set) {
      let size = 0;
      obj.forEach((val) => {
        size += traverse(val);
      });
      return size;
    }
    return Object.entries(obj).reduce(
      (sum, [key, val]) => sum + key.length * 2 + traverse(val),
      0
    );
  }
  return traverse(value);
}

// src/worker/runtime.ts
var functionRegistry = /* @__PURE__ */ new Map();
var currentTaskId = null;
function reportProgress(progress) {
  if (!currentTaskId) {
    console.warn("reportProgress called outside of compute function");
    return;
  }
  const message = {
    id: generateId(),
    type: "progress",
    payload: {
      taskId: currentTaskId,
      progress: {
        percent: progress.percent ?? 0,
        phase: progress.phase,
        estimatedTimeRemaining: progress.estimatedTimeRemaining,
        data: progress.data
      }
    },
    timestamp: Date.now()
  };
  self.postMessage(message);
}
function registerFunction(name, fn) {
  functionRegistry.set(name, fn);
}
async function executeFunction(functionName, input) {
  const fn = functionRegistry.get(functionName);
  if (!fn) {
    throw new Error(`Function "${functionName}" not found in worker`);
  }
  return fn(input);
}
async function handleMessage(event) {
  const { id, type, payload } = event.data;
  if (type === "execute") {
    const { functionName, input } = payload;
    const startTime = performance.now();
    currentTaskId = id;
    try {
      const result = await executeFunction(functionName, input);
      const duration = performance.now() - startTime;
      const transfer = findTransferables(result);
      const outputSize = estimatePayloadSize(result);
      const response = {
        id,
        type: "result",
        payload: {
          data: result,
          duration,
          outputSize
        },
        timestamp: Date.now()
      };
      self.postMessage(response, transfer);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const duration = performance.now() - startTime;
      const response = {
        id,
        type: "error",
        payload: {
          message: error.message,
          stack: error.stack,
          functionName,
          duration
        },
        timestamp: Date.now()
      };
      self.postMessage(response);
    } finally {
      currentTaskId = null;
    }
  } else if (type === "init") {
    const response = {
      id,
      type: "ready",
      timestamp: Date.now()
    };
    self.postMessage(response);
  }
}
function initWorkerRuntime() {
  self.onmessage = handleMessage;
  const readyMessage = {
    id: generateId(),
    type: "ready",
    timestamp: Date.now()
  };
  self.postMessage(readyMessage);
}

export { functionRegistry, initWorkerRuntime, registerFunction, reportProgress };
//# sourceMappingURL=worker.js.map
//# sourceMappingURL=worker.js.map