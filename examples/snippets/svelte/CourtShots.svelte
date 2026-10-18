<script lang="ts">
  // A LayerChart shot chart over a team-painted court: the scales' domains are the court's bbox in feet, so the
  // court fills the plot area and the shots land on it. Call loadLeague("nba") before this mounts.
  import { SurfaceBackdrop, teamColorPalette } from "@sportsdataverse/sdvplot/svelte";
  import { Chart, Points, Svg } from "layerchart";

  interface Props {
    shots: { x: number; y: number; team: string; made: boolean }[];
    bbox: [number, number, number, number];
    width: number;
    height: number;
  }
  const { shots, bbox, width, height }: Props = $props();
  const [lal, den] = $derived(teamColorPalette("nba", ["LAL", "DEN"]));
  const color = (team: string) => (team === "LAL" ? lal : den);
</script>

<Chart
  data={shots}
  x="x"
  y="y"
  xDomain={[bbox[0], bbox[2]]}
  yDomain={[bbox[1], bbox[3]]}
  {width}
  {height}
  padding={{ top: 0, right: 0, bottom: 0, left: 0 }}
>
  <Svg>
    <SurfaceBackdrop league="nba" team="DEN" displayRange="defense" />
    <!-- made shots filled in the shooting team's colour, misses white with a ring in it -->
    {#each ["LAL", "DEN"] as team (team)}
      <Points data={shots.filter((s) => s.team === team && s.made)} r={5} fill={color(team)} />
      <Points
        data={shots.filter((s) => s.team === team && !s.made)}
        r={5}
        fill="#ffffff"
        stroke={color(team)}
        stroke-width={2}
      />
    {/each}
  </Svg>
</Chart>
