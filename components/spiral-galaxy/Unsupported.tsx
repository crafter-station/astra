// Shown when the WebGPU renderer never starts: an old browser, a locked-down
// embedded one (smart TVs, fridge panels), or a driver that hands back no
// adapter. The scene is the whole page, so there is nothing to degrade to --
// the visitor gets a video instead, and the reason underneath it so anyone
// debugging still learns why the canvas never came up.

const VIDEO_ID = 'dQw4w9WgXcQ';

// nocookie host, muted autoplay (the only kind any browser will start on its
// own), and controls left on so the viewer can unmute. `playlist` is what
// makes `loop` work for a single video.
const EMBED = `https://www.youtube-nocookie.com/embed/${VIDEO_ID}?${new URLSearchParams({
  autoplay: '1',
  mute: '1',
  loop: '1',
  playlist: VIDEO_ID,
  playsinline: '1',
  rel: '0',
}).toString()}`;

export function Unsupported({ reason }: { reason: string | null }) {
  return (
    <div className="fallback" role="alert">
      <h1 className="fallback-mark">
        Astra
        <small>WebGPU · vgpu</small>
      </h1>

      <div className="fallback-video">
        <iframe
          src={EMBED}
          title="Fallback video"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>

      <p className="fallback-note">
        <strong>This browser can&rsquo;t run the star field.</strong>
        {reason ? <code>{reason}</code> : 'WebGPU is not available here.'}
        <br />
        Try a current Chrome, Edge or Safari with WebGPU enabled.
      </p>
    </div>
  );
}

export default Unsupported;
