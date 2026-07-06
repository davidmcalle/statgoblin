// Simple d20 outline — replaces the dice emoji everywhere.
export function D20Icon({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z" />
      <path d="M12 8 L16.5 15.5 L7.5 15.5 Z" />
      <path d="M12 2 L12 8 M21 7 L16.5 15.5 M3 7 L7.5 15.5 M12 22 L7.5 15.5 M12 22 L16.5 15.5 M21 17 L16.5 15.5 M3 17 L7.5 15.5" />
    </svg>
  );
}
