import { useState, useEffect, useRef } from 'react';
import { loadWasm, type WasmExports } from '../wasmLoader';

// Format time with appropriate units
function formatTime(ms: number): string {
  if (ms === 0) return '⚡ < 1μs';
  if (ms < 0.1) return `${(ms * 1000).toFixed(2)}μs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

interface BenchmarkResult {
  jsTime: number;
  wasmTime: number;
  jsResult: string;
  wasmResult: string;
  jsImageData: Uint8ClampedArray;
  wasmImageData: Uint8ClampedArray;
  width: number;
  height: number;
}

export function WasmBenchmark() {
  const [blurPasses, setBlurPasses] = useState(200);
  const [imageSize, setImageSize] = useState(256);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [wasmModule, setWasmModule] = useState<WasmExports | null>(null);
  const [wasmError, setWasmError] = useState<string | null>(null);

  const jsCanvasRef = useRef<HTMLCanvasElement>(null);
  const wasmCanvasRef = useRef<HTMLCanvasElement>(null);

  // Load WASM module
  useEffect(() => {
    loadWasm()
      .then((wasm) => {
        setWasmModule(wasm);
        console.log('WASM loaded, exports:', Object.keys(wasm));
      })
      .catch((err) => {
        console.error('Failed to load WASM:', err);
        setWasmError(err instanceof Error ? err.message : 'Failed to load WASM');
      });
  }, []);

  // Draw images to canvas after result is set
  useEffect(() => {
    if (!result) return;

    const { jsImageData, wasmImageData, width, height } = result;

    // Draw JS result
    const jsCanvas = jsCanvasRef.current;
    if (jsCanvas) {
      jsCanvas.width = width;
      jsCanvas.height = height;
      const ctx = jsCanvas.getContext('2d');
      if (ctx) {
        const imgData = new ImageData(new Uint8ClampedArray(jsImageData), width, height);
        ctx.putImageData(imgData, 0, 0);
      }
    }

    // Draw WASM result
    const wasmCanvas = wasmCanvasRef.current;
    if (wasmCanvas) {
      wasmCanvas.width = width;
      wasmCanvas.height = height;
      const ctx = wasmCanvas.getContext('2d');
      if (ctx) {
        const imgData = new ImageData(
          new Uint8ClampedArray(wasmImageData),
          width,
          height
        );
        ctx.putImageData(imgData, 0, 0);
      }
    }
  }, [result]);

  // JavaScript blur - separable filter (horizontal + vertical) to match WASM SIMD
  const blurImageJS = (
    data: Uint8ClampedArray,
    width: number,
    height: number,
    passes: number
  ): void => {
    const temp = new Uint8ClampedArray(data.length);
    const stride = width * 4;

    for (let pass = 0; pass < passes; pass++) {
      // === HORIZONTAL BLUR PASS ===
      // Read from data, write to temp
      for (let y = 0; y < height; y++) {
        const rowIn = y * stride;
        const rowOut = y * stride;

        // Copy first pixel (edge)
        temp[rowOut] = data[rowIn];
        temp[rowOut + 1] = data[rowIn + 1];
        temp[rowOut + 2] = data[rowIn + 2];
        temp[rowOut + 3] = data[rowIn + 3];

        // Interior pixels
        for (let x = 1; x < width - 1; x++) {
          const px = x * 4;
          // Average left, center, right
          for (let c = 0; c < 3; c++) {
            const sum =
              data[rowIn + px - 4 + c] + data[rowIn + px + c] + data[rowIn + px + 4 + c];
            temp[rowOut + px + c] = (sum * 10923) >> 15; // divide by 3
          }
          temp[rowOut + px + 3] = 255;
        }

        // Copy last pixel (edge)
        const lastPx = (width - 1) * 4;
        temp[rowOut + lastPx] = data[rowIn + lastPx];
        temp[rowOut + lastPx + 1] = data[rowIn + lastPx + 1];
        temp[rowOut + lastPx + 2] = data[rowIn + lastPx + 2];
        temp[rowOut + lastPx + 3] = data[rowIn + lastPx + 3];
      }

      // === VERTICAL BLUR PASS ===
      // Read from temp, write to data
      // Copy top row (edge)
      for (let i = 0; i < stride; i++) {
        data[i] = temp[i];
      }

      // Interior rows
      for (let y = 1; y < height - 1; y++) {
        const rowAbove = (y - 1) * stride;
        const rowCenter = y * stride;
        const rowBelow = (y + 1) * stride;

        for (let x = 0; x < width; x++) {
          const px = x * 4;
          // Average top, center, bottom
          for (let c = 0; c < 3; c++) {
            const sum =
              temp[rowAbove + px + c] +
              temp[rowCenter + px + c] +
              temp[rowBelow + px + c];
            data[rowCenter + px + c] = (sum * 10923) >> 15; // divide by 3
          }
          data[rowCenter + px + 3] = 255;
        }
      }

      // Copy bottom row (edge)
      const bottomRow = (height - 1) * stride;
      for (let i = 0; i < stride; i++) {
        data[bottomRow + i] = temp[bottomRow + i];
      }
    }
  };

  // Generate test image - deterministic gradient (no random)
  const generateTestImage = (width: number, height: number): Uint8ClampedArray => {
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        data[idx] = Math.floor((x * 255) / width); // R
        data[idx + 1] = Math.floor((y * 255) / height); // G
        data[idx + 2] = 128; // B
        data[idx + 3] = 255; // A
      }
    }

    return data;
  };

  const runBenchmark = async () => {
    setLoading(true);
    setResult(null);

    await new Promise((r) => setTimeout(r, 10));

    const width = imageSize;
    const height = imageSize;
    const passes = blurPasses;

    // Generate source image
    const sourceImage = generateTestImage(width, height);

    let jsTime = 0,
      wasmTime = 0;
    let jsResult = '',
      wasmResult = '';
    let jsImageData = new Uint8ClampedArray(0);
    let wasmImageData = new Uint8ClampedArray(0);

    // === JavaScript Version ===
    const jsData = new Uint8ClampedArray(sourceImage);
    const jsStart = performance.now();
    blurImageJS(jsData, width, height, passes);
    jsTime = performance.now() - jsStart;

    // Calculate checksum
    let jsChecksum = 0;
    for (let i = 0; i < jsData.length; i++) jsChecksum += jsData[i];
    jsResult = `checksum: ${jsChecksum.toLocaleString()}`;
    jsImageData = new Uint8ClampedArray(jsData);

    // === WebAssembly Version ===
    if (wasmModule?.blurImage && wasmModule?.memory && wasmModule?.getBufferPtr) {
      const bufferPtr = wasmModule.getBufferPtr();
      const neededBytes = bufferPtr + width * height * 4 * 2; // Image + temp buffer

      // Grow memory if needed
      const currentBytes = wasmModule.memory.buffer.byteLength;
      if (neededBytes > currentBytes) {
        const pagesNeeded = Math.ceil((neededBytes - currentBytes) / 65536);
        wasmModule.memory.grow(pagesNeeded);
      }

      // Get buffer reference AFTER potential memory.grow (buffer gets detached on grow)
      const memBuffer = wasmModule.memory.buffer;

      // Copy source image to WASM memory
      const wasmMemView = new Uint8ClampedArray(memBuffer, bufferPtr, width * height * 4);
      wasmMemView.set(sourceImage);

      // Time the blur operation (NOT including memory copy)
      const wasmStart = performance.now();
      wasmModule.blurImage(width, height, passes);
      wasmTime = performance.now() - wasmStart;

      // Read back for display and checksum (re-get buffer in case WASM modified it)
      const resultBuffer = wasmModule.memory.buffer;
      const wasmResultData = new Uint8ClampedArray(
        resultBuffer,
        bufferPtr,
        width * height * 4
      );

      // Copy to a new array for ImageData (ImageData needs its own buffer)
      wasmImageData = new Uint8ClampedArray(wasmResultData);

      let wasmChecksum = 0;
      for (let i = 0; i < wasmImageData.length; i++) wasmChecksum += wasmImageData[i];
      wasmResult = `checksum: ${wasmChecksum.toLocaleString()}`;
    } else {
      wasmResult = 'N/A (WASM not loaded)';
      wasmImageData = new Uint8ClampedArray(width * height * 4);
    }

    setResult({
      jsTime,
      wasmTime,
      jsResult,
      wasmResult,
      jsImageData,
      wasmImageData,
      width,
      height,
    });
    setLoading(false);
  };

  const speedup =
    result && result.wasmTime > 0 ? (result.jsTime / result.wasmTime).toFixed(1) : 'N/A';

  return (
    <div className="card" style={{ gridColumn: 'span 2', marginBottom: '1rem' }}>
      <h3>⚡ JS vs WASM: Image Blur Benchmark</h3>
      <p>
        Multi-pass Gaussian blur comparison. V8's JIT is highly optimized - WASM shines
        with SIMD, existing C/C++ code, or consistent latency requirements.
      </p>

      {wasmError && (
        <div style={{ color: '#f85149', marginBottom: '1rem' }}>
          WASM Error: {wasmError}
        </div>
      )}

      <div
        style={{ display: 'flex', gap: '2rem', marginBottom: '1rem', flexWrap: 'wrap' }}
      >
        <div className="control-group" style={{ flex: 1, minWidth: '200px' }}>
          <label>
            Image Size: {imageSize}×{imageSize}
          </label>
          <input
            type="range"
            min={128}
            max={512}
            step={64}
            value={imageSize}
            onChange={(e) => setImageSize(Number(e.target.value))}
          />
        </div>

        <div className="control-group" style={{ flex: 1, minWidth: '200px' }}>
          <label>Blur Passes: {blurPasses}</label>
          <input
            type="range"
            min={50}
            max={1000}
            step={50}
            value={blurPasses}
            onChange={(e) => setBlurPasses(Number(e.target.value))}
          />
          <span style={{ color: '#8b949e', fontSize: '0.8rem' }}>
            (more passes = more compute)
          </span>
        </div>
      </div>

      <div className="btn-group" style={{ marginBottom: '1rem' }}>
        <button
          className="primary"
          onClick={runBenchmark}
          disabled={loading || !wasmModule}
        >
          {loading ? 'Running...' : '🚀 Run Benchmark'}
        </button>
      </div>

      {result && (
        <>
          <div className="result">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <div style={{ color: '#8b949e', marginBottom: '0.5rem' }}>JavaScript</div>
                <div style={{ color: '#f0883e', fontSize: '1.5rem', fontWeight: 'bold' }}>
                  {formatTime(result.jsTime)}
                </div>
                <div style={{ color: '#7ee787', fontSize: '0.85rem' }}>
                  {result.jsResult}
                </div>
              </div>
              <div>
                <div style={{ color: '#8b949e', marginBottom: '0.5rem' }}>
                  WebAssembly
                </div>
                <div style={{ color: '#58a6ff', fontSize: '1.5rem', fontWeight: 'bold' }}>
                  {formatTime(result.wasmTime)}
                </div>
                <div style={{ color: '#7ee787', fontSize: '0.85rem' }}>
                  {result.wasmResult}
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: '1rem',
                padding: '1rem',
                background:
                  parseFloat(speedup) > 1
                    ? 'rgba(126, 231, 135, 0.1)'
                    : 'rgba(248, 81, 73, 0.1)',
                borderRadius: '8px',
                textAlign: 'center',
              }}
            >
              <span style={{ color: '#8b949e' }}>WASM Speedup: </span>
              <span
                style={{
                  color: parseFloat(speedup) > 1 ? '#7ee787' : '#f85149',
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                }}
              >
                {speedup}x
              </span>
              {parseFloat(speedup) > 1 && (
                <span style={{ color: '#7ee787', marginLeft: '0.5rem' }}>faster! 🚀</span>
              )}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
              marginTop: '1rem',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#8b949e', marginBottom: '0.5rem' }}>JS Result</div>
              <canvas
                ref={jsCanvasRef}
                width={imageSize}
                height={imageSize}
                style={{
                  border: '1px solid #30363d',
                  width: `${Math.min(imageSize, 256)}px`,
                  height: `${Math.min(imageSize, 256)}px`,
                  backgroundColor: '#0d1117',
                }}
              />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#8b949e', marginBottom: '0.5rem' }}>WASM Result</div>
              <canvas
                ref={wasmCanvasRef}
                width={imageSize}
                height={imageSize}
                style={{
                  border: '1px solid #30363d',
                  width: `${Math.min(imageSize, 256)}px`,
                  height: `${Math.min(imageSize, 256)}px`,
                  backgroundColor: '#0d1117',
                }}
              />
            </div>
          </div>
        </>
      )}

      <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#8b949e' }}>
        <strong>Note:</strong> V8's JIT compiler is incredibly well-engineered and highly
        optimized. For most tasks, JavaScript performs remarkably well. WASM only
        outperforms it when dealing with heavy computation like this multi-pass blur,
        where low-level optimizations (packed memory access, loop unrolling) make the
        difference.
      </div>
    </div>
  );
}
