'use client';

import { useEffect, useRef, useState } from 'react';
import { createRenderer, type Renderer } from './renderer';

interface Toggles {
  lensFlare: boolean;
  dirtyGlass: boolean;
  hoverRepel: boolean;
}

export function SpiralGalaxy() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [toggles, setToggles] = useState<Toggles>({ lensFlare: true, dirtyGlass: true, hoverRepel: true });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = createRenderer({ canvas });
    rendererRef.current = renderer;
    let cancelled = false;
    renderer.ready.then(
      () => {
        if (cancelled) return;
        setToggles({ ...renderer.settings });
        setStatus('ready');
      },
      (reason: unknown) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : String(reason));
        setStatus('error');
      },
    );
    return () => {
      cancelled = true;
      rendererRef.current = null;
      renderer.dispose();
    };
  }, []);

  const update = (patch: Partial<Toggles>) => {
    const renderer = rendererRef.current;
    setToggles((current) => ({ ...current, ...patch }));
    if (!renderer) return;
    if (patch.lensFlare !== undefined) renderer.setLensFlare(patch.lensFlare);
    if (patch.dirtyGlass !== undefined) renderer.setDirtyGlass(patch.dirtyGlass);
    if (patch.hoverRepel !== undefined) renderer.setHoverRepel(patch.hoverRepel);
  };

  return (
    <main className="hero">
      <canvas
        ref={canvasRef}
        tabIndex={0}
        aria-label="Spiral galaxy star field. Drag or use the arrow keys to rotate it; hover to scatter the stars."
      />

      {status === 'error' ? (
        <div className="status" role="alert">
          <p>
            <strong>Could not start the WebGPU renderer.</strong>
            {error ?? 'WebGPU is not available in this browser.'}
            <br />
            Try a current Chrome, Edge or Safari with WebGPU enabled.
          </p>
        </div>
      ) : null}

      <div className="overlay">
        <div className="topbar">
          <h1 className="title">
            Spiral Galaxy
            <small>{status === 'loading' ? 'Compiling shaders…' : 'WebGPU · vgpu'}</small>
          </h1>

          <div className="panel" aria-label="Controls">
            <button type="button" onClick={() => rendererRef.current?.replay()} disabled={status !== 'ready'}>
              Replay intro
            </button>
            <label>
              Lens flare
              <input
                type="checkbox"
                checked={toggles.lensFlare}
                onChange={(event) => update({ lensFlare: event.target.checked })}
              />
            </label>
            <label>
              Dirty glass
              <input
                type="checkbox"
                checked={toggles.dirtyGlass}
                onChange={(event) => update({ dirtyGlass: event.target.checked })}
              />
            </label>
            <label>
              Hover repel
              <input
                type="checkbox"
                checked={toggles.hoverRepel}
                onChange={(event) => update({ hoverRepel: event.target.checked })}
              />
            </label>
          </div>
        </div>

        <p className="hint">Drag to rotate · hover to scatter · arrow keys to nudge</p>
      </div>
    </main>
  );
}

export default SpiralGalaxy;
