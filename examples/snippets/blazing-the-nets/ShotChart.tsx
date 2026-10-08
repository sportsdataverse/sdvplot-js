"use client";
// app/components/ShotChart.tsx: a client component, like blazing-the-nets' other charts
import { loadLeague } from "@sportsdataverse/sdvplot";
import { appendSurface } from "@sportsdataverse/sdvplot/d3";
import { toSurfaceFrame } from "@sportsdataverse/sporty";
import { scaleLinear, select } from "d3";
import { useEffect, useRef } from "react";

/** stats.nba.com shotchartdetail rows, LOC_X / LOC_Y renamed to the nba-legacy frame's x_legacy / y_legacy. */
export type Shot = {
  x_legacy: number;
  y_legacy: number;
  made: boolean;
};

// The defensive half with its apron, 8 px per foot: x -55..0 ft, y -30..30 ft.
const [width, height] = [440, 480];
const x = scaleLinear([-55, 0], [0, width]);
const y = scaleLinear([-30, 30], [height, 0]);

export function ShotChart({ shots, team }: { shots: readonly Shot[]; team: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = ref.current;
    if (svg === null) return;
    let live = true;
    let drawn: SVGGElement[] = [];
    // A server component's loadLeague does not reach the browser bundle: load the league here, before the first
    // helper call, or the team's colours are not there to paint the court with.
    loadLeague("nba").then(() => {
      if (!live) return;
      const court = appendSurface(select(svg), "nba", { team, displayRange: "defense", x, y });
      const dots = select(svg).append("g");
      dots
        .selectAll("circle")
        .data(toSurfaceFrame(shots, { from: "nba-legacy" }))
        .join("circle")
        .attr("cx", (s) => x(s.surface_x ?? Number.NaN))
        .attr("cy", (s) => y(s.surface_y ?? Number.NaN))
        .attr("r", 5)
        .attr("fill", (s) => (s.made ? "#1b7837" : "#b2182b"));
      drawn = [court.node(), dots.node()].filter((g) => g !== null);
    });
    // React Strict Mode runs every effect twice in development (mount, clean up, mount): without removing what the
    // effect appended, the court and the dots are drawn twice.
    return () => {
      live = false;
      for (const g of drawn) g.remove();
    };
  }, [shots, team]);
  return <svg ref={ref} viewBox={`0 0 ${width} ${height}`} />;
}
