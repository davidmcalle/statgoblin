"use client";

import { useEffect, useState } from "react";
import { D20Icon } from "./d20-icon";

const BOXES = 4;
const STEP_MS = 650;

// Loading animation: a d20 bounces across a row of "?" boxes, revealing a
// fresh roll in each as it lands — red for low, green for high.
export function LoadingDice({ label = "Rolling…" }: { label?: string }) {
  const [pos, setPos] = useState(-1);
  const [revealed, setRevealed] = useState<(number | null)[]>(Array(BOXES).fill(null));

  useEffect(() => {
    const timer = setInterval(() => {
      setPos((p) => {
        const next = p + 1;
        if (next >= BOXES + 2) {
          // Hold at the end for a beat, then start a fresh run.
          setRevealed(Array(BOXES).fill(null));
          return -1;
        }
        if (next >= 0 && next < BOXES) {
          setRevealed((r) => {
            const copy = [...r];
            copy[next] = 1 + Math.floor(Math.random() * 20);
            return copy;
          });
        }
        return next;
      });
    }, STEP_MS);
    return () => clearInterval(timer);
  }, []);

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
