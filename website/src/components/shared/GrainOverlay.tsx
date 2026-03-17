export default function GrainOverlay() {
  return (
    <>
      <svg width="0" height="0" className="absolute">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
        </filter>
      </svg>
      <div
        className="pointer-events-none fixed inset-0 z-[9999] mix-blend-overlay"
        style={{ filter: 'url(#grain)', opacity: 0.03 }}
        aria-hidden="true"
      />
    </>
  );
}
