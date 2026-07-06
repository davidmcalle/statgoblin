// Placeholder brand mark: two d20s — a cursed 1 and a blessed 20. Swap for
// the goblin mascot when the art exists.
export function TwoDice({ size = 22 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 52 26"
      width={(size / 26) * 52}
      height={size}
      aria-hidden
      className="shrink-0"
    >
      <g>
        <polygon
          points="13,1 24,7 24,19 13,25 2,19 2,7"
          fill="#ef4444"
          stroke="#b91c1c"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <text
          x="13"
          y="17.5"
          textAnchor="middle"
          fontSize="12"
          fontWeight="800"
          fill="#fff"
          fontFamily="inherit"
        >
          1
        </text>
      </g>
      <g>
        <polygon
          points="39,1 50,7 50,19 39,25 28,19 28,7"
          fill="#22c55e"
          stroke="#15803d"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <text
          x="39"
          y="17"
          textAnchor="middle"
          fontSize="10"
          fontWeight="800"
          fill="#fff"
          fontFamily="inherit"
        >
          20
        </text>
      </g>
    </svg>
  );
}
