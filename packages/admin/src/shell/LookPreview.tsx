import React from 'react';

/**
 * In the vite workspace the overlay is its own server on 5174; packaged, the app serves the built
 * overlay under /overlay/. Both the Graphics page and the pro-look modal need the same answer.
 */
export const overlayBaseUrl = (origin: string): string =>
  location.port === '5175' ? 'http://127.0.0.1:5174/' : `${origin}/overlay/`;

interface LookPreviewProps {
  id: string;
  origin: string;
  /** Extra query appended to the overlay URL, e.g. `&layout=ticker`. */
  params?: string;
  className?: string;
}

/**
 * A real render of one look: the overlay itself in a 1920x1080 iframe pinned to `?look=<id>` and
 * scaled to whatever width the card gives it. Deliberately not a hand-drawn mock — a mock is a
 * second source of truth, and it is the one that drifts from what OBS actually shows.
 */
export const LookPreview = ({ id, origin, params = '', className = '' }: LookPreviewProps) => {
  const box = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(0);

  React.useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / 1920);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={box}
      className={`relative w-full overflow-hidden bg-black ${className}`}
      style={{ aspectRatio: '16 / 9' }}
    >
      {scale > 0 && (
        <iframe
          title={`${id} look preview`}
          src={`${overlayBaseUrl(origin)}?preview=1&look=${encodeURIComponent(id)}${params}`}
          loading="lazy"
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 h-[1080px] w-[1920px] origin-top-left border-0"
          style={{ transform: `scale(${scale})` }}
        />
      )}
    </div>
  );
};
