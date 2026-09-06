# gpt-6-astra

A from-scratch reproduction of the GPT-6 Astra launch-page star-field hero — the
spiral galaxy — built only with [vgpu](https://vgpu.sh) (WebGPU) inside Next.js.

- A compute pass flows ~4,600 stars along the five SVG strokes that draw the "6"
  (viewBox 231x325, taken from the launch page), converges them from a scattered
  sky during the intro, and runs a pointer-repel simulation. Strokes that end
  nearer the core flow forward and the rest flow backward, so the arms counter-rotate.
- Additive instanced quads draw the stars into an HDR (`rgba16float`) scene.
- A bloom chain (half + quarter resolution Gaussian pairs), a screen-space lens
  flare anchored on the hero stars, and a baked dirty-glass map finish with ACES
  tone mapping.

Drag to rotate, hover to scatter, arrow keys to nudge.

```sh
pnpm install
pnpm dev          # http://localhost:3000 — needs a WebGPU-capable browser
pnpm check:wgsl   # validate every shader against a real WebGPU device
pnpm typecheck
pnpm build
pnpm capture      # Node >= 22 + Google Chrome: headless WebGPU frames -> captures/*.png
```

All rendering code lives in `components/spiral-galaxy/`:

| File | Role |
| --- | --- |
| `field.ts` | SVG path parsing, arc-length resampling, deterministic star generation |
| `animation.ts` | Intro, drag rotation with per-stroke lag, flow, pointer repel state |
| `input.ts` | Pointer / keyboard glue |
| `pipeline.ts` | vgpu resources, effects, targets and the per-frame pass chain |
| `renderer.ts` | Owns the `Gpu` context, resize and the frame loop |
| `SpiralGalaxy.tsx` | Client component with the canvas and the controls overlay |
| `simulate.wgsl` | One compute thread per star |
| `stars.wgsl` | Instanced additive point sprites |
| `bright.wgsl`, `blur.wgsl` | Bloom |
| `dirt.wgsl` | Procedural lens dirt, baked once |
| `composite.wgsl` | Bloom + flare + dirty glass + ACES → sRGB, then ambient glow + vignette |
