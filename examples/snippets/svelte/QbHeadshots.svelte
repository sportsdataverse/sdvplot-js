<script lang="ts">
  // A LayerChart scatter of points scored against points allowed, each team drawn as its quarterback's headshot.
  // ESPN headshot URLs are built from the id alone, so no league data has to load first.
  import { HeadshotMark } from "@sportsdataverse/sdvplot/svelte";
  import { Axis, Chart, Svg } from "layerchart";

  interface Props {
    rows: { team: string; pf: number; pa: number; qb_espn_id: string }[];
    width: number;
    height: number;
  }
  const { rows, width, height }: Props = $props();
</script>

<!-- fewer points allowed is better, so the y domain runs high to low: the best defences at the top -->
<Chart
  data={rows}
  x="pf"
  y="pa"
  xDomain={[270, 540]}
  yDomain={[450, 280]}
  {width}
  {height}
  padding={{ top: 20, right: 24, bottom: 36, left: 44 }}
>
  <Svg>
    <Axis placement="bottom" label="Points for" grid />
    <Axis placement="left" label="Points against" grid />
    <HeadshotMark x="pf" y="pa" player="qb_espn_id" league="nfl" height={0.14} />
  </Svg>
</Chart>
