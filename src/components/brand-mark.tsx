/**
 * Row Six's logo: a row of six cinema seats, with yours (the fourth) in red. Plain SVG with no hooks, so it renders
 * in the header and in the generated images (app icons, share cards) alike.
 */

const RED = "#e50914";
const GREY = "#5a5a66";
const SCREEN = "#e8e8ee";

const SEATS = 6;
const MINE = 3; // zero-based: the fourth seat
const GAP = 11.6; // seat centre to seat centre, in viewBox units

/**
 * The row of seats. `screen` adds the cinema screen curving above it (used on the larger app icons). Size it with
 * a `className` (e.g. "h-4 w-auto") or a `width` in pixels; the height follows. (Generated images need the pixel
 * width, since they don't run Tailwind.)
 */
export function SeatRow({ screen = false, className, width }: { screen?: boolean; className?: string; width?: number }) {
  const [top, h] = screen ? [-27, 33] : [-7, 13];
  return (
    <svg
      viewBox={`-35 ${top} 70 ${h}`}
      width={width}
      height={width && (width * h) / 70}
      className={className}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      {screen && <path d="M-31 -23 Q0 -27.5 31 -23" stroke={SCREEN} strokeWidth={2.6} strokeLinecap="round" fill="none" />}
      {/* Each seat, seen from the front: a tall rounded back over a wider cushion. Drawn inline because the
          image renderer (Satori) only accepts plain SVG tags inside <svg>, not components. */}
      {Array.from({ length: SEATS }, (_, i) => (
        <g key={i} transform={`translate(${(i - (SEATS - 1) / 2) * GAP} 0)`} fill={i === MINE ? RED : GREY}>
          <rect x={-4.3} y={-6.5} width={8.6} height={9.5} rx={2.6} />
          <rect x={-5} y={2} width={10} height={3.6} rx={1.6} />
        </g>
      ))}
    </svg>
  );
}
