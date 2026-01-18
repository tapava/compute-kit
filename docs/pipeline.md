---
layout: default
title: Multi-Stage Pipelines
nav_order: 5
---

# Multi-Stage Pipelines

{: .no_toc }

Build complex, debuggable multi-stage compute workflows with automatic progress tracking, error handling, and execution reports.
{: .fs-6 .fw-300 }

## Table of contents

{: .no_toc .text-delta }

1. TOC
   {:toc}

---

## Overview

ComputeKit's pipeline system enables you to chain multiple compute operations together, with each stage's output becoming the next stage's input. This is perfect for workflows like:

- **File Processing**: Download → Parse → Transform → Compress
- **Data Pipelines**: Fetch → Validate → Process → Aggregate
- **Image Processing**: Load → Resize → Filter → Encode
- **ML Workflows**: Preprocess → Inference → Postprocess

## Quick Start

```tsx
import { usePipeline } from '@computekit/react';

function FileProcessor() {
  const pipeline = usePipeline([
    { id: 'download', name: 'Download Files', functionName: 'downloadFiles' },
    { id: 'process', name: 'Process Files', functionName: 'processFiles' },
    { id: 'compress', name: 'Compress Output', functionName: 'compressFiles' },
  ]);

  return (
    <div>
      <button onClick={() => pipeline.run(fileUrls)} disabled={pipeline.isRunning}>
        Start Processing
      </button>

      <ProgressBar value={pipeline.progress} />

      {pipeline.currentStage && <p>Current: {pipeline.currentStage.name}</p>}
    </div>
  );
}
```

## The `usePipeline` Hook

### Basic Usage

```tsx
const pipeline = usePipeline<InputType, OutputType>(stages, options);
```

### Stage Configuration

Each stage is defined with a `StageConfig` object:

```tsx
interface StageConfig {
  // Required
  id: string; // Unique identifier
  name: string; // Display name
  functionName: string; // Registered compute function name

  // Optional
  transformInput?: (input, previousResults) => any; // Transform before execution
  transformOutput?: (output) => any; // Transform after execution
  shouldSkip?: (input, previousResults) => boolean; // Conditionally skip
  maxRetries?: number; // Retry attempts on failure (default: 0)
  retryDelay?: number; // Delay between retries in ms (default: 1000)
  options?: ComputeOptions; // Per-stage compute options
}
```

### Pipeline State

The hook returns comprehensive state for debugging and UI:

```tsx
const {
  // Status
  status, // 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
  isRunning, // boolean
  isComplete, // boolean
  isFailed, // boolean

  // Progress
  progress, // Overall progress (0-100)
  currentStage, // Current StageInfo or null
  currentStageIndex, // Index of current stage (-1 if not running)
  stages, // Array of all StageInfo objects

  // Data
  input, // Original input
  output, // Final output (when complete)
  stageResults, // Array of each stage's output
  error, // Error if failed

  // Timing
  startedAt, // Start timestamp
  completedAt, // End timestamp
  totalDuration, // Total duration in ms

  // Metrics (for debugging)
  metrics, // PipelineMetrics object

  // Actions
  run, // (input) => Promise<void>
  cancel, // () => void
  reset, // () => void
  pause, // () => void
  resume, // () => void
  retry, // () => Promise<void>
  getReport, // () => PipelineReport

  // Helpers
  isStageComplete, // (stageId) => boolean
  getStage, // (stageId) => StageInfo | undefined
} = usePipeline(stages, options);
```

## Examples

### Complete Pipeline UI

{% raw %}

