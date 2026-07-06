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
            const fontSize = Math.max(11, Math.min(24, node.r / 3.2));
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
                {node.r > 26 && (
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="white"
                    fontSize={fontSize}
                    fontWeight={600}
                    style={{ pointerEvents: "none" }}
                  >
                    {d.name}
                  </text>
                )}
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
