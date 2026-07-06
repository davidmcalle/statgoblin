// Brand mark: an outlined d20 with a natural 20 face-on.
export function D20Mark({ size = 24 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      <path d="M12 1.2 L21.4 6.6 L21.4 17.4 L12 22.8 L2.6 17.4 L2.6 6.6 Z" />
      {/* light facet hints, kept clear of the number */}
      <path
        d="M12 1.2 L12 4.4 M21.4 6.6 L18.6 8.2 M2.6 6.6 L5.4 8.2 M12 22.8 L12 19.8 M21.4 17.4 L18.6 16 M2.6 17.4 L5.4 16"
        strokeOpacity="0.55"
        strokeWidth="1.2"
      />
      <text
        x="12"
        y="12.6"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="9"
        fontWeight="800"
        fill="currentColor"
        stroke="none"
        fontFamily="inherit"
      >
        20
      </text>
    </svg>
  );
}