```tsx
function DataPipeline() {
  const pipeline = usePipeline([
    { id: 'fetch', name: 'Fetch Data', functionName: 'fetchData' },
    { id: 'validate', name: 'Validate', functionName: 'validateData' },
    { id: 'transform', name: 'Transform', functionName: 'transformData' },
    { id: 'save', name: 'Save Results', functionName: 'saveData' },
  ]);

  return (
    <div className="pipeline-container">
      {/* Controls */}
      <div className="controls">
        <button
          onClick={() => pipeline.run({ url: '/api/data' })}
          disabled={pipeline.isRunning}
        >
          Start Pipeline
        </button>

        {pipeline.isRunning && (
          <>
            <button onClick={pipeline.pause}>Pause</button>
            <button onClick={pipeline.cancel}>Cancel</button>
          </>
        )}

        {pipeline.status === 'paused' && (
          <button onClick={pipeline.resume}>Resume</button>
        )}

        {pipeline.isFailed && <button onClick={pipeline.retry}>Retry Failed</button>}
      </div>

      {/* Overall Progress */}
      <div className="progress-section">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${pipeline.progress}%` }} />
        </div>
        <span>{pipeline.progress.toFixed(0)}%</span>
      </div>

      {/* Stage List */}
      <div className="stages">
        {pipeline.stages.map((stage, index) => (
          <div key={stage.id} className={`stage stage-${stage.status}`}>
            <div className="stage-indicator">
              {stage.status === 'completed' && '✓'}
              {stage.status === 'running' && '⟳'}
              {stage.status === 'failed' && '✗'}
              {stage.status === 'pending' && '○'}
              {stage.status === 'skipped' && '–'}
            </div>

            <div className="stage-info">
              <span className="stage-name">{stage.name}</span>
              {stage.duration && (
                <span className="stage-duration">{stage.duration.toFixed(0)}ms</span>
              )}
              {stage.error && <span className="stage-error">{stage.error.message}</span>}
            </div>

            {stage.status === 'running' && stage.progress && (
              <div className="stage-progress">{stage.progress.toFixed(0)}%</div>
            )}
          </div>
        ))}
      </div>

      {/* Error Display */}
      {pipeline.error && (
        <div className="error-panel">
          <h4>Pipeline Failed</h4>
          <p>{pipeline.error.message}</p>
          <button onClick={pipeline.retry}>Retry</button>
        </div>
      )}

      {/* Success + Report */}
      {pipeline.isComplete && (
        <div className="success-panel">
          <h4>Pipeline Complete!</h4>
          <pre>{pipeline.getReport().summary}</pre>
        </div>
      )}
    </div>
  );
}
```

{% endraw %}

### Conditional Stage Skipping

```tsx
const pipeline = usePipeline([
  {
    id: 'fetch',
    name: 'Fetch Data',
    functionName: 'fetchData',
  },
  {
    id: 'cache-check',
    name: 'Check Cache',
    functionName: 'checkCache',
  },
  {
    id: 'process',
    name: 'Process Data',
    functionName: 'processData',
    // Skip processing if cache hit
    shouldSkip: (input, previousResults) => {
      const cacheResult = previousResults[1];
      return cacheResult?.cacheHit === true;
    },
  },
  {
    id: 'save',
    name: 'Save Results',
    functionName: 'saveResults',
  },
]);
```

### Input/Output Transformation

```tsx
const pipeline = usePipeline([
  {
    id: 'fetch',
    name: 'Fetch Users',
    functionName: 'fetchUsers',
  },
  {
    id: 'enrich',
    name: 'Enrich Data',
    functionName: 'enrichUsers',
    // Extract just the users array from previous result
    transformInput: (input, previousResults) => {
      const fetchResult = previousResults[0];
      return fetchResult.users;
    },
    // Wrap the result
    transformOutput: (output) => ({
      enrichedUsers: output,
      timestamp: Date.now(),
    }),
  },
]);
```

### With Retries

```tsx
const pipeline = usePipeline([
  {
    id: 'upload',
    name: 'Upload Files',
    functionName: 'uploadFiles',
    maxRetries: 3,
    retryDelay: 2000, // Wait 2s between retries
  },
  {
    id: 'process',
    name: 'Process on Server',
    functionName: 'serverProcess',
    maxRetries: 2,
    retryDelay: 5000,
  },
]);
```

## Parallel Batch Processing

For processing multiple items in parallel within a single stage, use `useParallelBatch`:

```tsx
import { useParallelBatch } from '@computekit/react';

function ImageProcessor() {
  const batch = useParallelBatch<string, ProcessedImage>('processImage', {
    concurrency: 4, // Process 4 images at a time
  });

  const handleProcess = async () => {
    const result = await batch.run(imageUrls);

    console.log(`Processed ${result.successful.length} images`);
    console.log(`Failed: ${result.failed.length}`);
    console.log(`Success rate: ${(result.successRate * 100).toFixed(0)}%`);
  };

  return (
    <div>
      <button onClick={handleProcess} disabled={batch.loading}>
        Process {imageUrls.length} Images
      </button>

      {batch.loading && (
        <div>
          Processing: {batch.completedCount}/{batch.totalCount}(
          {batch.progress.toFixed(0)}%)
        </div>
      )}

      {batch.result && (
        <div>
          <p>✓ {batch.result.successful.length} succeeded</p>
          <p>✗ {batch.result.failed.length} failed</p>
          <p>Duration: {batch.result.totalDuration.toFixed(0)}ms</p>
        </div>
      )}
    </div>
  );
}
```

## Debugging & Reports

### Pipeline Metrics

Access detailed metrics for debugging:

```tsx
const { metrics } = pipeline;

