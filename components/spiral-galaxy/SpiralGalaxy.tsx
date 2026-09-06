'use client';

import { useEffect, useRef, useState } from 'react';
import { createRenderer, type Renderer } from './renderer';
import { Unsupported } from './Unsupported';

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

  // The scene is the entire page, so a dead renderer leaves nothing to overlay
  // controls onto: the fallback replaces the hero rather than covering it.
  if (status === 'error') {
    return (
      <main className="hero">
        <Unsupported reason={error} />
      </main>
    );
  }

  return (
    <main className="hero">
      <canvas
        ref={canvasRef}
        tabIndex={0}
        aria-label="Spiral galaxy star field. Drag or use the arrow keys to rotate it; hover to scatter the stars."
      />

      <div className="overlay">
        <div className="topbar">
          <h1 className="title">
            Astra
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

        <div className="bottombar">
          <a
            className="gh"
            href="https://github.com/crafter-station/astra"
            target="_blank"
            rel="noreferrer"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path
                fill="currentColor"
                d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"
              />
            </svg>
            <span>crafter-station/astra</span>
          </a>
          {/* Two hints, one per input model: pointer devices get the hover and
              keyboard gestures, touch gets only what a finger can actually do. */}
          <p className="hint">
            <span className="hint-fine">Drag to rotate · hover to scatter · arrow keys to nudge</span>
            <span className="hint-coarse">Drag to rotate the field</span>
          </p>
        </div>
      </div>
    </main>
  );
}

export default SpiralGalaxy;
