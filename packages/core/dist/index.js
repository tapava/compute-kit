// src/utils.ts
function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}
function isSharedArrayBufferAvailable() {
  try {
    return typeof SharedArrayBuffer !== "undefined";
  } catch {
    return false;
  }
}
function isWasmSupported() {
  try {
    if (typeof WebAssembly === "object") {
      const module = new WebAssembly.Module(
        Uint8Array.of(0, 97, 115, 109, 1, 0, 0, 0)
      );
      return module instanceof WebAssembly.Module;
    }
  } catch {
  }
  return false;
}
function getHardwareConcurrency() {
  if (typeof navigator !== "undefined" && navigator.hardwareConcurrency) {
    return navigator.hardwareConcurrency;
  }
  return 4;
}
function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
function createTimeout(ms, message) {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(message || `Operation timed out after ${ms}ms`));
    }, ms);
  });
}
async function withTimeout(promise, ms, message) {
  return Promise.race([promise, createTimeout(ms, message)]);
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
var EventEmitter = class {
  handlers = /* @__PURE__ */ new Map();
  on(event, handler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, /* @__PURE__ */ new Set());
    }
    this.handlers.get(event).add(handler);
    return () => this.off(event, handler);
  }
  off(event, handler) {
    this.handlers.get(event)?.delete(handler);
  }
  emit(event, data) {
    this.handlers.get(event)?.forEach((handler) => {
      try {
        handler(data);
      } catch (err) {
        console.error(`Error in event handler for ${String(event)}:`, err);
      }
    });
  }
  removeAllListeners(event) {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }
};
var LRUCache = class {
  cache = /* @__PURE__ */ new Map();
  maxSize;
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }
  get(key) {
    const value = this.cache.get(key);
    if (value !== void 0) {
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }
  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== void 0) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }
  has(key) {
    return this.cache.has(key);
  }
  delete(key) {
    return this.cache.delete(key);
  }
  clear() {
    this.cache.clear();
  }
  get size() {
    return this.cache.size;
  }
};
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
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0)} ${sizes[i]}`;
}
function createLogger(prefix, enabled = false) {
  const noop = () => {
  };
  const log = (level) => enabled ? (...args) => console.log(`[${prefix}:${level}]`, ...args) : noop;
  return {
    debug: log("debug"),
    info: log("info"),
    warn: enabled ? (...args) => console.warn(`[${prefix}:warn]`, ...args) : noop,
    error: (...args) => console.error(`[${prefix}:error]`, ...args)
  };
}

// src/pool.ts
var WorkerPool = class {
  workers = /* @__PURE__ */ new Map();
  taskQueue = [];
  pendingTasks = /* @__PURE__ */ new Map();
  functions = /* @__PURE__ */ new Map();
  workerUrl = null;
  options;
  logger;
  initialized = false;
  stats = {
    tasksCompleted: 0,
    tasksFailed: 0,
    totalDuration: 0
  };
  constructor(options = {}) {
    this.options = {
      maxWorkers: options.maxWorkers ?? getHardwareConcurrency(),
      timeout: options.timeout ?? 3e4,
      debug: options.debug ?? false,
      workerPath: options.workerPath ?? "",
      useSharedMemory: options.useSharedMemory ?? true,
      remoteDependencies: options.remoteDependencies ?? [],
      remoteDependencyNames: options.remoteDependencyNames ?? {}
    };
    this.logger = createLogger("ComputeKit:Pool", this.options.debug);
    this.logger.info("WorkerPool created with options:", this.options);
  }
  /**
   * Initialize the worker pool
   */
  async initialize() {
    if (this.initialized) return;
    this.logger.info("Initializing worker pool...");
    this.logger.info("Registered functions:", Array.from(this.functions.keys()));
    this.workerUrl = this.createWorkerBlob();
    const workerCount = Math.min(2, this.options.maxWorkers);
    for (let i = 0; i < workerCount; i++) {
      await this.createWorker();
    }
    this.initialized = true;
    this.logger.info(`Worker pool initialized with ${workerCount} workers`);
  }
  pendingRecreate = null;
  /**
   * Register a compute function
   */
  register(name, fn) {
    this.logger.debug(`Registering function: ${name}`);
    this.functions.set(name, {
      fn,
      serialized: fn.toString()
    });
    if (this.initialized) {
      this.pendingRecreate = this.recreateWorkers();
    } else {
      if (this.workerUrl) {
        URL.revokeObjectURL(this.workerUrl);
        this.workerUrl = null;
      }
    }
  }
  /**
   * Recreate workers with updated function registry
   */
  async recreateWorkers() {
    this.logger.debug("Recreating workers with updated functions...");
    if (this.workerUrl) {
      URL.revokeObjectURL(this.workerUrl);
    }
    this.workerUrl = this.createWorkerBlob();
    const idleWorkers = Array.from(this.workers.entries()).filter(
      ([_, w]) => w.state === "idle"
    );
    for (const [id, poolWorker] of idleWorkers) {
      poolWorker.worker.terminate();
      this.workers.delete(id);
    }
    const workerCount = Math.max(
      1,
      Math.min(2, this.options.maxWorkers) - this.workers.size
    );
    for (let i = 0; i < workerCount; i++) {
      await this.createWorker();
    }
  }
  /**
   * Execute a compute function
   */
  async execute(name, input, options) {
    if (this.pendingRecreate) {
      await this.pendingRecreate;
      this.pendingRecreate = null;
    }
    if (!this.initialized) {
      await this.initialize();
    }
    const fn = this.functions.get(name);
    if (!fn) {
      throw new Error(`Function "${name}" not registered`);
    }
    const taskId = generateId();
    const timeout = options?.timeout ?? this.options.timeout;
    this.logger.debug(`Executing task ${taskId} for function "${name}"`);
    if (options?.signal?.aborted) {
      throw new Error("Operation aborted");
    }
    const deferred = createDeferred();
    const task = {
      id: taskId,
      functionName: name,
      input,
      options,
      deferred,
      priority: options?.priority ?? 5,
      createdAt: Date.now(),
      onProgress: options?.onProgress
    };
    if (options?.signal) {
      options.signal.addEventListener("abort", () => {
        this.cancelTask(taskId);
        deferred.reject(new Error("Operation aborted"));
      });
    }
    this.enqueue(task);
    this.processQueue();
    return withTimeout(deferred.promise, timeout, `Task "${name}" timed out`);
  }
  /**
   * Get pool statistics
   */
  getStats() {
    const workers = Array.from(this.workers.values()).map(
      (w) => ({
        id: w.id,
        state: w.state,
        currentTask: w.currentTask,
        tasksCompleted: w.tasksCompleted,
        errors: w.errors,
        createdAt: w.createdAt,
        lastActiveAt: w.lastActiveAt
      })
    );
    return {
      workers,
      totalWorkers: this.workers.size,
      activeWorkers: workers.filter((w) => w.state === "busy").length,
      idleWorkers: workers.filter((w) => w.state === "idle").length,
      queueLength: this.taskQueue.length,
      tasksCompleted: this.stats.tasksCompleted,
      tasksFailed: this.stats.tasksFailed,
      averageTaskDuration: this.stats.tasksCompleted > 0 ? this.stats.totalDuration / this.stats.tasksCompleted : 0
    };
  }
  /**
   * Terminate all workers and clean up
   */
  async terminate() {
    this.logger.info("Terminating worker pool...");
    for (const task of this.pendingTasks.values()) {
      task.deferred.reject(new Error("Worker pool terminated"));
    }
    this.pendingTasks.clear();
    this.taskQueue = [];
    for (const poolWorker of this.workers.values()) {
      poolWorker.worker.terminate();
      poolWorker.state = "terminated";
    }
    this.workers.clear();
    if (this.workerUrl) {
      URL.revokeObjectURL(this.workerUrl);
      this.workerUrl = null;
    }
    this.initialized = false;
    this.logger.info("Worker pool terminated");
  }
  /**
   * Create the worker blob URL
   */
  createWorkerBlob() {
    const functionsCode = Array.from(this.functions.entries()).map(([name, { serialized }]) => `"${name}": ${serialized}`).join(",\n");
    this.logger.debug(
      "Creating worker blob with functions:",
      Array.from(this.functions.keys())
    );
    const remoteDeps = this.options.remoteDependencies;
    const importScriptsCode = remoteDeps.length > 0 ? `importScripts(${remoteDeps.map((url) => `"${url}"`).join(", ")});` : "";
    const dependencyAliases = this.options.remoteDependencyNames;
    let aliasCode = "";
    if (Object.keys(dependencyAliases).length > 0) {
      const aliases = [];
      for (const [url, varName] of Object.entries(dependencyAliases)) {
        const globalName = this.extractGlobalNameFromUrl(url);
        if (globalName && globalName !== varName) {
          aliases.push(
            `if (typeof ${globalName} !== 'undefined' && typeof self.${varName} === 'undefined') { self.${varName} = ${globalName}; }`
          );
        }
      }
      aliasCode = aliases.join("\n");
    }
    const workerCode = `
