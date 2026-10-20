<script lang="ts">
  // A bump chart: one team-coloured line per team (teamColorPalette) and a logo at each line's last week (LogoMark).
  import { Chart, Spline, Svg } from "layerchart";
  import { LogoMark, teamColorPalette } from "../../../src/svelte/index.js";

  type Row = { team: string; week: number; rank: number };
  let {
    rows,
    teams,
    background,
    ssr = false,
  }: { rows: Row[]; teams: string[]; background?: string; ssr?: boolean } = $props();
  const lines = $derived.by(() => {
    const colors = teamColorPalette("nfl", teams, background === undefined ? {} : { background });
    return teams.map((team, i) => ({ team, color: colors[i] ?? "#808080", rows: rows.filter((r) => r.team === team) }));
  });
  const last = $derived(Math.max(...rows.map((r) => r.week)));
</script>

<Chart
  data={rows}
  x="week"
  y="rank"
  yDomain={[teams.length, 1]}
  {ssr}
  width={400}
  height={300}
  padding={{ top: 0, right: 0, bottom: 0, left: 0 }}
>
  <Svg>
    {#each lines as line (line.team)}
      <Spline data={line.rows} stroke={line.color} data-team={line.team} />
    {/each}
    <LogoMark data={rows.filter((r) => r.week === last)} x="week" y="rank" team="team" league="nfl" height={0.12} />
  </Svg>
</Chart>
