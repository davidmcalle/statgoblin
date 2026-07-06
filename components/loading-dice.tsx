"use client";

import { useEffect, useState } from "react";
import { D20Icon } from "./d20-icon";

const BOXES = 4;
const STEP_MS = 650;
// Pre-played results — the same four rolls every time, dealt in a random
// order per run. No mid-flight randomness to fight re-renders.
const VALUES = [1, 8, 15, 20];

function shuffled(): number[] {
  const v = [...VALUES];
  for (let i = v.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [v[i], v[j]] = [v[j], v[i]];
  }
  return v;
}

// Loading animation: a d20 bounces across a row of "?" boxes, revealing the
// pre-played roll in each as it lands — red for low, green for high.
export function LoadingDice({ label = "Rolling…" }: { label?: string }) {
  const [pos, setPos] = useState(-1);
  const [values, setValues] = useState<number[]>(shuffled);

  useEffect(() => {
    const timer = setInterval(() => {
      setPos((p) => {
        const next = p + 1;
        if (next >= BOXES + 2) {
          // Hold at the end for a beat, then deal a fresh order.
          setValues(shuffled());
          return -1;
        }
        return next;
      });
    }, STEP_MS);
    return () => clearInterval(timer);
  }, []);
  const revealed = values.map((v, i) => (pos >= i ? v : null));

  const colorFor = (v: number) => `hsl(${((v - 1) / 19) * 120}, 65%, 45%)`;
  const diceLeft = Math.min(Math.max(pos, 0), BOXES - 1);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative pt-12">
        {/* the bouncing d20 */}
        <div
          key={pos}
          className="absolute top-0 h-9 w-9 text-foreground"
          style={{
            left: `calc(${diceLeft} * (3rem + 0.75rem) + 0.375rem)`,
            transition: `left ${STEP_MS * 0.55}ms cubic-bezier(.3,.7,.4,1)`,
            animation: `rollhop ${STEP_MS}ms ease-in-out`,
          }}
        >
          <D20Icon size={36} className="drop-shadow" />
        </div>
        <div className="flex gap-3">
          {Array.from({ length: BOXES }, (_, i) => {
            const v = revealed[i];
            return (
              <div
                key={i}
                className="flex h-12 w-12 items-center justify-center rounded-md border text-lg font-bold transition-colors duration-300"
                style={
                  v
                    ? { color: "white", background: colorFor(v), borderColor: colorFor(v) }
                    : { color: "var(--muted-foreground)", background: "var(--muted)" }
                }
              >
                {v ?? "?"}
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <style>{`
        @keyframes rollhop {
          0%   { transform: translateY(0) rotate(0deg); }
          45%  { transform: translateY(-26px) rotate(180deg); }
          100% { transform: translateY(0) rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
