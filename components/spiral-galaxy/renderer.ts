// Owns the vgpu context for the hero: init, resize (targets are re-created at
// the new size), the frame loop, input, and the runtime toggles the React
// overlay flips. No GUI library — controls are plain methods.

import { clock, frameLoop, init, surface, type FrameLoopHandle, type Gpu, type Surface } from 'vgpu';

import { createAnimation, type Animation } from './animation';
import { generateField, type StarField } from './field';
import { installFieldInput, type FieldInput } from './input';
import {
  bakeDirt,
  createEffects,
  createResources,
  createTargets,
  DEFAULT_LOOK,
  destroyTargets,
  prewarm,
  renderChain,
  setBindings,
  setLook,
  stepSimulation,
  type Effects,
  type Resources,
  type Targets,
} from './pipeline';

export interface RendererOptions {
  readonly canvas: HTMLCanvasElement;
}

export interface RenderSize {
  width: number;
  height: number;
  dpr: number;
}

export interface Settings {
  lensFlare: boolean;
  dirtyGlass: boolean;
  hoverRepel: boolean;
}

export interface Renderer {
  /** Resolves once the first frame can render; rejects when WebGPU is unavailable. */
  readonly ready: Promise<void>;
  readonly settings: Readonly<Settings>;
  resize(size: RenderSize): void;
  replay(): void;
  setLensFlare(enabled: boolean): void;
  setDirtyGlass(enabled: boolean): void;
  setHoverRepel(enabled: boolean): void;
  dispose(): void;
}

const MAX_DPR = 1.6;

function bestEffort(cleanup: () => void): void {
  try {
    cleanup();
  } catch {
    // Teardown must run to completion even when one step throws.
  }
}

export function createRenderer({ canvas }: RendererOptions): Renderer {
  let disposed = false;
  let gpu: Gpu | undefined;
  let canvasSurface: Surface | undefined;
  let field: StarField | undefined;
  let animation: Animation | undefined;
  let resources: Resources | undefined;
  let effects: Effects | undefined;
  let targets: Targets | undefined;
  let input: FieldInput | undefined;
  let loop: FrameLoopHandle | undefined;
  let observer: ResizeObserver | undefined;
  let resizeFrame = 0;
  let pendingSize: RenderSize | undefined;
  let pixelRatio = 1;
  let lastDpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio;
  const settings: Settings = {
    lensFlare: DEFAULT_LOOK.lensFlare.enabled,
    dirtyGlass: DEFAULT_LOOK.dirtyGlass.enabled,
    hoverRepel: true,
  };

  const applySettings = () => {
    if (disposed || !effects || !animation) return;
    setLook(effects, { lensFlare: settings.lensFlare, dirtyGlass: settings.dirtyGlass });
    animation.setRepel(settings.hoverRepel);
  };

  const applyResize = () => {
    resizeFrame = 0;
    const size = pendingSize;
    pendingSize = undefined;
    if (disposed || !size || !gpu || !effects || !targets || !resources || !animation || !canvasSurface) return;

    try {
      const previousTargets = targets;
      const nextTargets = createTargets(gpu, [
        Math.max(1, Math.round(size.width * size.dpr)),
        Math.max(1, Math.round(size.height * size.dpr)),
      ]);
      try {
        pixelRatio = size.dpr;
        setBindings(effects, nextTargets, resources, { pixelRatio, repelRadius: animation.repelRadius });
      } catch (error) {
        destroyTargets(nextTargets);
        throw error;
      }
      targets = nextTargets;
      destroyTargets(previousTargets);
      // Repel offsets are in screen space; a new size invalidates them.
      animation.resetMotion();
    } catch (error) {
      fail(error);
    }
  };

  const resize = (size: RenderSize) => {
    if (disposed || size.width <= 0 || size.height <= 0) return;
    pendingSize = size;
    if (!resizeFrame) resizeFrame = requestAnimationFrame(applyResize);
  };

  const measure = () => {
    const rect = canvas.getBoundingClientRect();
    resize({
      width: rect.width,
      height: rect.height,
      dpr: Math.min(MAX_DPR, Math.max(1, window.devicePixelRatio || 1)),
    });
  };

  const onWindowResize = () => {
    if (window.devicePixelRatio === lastDpr) return;
    lastDpr = window.devicePixelRatio;
    measure();
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    for (const cleanup of [
      () => observer?.disconnect(),
      () => {
        if (typeof window !== 'undefined') window.removeEventListener('resize', onWindowResize);
      },
      () => input?.dispose(),
      () => loop?.stop(),
      () => gpu?.dispose(),
    ]) {
      bestEffort(cleanup);
    }
  };

  const initialize = async () => {
    if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
      throw new Error('WebGPU is not available in this browser.');
    }

    // The star draw reads the simulation output from a vertex-stage storage
    // buffer; compatibility-mode devices grant none unless asked.
    const nextGpu = await init({ requiredLimits: { maxStorageBuffersInVertexStage: 1 } });
    if (disposed) {
      nextGpu.dispose();
      return;
    }

    gpu = nextGpu;
    canvasSurface = surface(gpu, canvas, { dpr: [1, MAX_DPR] });
    pixelRatio = Math.min(MAX_DPR, Math.max(1, window.devicePixelRatio || 1));
    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    field = generateField();
    animation = createAnimation(field, { reducedMotion });
    settings.hoverRepel = animation.repelEnabled;
    resources = createResources(gpu, field);
    effects = createEffects(gpu, field, resources);
    targets = createTargets(gpu, canvasSurface.size);
    setBindings(effects, targets, resources, { pixelRatio, repelRadius: animation.repelRadius });
    await prewarm(effects, targets, resources, canvasSurface);
    if (disposed) return;
    bakeDirt(gpu, effects, resources);
    applySettings();

    input = installFieldInput(canvas, animation);
    observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(canvas);
    window.addEventListener('resize', onWindowResize);
    measure();

    const gpuClock = clock(gpu);
    loop = frameLoop(gpu, (currentFrame) => {
      if (disposed || !effects || !targets || !resources || !field || !animation || !canvasSurface) return;
      stepSimulation(effects, resources, field, animation, gpuClock.deltaTime);
      renderChain(currentFrame, effects, targets, canvasSurface);
    });
  };

  function fail(error: unknown): never {
    dispose();
    throw error;
  }

  const ready = initialize().catch((error: unknown) => {
    if (disposed) return;
    fail(error);
  });

  return {
    ready,
    settings,
    resize,
    dispose,
    replay: () => animation?.replay(),
    setLensFlare(enabled) {
      settings.lensFlare = enabled;
      applySettings();
    },
    setDirtyGlass(enabled) {
      settings.dirtyGlass = enabled;
      applySettings();
    },
    setHoverRepel(enabled) {
      settings.hoverRepel = enabled;
      applySettings();
    },
  };
}
