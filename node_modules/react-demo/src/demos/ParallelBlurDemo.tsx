import { useState, useEffect, useRef } from 'react';
import { useComputeKit } from '@computekit/react';

// Format time with appropriate units
function formatTime(ms: number): string {
  if (ms === 0) return '⚡ < 1μs';
  if (ms < 0.1) return `${(ms * 1000).toFixed(2)}μs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

interface ImageResult {
  id: number;
  data: Uint8ClampedArray;
  time: number;
}

interface BlurInput {
  imageData: number[];
  width: number;
  height: number;
  passes: number;
}

// Blur function that runs in a Web Worker
function workerBlurImage(input: BlurInput): number[] {
  const { imageData, width, height, passes } = input;
  const data = new Uint8ClampedArray(imageData);
  const temp = new Uint8ClampedArray(data.length);
  const stride = width * 4;

  for (let pass = 0; pass < passes; pass++) {
    // Horizontal blur
    for (let y = 0; y < height; y++) {
      const row = y * stride;
      temp[row] = data[row];
      temp[row + 1] = data[row + 1];
      temp[row + 2] = data[row + 2];
      temp[row + 3] = data[row + 3];

      for (let x = 1; x < width - 1; x++) {
        const px = x * 4;
        for (let c = 0; c < 3; c++) {
          const sum =
            data[row + px - 4 + c] + data[row + px + c] + data[row + px + 4 + c];
          temp[row + px + c] = (sum * 10923) >> 15;
        }
        temp[row + px + 3] = 255;
      }

      const lastPx = (width - 1) * 4;
      temp[row + lastPx] = data[row + lastPx];
      temp[row + lastPx + 1] = data[row + lastPx + 1];
      temp[row + lastPx + 2] = data[row + lastPx + 2];
      temp[row + lastPx + 3] = data[row + lastPx + 3];
    }

    // Vertical blur
    for (let i = 0; i < stride; i++) data[i] = temp[i];

    for (let y = 1; y < height - 1; y++) {
      const rowAbove = (y - 1) * stride;
      const rowCenter = y * stride;
      const rowBelow = (y + 1) * stride;

      for (let x = 0; x < width; x++) {
        const px = x * 4;
        for (let c = 0; c < 3; c++) {
          const sum =
            temp[rowAbove + px + c] + temp[rowCenter + px + c] + temp[rowBelow + px + c];
          data[rowCenter + px + c] = (sum * 10923) >> 15;
        }
        data[rowCenter + px + 3] = 255;
      }
    }

    const bottomRow = (height - 1) * stride;
    for (let i = 0; i < stride; i++) data[bottomRow + i] = temp[bottomRow + i];
  }

  return Array.from(data);
}

export function ParallelBlurDemo() {
  const kit = useComputeKit();
  const [imageCount, setImageCount] = useState(4);
  const [blurPasses, setBlurPasses] = useState(100);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ImageResult[]>([]);
  const [totalTime, setTotalTime] = useState(0);
  const [sequentialTime, setSequentialTime] = useState(0);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  const imageSize = 128;

  // Register the blur function
  useEffect(() => {
    kit.register('blurImage', workerBlurImage);
  }, [kit]);

  // Generate a test image with a unique color based on index
  const generateTestImage = (index: number): Uint8ClampedArray => {
    const data = new Uint8ClampedArray(imageSize * imageSize * 4);
    const hue = (index * 360) / imageCount;

    for (let y = 0; y < imageSize; y++) {
      for (let x = 0; x < imageSize; x++) {
        const idx = (y * imageSize + x) * 4;
        // Create a gradient with different base colors per image
        const r = Math.floor(128 + 127 * Math.sin((hue * Math.PI) / 180));
        const g = Math.floor(128 + 127 * Math.sin(((hue + 120) * Math.PI) / 180));
        const b = Math.floor(128 + 127 * Math.sin(((hue + 240) * Math.PI) / 180));

        data[idx] = Math.floor((r * x) / imageSize);
        data[idx + 1] = Math.floor((g * y) / imageSize);
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
    return data;
  };

  // Draw results to canvases
  useEffect(() => {
    results.forEach((result, i) => {
      const canvas = canvasRefs.current[i];
      if (canvas) {
        canvas.width = imageSize;
        canvas.height = imageSize;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const imgData = new ImageData(
            new Uint8ClampedArray(result.data),
            imageSize,
            imageSize
          );
          ctx.putImageData(imgData, 0, 0);
        }
      }
    });
  }, [results]);

  const runParallelBlur = async () => {
    setLoading(true);
    setResults([]);

    await new Promise((r) => setTimeout(r, 10));

    // Generate source images
    const sourceImages = Array.from({ length: imageCount }, (_, i) =>
      generateTestImage(i)
    );

    // Estimate sequential time (run one as baseline)
    const seqStart = performance.now();
    const testData = Array.from(sourceImages[0]);
    await kit.run('blurImage', {
      imageData: testData,
      width: imageSize,
      height: imageSize,
      passes: blurPasses,
    });
    const singleImageTime = performance.now() - seqStart;
    setSequentialTime(singleImageTime * imageCount);

    // Run all images in parallel through the worker pool
    const parallelStart = performance.now();

    const promises = sourceImages.map(async (img, index) => {
      const start = performance.now();
      const result = (await kit.run('blurImage', {
        imageData: Array.from(img),
        width: imageSize,
        height: imageSize,
        passes: blurPasses,
      })) as number[];
      const time = performance.now() - start;
      return {
        id: index,
        data: new Uint8ClampedArray(result),
        time,
      };
    });

    const imageResults = await Promise.all(promises);
    const parallelTime = performance.now() - parallelStart;

    setTotalTime(parallelTime);
    setResults(imageResults.sort((a, b) => a.id - b.id));
    setLoading(false);
  };

  const speedup =
    sequentialTime > 0 && totalTime > 0 ? (sequentialTime / totalTime).toFixed(1) : 'N/A';

  return (
    <div className="card" style={{ gridColumn: 'span 2', marginBottom: '1rem' }}>
      <h3>🔄 Parallel Image Blur (Worker Pool)</h3>
      <p>
        Process multiple images in parallel using the Web Worker pool. Watch the Pool
        Monitor above to see workers in action!
      </p>

      <div
        style={{ display: 'flex', gap: '2rem', marginBottom: '1rem', flexWrap: 'wrap' }}
      >
        <div className="control-group" style={{ flex: 1, minWidth: '200px' }}>
          <label>Number of Images: {imageCount}</label>
          <input
            type="range"
            min={2}
            max={8}
            step={1}
            value={imageCount}
            onChange={(e) => setImageCount(Number(e.target.value))}
          />
        </div>

        <div className="control-group" style={{ flex: 1, minWidth: '200px' }}>
          <label>Blur Passes: {blurPasses}</label>
          <input
            type="range"
            min={50}
            max={500}
            step={50}
            value={blurPasses}
            onChange={(e) => setBlurPasses(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="btn-group" style={{ marginBottom: '1rem' }}>
        <button className="primary" onClick={runParallelBlur} disabled={loading}>
          {loading ? 'Processing...' : '🚀 Run Parallel Blur'}
        </button>
      </div>

      {results.length > 0 && (
        <>
          <div className="result">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <div style={{ color: '#8b949e', marginBottom: '0.5rem' }}>
                  Sequential (estimated)
                </div>
                <div style={{ color: '#f0883e', fontSize: '1.5rem', fontWeight: 'bold' }}>
                  {formatTime(sequentialTime)}
                </div>
              </div>
              <div>
                <div style={{ color: '#8b949e', marginBottom: '0.5rem' }}>
                  Parallel ({imageCount} workers)
                </div>
                <div style={{ color: '#58a6ff', fontSize: '1.5rem', fontWeight: 'bold' }}>
                  {formatTime(totalTime)}
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: '1rem',
                padding: '1rem',
                background: 'rgba(126, 231, 135, 0.1)',
                borderRadius: '8px',
                textAlign: 'center',
              }}
            >
              <span style={{ color: '#8b949e' }}>Parallel Speedup: </span>
              <span
                style={{
                  color: '#7ee787',
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                }}
              >
                {speedup}x
              </span>
              <span style={{ color: '#7ee787', marginLeft: '0.5rem' }}>faster! 🚀</span>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.min(imageCount, 4)}, 1fr)`,
              gap: '0.5rem',
              marginTop: '1rem',
            }}
          >
            {results.map((result, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <canvas
                  ref={(el) => (canvasRefs.current[i] = el)}
                  style={{
                    border: '1px solid #30363d',
                    width: '100%',
                    maxWidth: '128px',
                    height: 'auto',
                    aspectRatio: '1',
                    backgroundColor: '#0d1117',
                  }}
                />
                <div
                  style={{ fontSize: '0.75rem', color: '#8b949e', marginTop: '0.25rem' }}
                >
                  {formatTime(result.time)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#8b949e' }}>
        <strong>Note:</strong> Each image is processed by a separate Web Worker. The pool
        distributes work across available CPU cores, showing near-linear speedup with the
        number of images (up to the worker pool size).
      </div>
    </div>
  );
}
