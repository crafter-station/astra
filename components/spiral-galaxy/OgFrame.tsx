'use client';

// Poster framing of the star field used to render the Open Graph card: the same
// renderer as the hero, with the controls removed and title typography added.
// `scripts/og.mjs` screenshots this route at 1200x630.

import { useEffect, useRef } from 'react';
import { createRenderer } from './renderer';

export function OgFrame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Zoomed out a touch so the outer arm does not clip the 1200x630 crop.
    const renderer = createRenderer({ canvas, worldScale: 1.2 });
    void renderer.ready.catch(() => {
      // The capture script fails loudly on a blank frame; nothing to do here.
    });
    return () => renderer.dispose();
  }, []);

  return (
    <main className="og">
      <canvas ref={canvasRef} aria-hidden="true" />
      <div className="og-plate">
        <div className="og-mark">
          <h1>Astra</h1>
          <p>A WebGPU star field, built with vgpu</p>
        </div>
        <span className="og-url">astra.crafter.run</span>
      </div>
    </main>
  );
}

export default OgFrame;
