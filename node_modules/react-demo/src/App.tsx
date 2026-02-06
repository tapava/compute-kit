import { useEffect, useState } from 'react';
import { useComputeKit, useWasmSupport } from '@computekit/react';

// Demo Components
import { PoolMonitor } from './demos/PoolMonitor';
import { WasmBenchmark } from './demos/WasmBenchmark';
import { ParallelBlurDemo } from './demos/ParallelBlurDemo';

function App() {
  const kit = useComputeKit();
  const wasmSupported = useWasmSupport();
  const [ready, setReady] = useState(false);

  // Register compute functions that run entirely in Web Workers
  useEffect(() => {
    // Simple test function
    kit.register('double', (n: number) => n * 2);

    setReady(true);
  }, [kit]);

  return (
    <div>
      <header className="header">
        <div className="brand">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: '#58a6ff' }}
          >
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
          ComputeKit <span>React Demo</span>
        </div>
        <div className="nav-links">
          {wasmSupported ? (
            <span className="status success">✓ WASM Supported</span>
          ) : (
            <span className="status error">✗ WASM Not Available</span>
          )}
          {ready && (
            <span className="status success" style={{ marginLeft: '0.5rem' }}>
              ✓ Workers Ready
            </span>
          )}
        </div>
      </header>

      <div className="container">
        <h1>ComputeKit React Demo</h1>
        <p style={{ color: '#8b949e', marginBottom: '2rem', maxWidth: '600px' }}>
          All computations run in Web Workers off the main thread, keeping the UI
          responsive even during heavy calculations.
        </p>

        {!ready ? (
          <div className="card">
            <p>Initializing...</p>
          </div>
        ) : (
          <>
            <PoolMonitor />
            <ParallelBlurDemo />
            <WasmBenchmark />
          </>
        )}
      </div>
    </div>
  );
}

export default App;
