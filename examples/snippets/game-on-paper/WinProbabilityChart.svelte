<script lang="ts">
  // src/components/game/WinProbabilityChart.svelte: a client:only island, so this runs in the browser only
  import { type MatchupColors, loadLeague } from "@sportsdataverse/sdvplot";
  import { logoWatermarks } from "@sportsdataverse/sdvplot/chartjs";
  import { Chart, registerables } from "chart.js";

  interface Props {
    home: string;
    away: string;
    plays: { minute: number; home_wp: number }[];
    colors: MatchupColors;
  }
  const { home, away, plays, colors }: Props = $props();
  let canvas: HTMLCanvasElement | undefined = $state(); // bound to the <canvas> below
  Chart.register(...registerables);

  $effect(() => {
    // Read the props before anything is awaited: Svelte re-runs the effect when one of these changes. Plain arrays,
    // so Chart.js never walks a reactive proxy.
    const [homeColor, awayColor] = matchMedia("(prefers-color-scheme: dark)").matches ? colors.dark : colors.light;
    const homeLine = plays.map((p) => ({ x: p.minute, y: p.home_wp }));
    const awayLine = plays.map((p) => ({ x: p.minute, y: 1 - p.home_wp }));
    let chart: Chart | undefined;
    let live = true;
    // The frontmatter's loadLeague ran on the server; the browser bundle loads the league again before
    // logoWatermarks (and teamColor, if used) look teams up.
    loadLeague("cfb").then(() => {
      if (!live || canvas === undefined) return;
      chart = new Chart(canvas, {
        type: "line",
        data: {
          datasets: [
            { label: home, data: homeLine, borderColor: homeColor, pointRadius: 0 },
            { label: away, data: awayLine, borderColor: awayColor, pointRadius: 0 },
          ],
        },
        options: { scales: { x: { type: "linear", min: 0, max: 60 }, y: { min: 0, max: 1 } } },
        plugins: [logoWatermarks([home, away], { league: "cfb" })],
      });
    });
    return () => {
      live = false;
      chart?.destroy();
    };
  });
</script>

<canvas bind:this={canvas}></canvas>
