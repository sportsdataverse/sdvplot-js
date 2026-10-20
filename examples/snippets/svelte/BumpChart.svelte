<script lang="ts">
  // A LayerChart bump chart: each team's weekly rank as a line in its team colour, its logo at the last week.
  // Call loadLeague("nfl") before this mounts (sdvplot/svelte reads the bundled team data synchronously).
  import { LogoMark, teamColorPalette } from "@sportsdataverse/sdvplot/svelte";
  import { Axis, Chart, Spline, Svg } from "layerchart";

  interface Props {
    rows: { team: string; week: number; rank: number }[];
    teams: string[];
    width: number;
    height: number;
  }
  const { rows, teams, width, height }: Props = $props();
  // one colour per team, readable on the white card and distinct from each other
  const colors = $derived(teamColorPalette("nfl", teams, { background: "#ffffff" }));
  const last = $derived(Math.max(...rows.map((r) => r.week)));
</script>

<Chart
  data={rows}
  x="week"
  y="rank"
  yDomain={[teams.length, 1]}
  {width}
  {height}
  padding={{ top: 20, right: 48, bottom: 36, left: 36 }}
>
  <Svg>
    <Axis placement="bottom" label="Week" ticks={[1, 4, 7, 10, 13, 16, 18]} />
    <Axis placement="left" label="Division rank" ticks={teams.map((_, i) => i + 1)} format="integer" />
    {#each teams as team, i (team)}
      <Spline data={rows.filter((r) => r.team === team)} stroke={colors[i]} stroke-width={3} />
    {/each}
    <!-- the logos at the last week, picked by week, so each sits on its own line's end -->
    <LogoMark data={rows.filter((r) => r.week === last)} x="week" y="rank" team="team" league="nfl" height={0.13} />
  </Svg>
</Chart>