console.log(metrics);
// {
//   totalStages: 4,
//   completedStages: 4,
//   failedStages: 0,
//   skippedStages: 0,
//   totalRetries: 1,
//   slowestStage: { id: 'process', name: 'Process Files', duration: 2340 },
//   fastestStage: { id: 'fetch', name: 'Fetch Data', duration: 120 },
//   averageStageDuration: 890,
//   timeline: [...] // Detailed event timeline
// }
```

### Execution Report

Generate a human-readable report:

```tsx
const report = pipeline.getReport();

console.log(report.summary);
// Pipeline Status: COMPLETED
// Stages: 4/4 completed
// Success Rate: 100%
// Total Duration: 3.56s

console.log(report.stageDetails);
// [
//   { name: 'Fetch Data', status: 'completed', duration: '120ms' },
//   { name: 'Validate', status: 'completed', duration: '45ms' },
//   { name: 'Process', status: 'completed', duration: '2.34s' },
//   { name: 'Save', status: 'completed', duration: '1.05s' },
// ]

console.log(report.timeline);
// [
//   '[10:30:01] Fetch Data: started',
//   '[10:30:01] Fetch Data: completed (120ms)',
//   '[10:30:01] Validate: started',
//   ...
// ]

console.log(report.insights);
// [
//   'Slowest stage: Process Files (2.34s)',
//   'Fastest stage: Validate (45ms)',
//   'Average stage duration: 890ms',
// ]
```

### Timeline Visualization

Build a timeline UI from the metrics:

{% raw %}

```tsx
function PipelineTimeline({ metrics }: { metrics: PipelineMetrics }) {
  const startTime = metrics.timeline[0]?.timestamp ?? 0;

  return (
    <div className="timeline">
      {metrics.timeline.map((event, i) => (
        <div
          key={i}
          className={`timeline-event event-${event.event}`}
          style={{
            left: `${((event.timestamp - startTime) / 1000) * 50}px`,
          }}
        >
          <div className="event-marker" />
          <div className="event-label">
            {event.stageName}: {event.event}
            {event.duration && ` (${event.duration.toFixed(0)}ms)`}
          </div>
        </div>
      ))}
    </div>
  );
}
```

{% endraw %}

## Pipeline Options

```tsx
const pipeline = usePipeline(stages, {
  // Stop pipeline on first stage failure (default: true)
  stopOnError: true,

  // Global timeout for entire pipeline
  timeout: 60000,

  // Track detailed timeline (default: true)
  trackTimeline: true,

  // Auto-run on mount
  autoRun: false,
  initialInput: undefined,

  // Callbacks
  onStateChange: (state) => console.log('State:', state.status),
  onStageStart: (stage) => console.log('Starting:', stage.name),
  onStageComplete: (stage) => console.log('Completed:', stage.name),
  onStageError: (stage, error) => console.error('Failed:', stage.name, error),
  onStageRetry: (stage, attempt) => console.log('Retry:', stage.name, attempt),
});
```

## Combining Pipeline with Parallel Batch

For the user's original use case (multi-file download → process → compress):

```tsx
function MultiFileProcessor() {
  const kit = useComputeKit();

  // Register functions that handle batches
  useEffect(() => {
    kit.register('downloadBatch', async (urls: string[]) => {
      // Download all files in parallel
      return Promise.all(urls.map((url) => fetch(url).then((r) => r.arrayBuffer())));
    });

    kit.register('processBatch', async (files: ArrayBuffer[]) => {
      // Process all files in parallel
      return Promise.all(files.map((file) => processFile(file)));
    });

    kit.register('compressBatch', async (files: ProcessedFile[]) => {
      // Compress all files
      return Promise.all(files.map((file) => compress(file)));
    });
  }, [kit]);

  const pipeline = usePipeline<string[], CompressedFile[]>([
    { id: 'download', name: 'Download Files', functionName: 'downloadBatch' },
    { id: 'process', name: 'Process Files', functionName: 'processBatch' },
    { id: 'compress', name: 'Compress Files', functionName: 'compressBatch' },
  ]);

  return (
    <div>
      <button onClick={() => pipeline.run(fileUrls)}>
        Process {fileUrls.length} Files
      </button>

      <PipelineProgress pipeline={pipeline} />

      {pipeline.isComplete && (
        <div>
          Processed {pipeline.output?.length} files in{' '}
          {(pipeline.totalDuration! / 1000).toFixed(2)}s
        </div>
      )}
    </div>
  );
}
```

## Type Safety

The pipeline is fully typed:

```tsx
interface InputData {
  urls: string[];
  options: ProcessOptions;
}

interface OutputData {
  files: ProcessedFile[];
  stats: ProcessingStats;
}

const pipeline = usePipeline<InputData, OutputData>([
  // ... stages
]);

// pipeline.input is InputData | null
// pipeline.output is OutputData | null
// TypeScript will enforce types throughout
```
