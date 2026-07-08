"use client";

import { useState } from "react";
import { hierarchy, pack } from "d3-hierarchy";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type BubbleDatum = { name: string; value: number; color: string };

// Circle-packed bubbles (d3-hierarchy layout, plain SVG) with a hover tooltip.
// Respects whatever slice of data the server page passes — filters cascade
// PowerBI-style because the data is already filtered.
export function BubblePackCard({
  title,
  description,
  bubbles,
  legend,
  height = 460,
}: {
  title: string;
  description: string;
  bubbles: BubbleDatum[];
  legend?: { label: string; color: string }[];
  height?: number;
}) {
  const [hover, setHover] = useState<BubbleDatum | null>(null);
  if (bubbles.length === 0) return null;

  const W = 800;
  const H = 560;
  const root = hierarchy<{ children: BubbleDatum[] } | BubbleDatum>({ children: bubbles })
    .sum((d) => ("value" in d ? d.value : 0))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const laid = pack<{ children: BubbleDatum[] } | BubbleDatum>().size([W, H]).padding(6)(root);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {hover ? (
            <>
              <span className="font-medium text-foreground">{hover.name}</span> — {hover.value}{" "}
              rolls
            </>
          ) : (
            description
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ maxHeight: height }}
          role="img"
          aria-label={title}
          onMouseLeave={() => setHover(null)}
        >
          {laid.leaves().map((node, i) => {
            const d = node.data as BubbleDatum;
            // Fit the label inside the circle: split long names onto two
            // lines, then size the font so the widest line spans ≤ ~85% of
            // the diameter (rough glyph width ≈ 0.6em). Too small → no label,
            // the hover/tooltip still identifies the bubble.
            const words = d.name.split(" ");
            let lines: string[] = [d.name];
            if (words.length > 1 && d.name.length > 10) {
              let best = 1;
              let bestDiff = Infinity;
              for (let s = 1; s < words.length; s++) {
                const a = words.slice(0, s).join(" ").length;
                const b = words.slice(s).join(" ").length;
                const diff = Math.abs(a - b);
                if (diff < bestDiff) {
                  bestDiff = diff;
                  best = s;
                }
              }
              lines = [words.slice(0, best).join(" "), words.slice(best).join(" ")];
            }
            const maxLen = Math.max(...lines.map((l) => l.length));
            const fontSize = Math.min(24, node.r / 3.2, (node.r * 1.7) / (maxLen * 0.6));
            const showLabel = fontSize >= 9;
            return (
              <g
                key={i}
                transform={`translate(${node.x},${node.y})`}
                onMouseEnter={() => setHover(d)}
              >
                <title>{`${d.name}: ${d.value} rolls`}</title>
                <circle
                  r={node.r}
                  fill={d.color}
                  opacity={hover && hover.name !== d.name ? 0.45 : 1}
                />
                {showLabel &&
                  lines.map((line, li) => (
                    <text
                      key={li}
                      textAnchor="middle"
                      dominantBaseline="central"
                      y={(li - (lines.length - 1) / 2) * fontSize * 1.15}
                      fill="white"
                      stroke="rgba(0,0,0,0.4)"
                      strokeWidth={fontSize / 8}
                      paintOrder="stroke"
                      fontSize={fontSize}
                      fontWeight={600}
                      style={{ pointerEvents: "none" }}
                    >
                      {line}
                    </text>
                  ))}
              </g>
            );
          })}
        </svg>
        {legend && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {legend.map((l) => (
              <span key={l.label} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