${importScriptsCode}

// Create aliases for obfuscated names in production builds
${aliasCode}

const functions = {
${functionsCode}
};

self.onmessage = function(e) {
  const msg = e.data;
  if (msg.type === 'execute') {
    const fn = functions[msg.payload.functionName];
    if (!fn) {
      self.postMessage({ id: msg.id, type: 'error', payload: { message: 'Function not found: ' + msg.payload.functionName } });
      return;
    }
    try {
      const start = performance.now();
      Promise.resolve(fn(msg.payload.input)).then(function(result) {
        self.postMessage({ id: msg.id, type: 'result', payload: { data: result, duration: performance.now() - start } });
      }).catch(function(err) {
        self.postMessage({ id: msg.id, type: 'error', payload: { message: err.message || String(err) } });
      });
    } catch (err) {
      self.postMessage({ id: msg.id, type: 'error', payload: { message: err.message || String(err) } });
    }
  }
};
self.postMessage({ type: 'ready' });
`;
    const blob = new Blob([workerCode], { type: "application/javascript" });
    return URL.createObjectURL(blob);
  }
  /**
   * Extract the likely global variable name from a URL
   * e.g., "https://cdnjs.cloudflare.com/ajax/libs/dayjs/1.11.18/dayjs.min.js" -> "dayjs"
   */
  extractGlobalNameFromUrl(url) {
    try {
      const pathname = new URL(url).pathname;
      const filename = pathname.split("/").pop() || "";
      const bareFilename = filename.replace(/\.min\.(js|mjs)$/, "").replace(/\.(js|mjs)$/, "");
      return bareFilename || null;
    } catch {
      return null;
    }
  }
  /**
   * Create a new worker
   */
  async createWorker() {
    if (!this.workerUrl) {
      this.workerUrl = this.createWorkerBlob();
    }
    const id = generateId();
    const worker = new Worker(this.workerUrl);
    let resolveReady;
    const readyPromise = new Promise((resolve) => {
      resolveReady = resolve;
    });
    const poolWorker = {
      id,
      worker,
      state: "idle",
      tasksCompleted: 0,
      errors: 0,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      ready: false,
      readyPromise
    };
    worker.onmessage = (e) => {
      if (e.data.type === "ready") {
        poolWorker.ready = true;
        resolveReady();
      }
      this.handleWorkerMessage(poolWorker, e.data);
    };
    worker.onerror = (e) => {
      this.handleWorkerError(poolWorker, e);
    };
    this.workers.set(id, poolWorker);
    this.logger.debug(`Created worker ${id}`);
    await readyPromise;
    this.logger.debug(`Worker ${id} is ready`);
    return poolWorker;
  }
  /**
   * Handle messages from workers
   */
  handleWorkerMessage(poolWorker, message) {
    this.logger.debug("Received message from worker:", message);
    const { id, type, payload } = message;
    switch (type) {
      case "ready":
        this.logger.debug(`Worker ${poolWorker.id} ready`);
        break;
      case "result": {
        const task = this.pendingTasks.get(id);
        if (task) {
          const resultPayload = payload;
          this.pendingTasks.delete(id);
          poolWorker.state = "idle";
          poolWorker.currentTask = void 0;
          poolWorker.tasksCompleted++;
          poolWorker.lastActiveAt = Date.now();
          this.stats.tasksCompleted++;
          this.stats.totalDuration += resultPayload.duration;
          const inputSize = estimatePayloadSize(task.input);
          const outputSize = resultPayload.outputSize ?? 0;
          this.logger.debug(
            `Task ${id} (${task.functionName}): input=${formatBytes(inputSize)}, output=${formatBytes(outputSize)}, duration=${resultPayload.duration.toFixed(2)}ms`
          );
          task.deferred.resolve(resultPayload.data);
          this.processQueue();
        }
        break;
      }
      case "error": {
        const task = this.pendingTasks.get(id);
        if (task) {
          const errorPayload = payload;
          this.pendingTasks.delete(id);
          poolWorker.state = "idle";
          poolWorker.currentTask = void 0;
          poolWorker.errors++;
          poolWorker.lastActiveAt = Date.now();
          this.stats.tasksFailed++;
          const error = new Error(errorPayload.message);
          if (errorPayload.stack) {
            error.stack = errorPayload.stack;
          }
          this.logger.error(`Task ${id} failed:`, errorPayload.message);
          task.deferred.reject(error);
          this.processQueue();
        }
        break;
      }
      case "progress": {
        const progressPayload = payload;
        const task = this.pendingTasks.get(progressPayload.taskId);
        if (task?.onProgress) {
          task.onProgress(progressPayload.progress);
        }
        break;
      }
    }
  }
  /**
   * Handle worker errors
   */
  handleWorkerError(poolWorker, error) {
    this.logger.error(`Worker ${poolWorker.id} error:`, error.message);
    poolWorker.state = "error";
    poolWorker.errors++;
    if (poolWorker.currentTask) {
      const task = this.pendingTasks.get(poolWorker.currentTask);
      if (task) {
        this.pendingTasks.delete(poolWorker.currentTask);
        task.deferred.reject(new Error(`Worker error: ${error.message}`));
      }
    }
    poolWorker.worker.terminate();
    this.workers.delete(poolWorker.id);
    this.createWorker().then(() => this.processQueue());
  }
  /**
   * Add task to queue (priority-based)
   */
  enqueue(task) {
    let inserted = false;
    for (let i = 0; i < this.taskQueue.length; i++) {
      if (task.priority > this.taskQueue[i].priority) {
        this.taskQueue.splice(i, 0, task);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      this.taskQueue.push(task);
    }
  }
  /**
   * Process queued tasks
   */
  async processQueue() {
    if (this.taskQueue.length === 0) return;
    let idleWorker;
    for (const worker of this.workers.values()) {
      if (worker.state === "idle") {
        idleWorker = worker;
        break;
      }
    }
    if (!idleWorker && this.workers.size < this.options.maxWorkers) {
      idleWorker = await this.createWorker();
    }
    if (!idleWorker) return;
    const task = this.taskQueue.shift();
    if (!task) return;
    this.executeOnWorker(idleWorker, task);
    if (this.taskQueue.length > 0) {
      this.processQueue();
    }
  }
  /**
   * Execute task on a specific worker
   */
  executeOnWorker(poolWorker, task) {
    this.logger.debug(
      `executeOnWorker: Starting task ${task.id} (${task.functionName}) on worker ${poolWorker.id}`
    );
    poolWorker.state = "busy";
    poolWorker.currentTask = task.id;
    poolWorker.lastActiveAt = Date.now();
    this.pendingTasks.set(task.id, task);
    const message = {
      id: task.id,
      type: "execute",
      payload: {
        functionName: task.functionName,
        input: task.input
        // Don't send options - they may contain non-cloneable objects like AbortSignal
      },
      timestamp: Date.now()
    };
    const transfer = findTransferables(task.input);
    this.logger.debug(`Posting message to worker:`, message);
    poolWorker.worker.postMessage(message, transfer);
    this.logger.debug(`Message posted to worker ${poolWorker.id}`);
  }
  /**
   * Cancel a pending task
   */
  cancelTask(taskId) {
    const queueIndex = this.taskQueue.findIndex((t) => t.id === taskId);
    if (queueIndex !== -1) {
      this.taskQueue.splice(queueIndex, 1);
    }
    this.pendingTasks.delete(taskId);
  }
};

// src/wasm.ts
var logger = createLogger("ComputeKit:WASM");
var moduleCache = new LRUCache(10);
var instanceCache = new LRUCache(10);
async function loadWasmModule(source) {
  if (typeof source === "string") {
    const cached = moduleCache.get(source);
    if (cached) {
      logger.debug("Using cached WASM module:", source);
      return cached;
    }
  }
  let bytes;
  if (typeof source === "string") {
    if (source.startsWith("data:")) {
      const base64 = source.split(",")[1];
      bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    } else {
      logger.debug("Fetching WASM from:", source);
      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(`Failed to fetch WASM: ${response.statusText}`);
      }
      if (WebAssembly.compileStreaming) {
        const module2 = await WebAssembly.compileStreaming(response);
        moduleCache.set(source, module2);
        return module2;
      }
      bytes = await response.arrayBuffer();
    }
  } else {
    bytes = source;
  }
  const module = await WebAssembly.compile(bytes);
  if (typeof source === "string") {
    moduleCache.set(source, module);
  }
  return module;
}
async function instantiateWasm(module, imports = {}) {
  return WebAssembly.instantiate(module, imports);
}
async function loadAndInstantiate(config) {
  const { source, imports = {}, memory } = config;
  const wasmImports = { ...imports };
  if (memory) {
    wasmImports.env = {
      ...wasmImports.env,
      memory: new WebAssembly.Memory({
        initial: memory.initial,
        maximum: memory.maximum,
        shared: memory.shared
      })
    };
  }
  const module = await loadWasmModule(source);
  const instance = await instantiateWasm(module, wasmImports);
  return { module, instance };
}
async function loadAssemblyScript(source, imports = {}) {
  const defaultImports = {
    env: {
      abort: (_message, fileName, line, column) => {
        console.error(`AssemblyScript abort at ${fileName}:${line}:${column}`);
      },
      seed: () => Date.now(),
      ...imports.env || {}
    },
    ...imports
  };
  const { module, instance } = await loadAndInstantiate({
    source,
    imports: defaultImports
  });
  return {
    module,
    instance,
    exports: instance.exports
  };
}
function wrapWasmExports(instance) {
  return instance.exports;
}
function getMemoryView(memory, ArrayType, offset = 0, length) {
  return new ArrayType(memory.buffer, offset, length);
}
function copyToWasmMemory(memory, data, offset) {
  const view = new Uint8Array(memory.buffer);
  const source = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  view.set(source, offset);
}
function copyFromWasmMemory(memory, offset, length) {
  const view = new Uint8Array(memory.buffer, offset, length);
  return new Uint8Array(view);
}
function clearWasmCache() {
  moduleCache.clear();
  instanceCache.clear();
}
function getWasmCacheStats() {
  return {
    modules: moduleCache.size,
    instances: instanceCache.size
  };
}

// src/index.ts
var logger2 = createLogger("ComputeKit");
var ComputeKit = class extends EventEmitter {
  pool;
  constructor(options = {}) {
    super();
    this.pool = new WorkerPool(options);
    logger2.debug("ComputeKit initialized", options);
  }
  /**
   * Initialize ComputeKit
   * Called automatically on first run, but can be called manually for eager initialization
   */
  async initialize() {
    await this.pool.initialize();
  }
  /**
   * Register a compute function
   *
   * @param name - Unique name for the function (autocompletes if registry is extended)
   * @param fn - The function to execute (will run in a Web Worker)
   *
   * @example
   * ```ts
   * // Basic usage
   * kit.register('sum', (arr: number[]) => arr.reduce((a, b) => a + b, 0));
   *
   * // With typed registry (extend ComputeFunctionRegistry for autocomplete)
   * // declare module '@computekit/core' {
   * //   interface ComputeFunctionRegistry {
   * //     sum: { input: number[]; output: number };
   * //   }
   * // }
   * // kit.register('sum', (arr) => arr.reduce((a, b) => a + b, 0));
   * ```
   */
  register(name, fn) {
    this.pool.register(name, fn);
    return this;
  }
  /**
   * Execute a registered compute function
   *
   * @param name - Name of the registered function (autocompletes if registry is extended)
   * @param input - Input data for the function (type-safe if registry is extended)
   * @param options - Execution options
   * @returns Promise resolving to the function result (type-safe if registry is extended)
   *
   * @example
   * ```ts
   * const sum = await kit.run('sum', [1, 2, 3, 4, 5]);
   *
   * // With typed registry, input/output types are inferred:
   * // const result = await kit.run('fibonacci', 50); // result: number
   * ```
   */
  async run(name, input, options) {
    return this.pool.execute(name, input, options);
  }
  /**
   * Execute a registered compute function with full result metadata
   *
   * @param name - Name of the registered function (autocompletes if registry is extended)
   * @param input - Input data for the function (type-safe if registry is extended)
   * @param options - Execution options
   * @returns Promise resolving to ComputeResult with metadata
   *
   * @example
   * ```ts
   * const result = await kit.runWithMetadata('sum', data);
   * console.log(`Took ${result.duration}ms`);
   * ```
   */
  async runWithMetadata(name, input, options) {
    const startTime = performance.now();
    const data = await this.pool.execute(
      name,
      input,
      options
    );
    const duration = performance.now() - startTime;
    return {
      data,
      duration,
      cached: false,
      workerId: "unknown"
      // Would need pool changes to track this
    };
  }
  /**
   * Get pool statistics
   */
  getStats() {
    return this.pool.getStats();
  }
  /**
   * Check if WebAssembly is supported
   */
  isWasmSupported() {
    return isWasmSupported();
  }
  /**
   * Terminate the worker pool and clean up resources
   */
  async terminate() {
    await this.pool.terminate();
    this.removeAllListeners();
  }
};
function createComputeKit(options) {
  return new ComputeKit(options);
}
var defaultInstance = null;
function getDefaultInstance() {
  if (!defaultInstance) {
    defaultInstance = new ComputeKit();
  }
  return defaultInstance;
}
function register(name, fn) {
  getDefaultInstance().register(name, fn);
}
async function run(name, input, options) {
  return getDefaultInstance().run(name, input, options);
}

export { ComputeKit, WorkerPool, clearWasmCache, copyFromWasmMemory, copyToWasmMemory, createComputeKit, findTransferables, getDefaultInstance, getHardwareConcurrency, getMemoryView, getWasmCacheStats, isSharedArrayBufferAvailable, isWasmSupported, loadAndInstantiate, loadAssemblyScript, loadWasmModule, register, run, wrapWasmExports };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map