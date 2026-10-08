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
    // Svelte tracks only what an effect reads synchronously; a read inside the .then below is not tracked. So every
    // prop, and the bound canvas, is read here first, and a change to any of them re-runs the effect. Plain arrays,
    // so Chart.js never walks a reactive proxy.
    const target = canvas;
    const homeName = home;
    const awayName = away;
    const [homeColor, awayColor] = matchMedia("(prefers-color-scheme: dark)").matches ? colors.dark : colors.light;
    const homeLine = plays.map((p) => ({ x: p.minute, y: p.home_wp }));
    const awayLine = plays.map((p) => ({ x: p.minute, y: 1 - p.home_wp }));
    let chart: Chart | undefined;
    let live = true;
    // The frontmatter's loadLeague ran on the server; the browser bundle loads the league again before
    // logoWatermarks (and teamColor, if used) look teams up.
    loadLeague("cfb").then(() => {
      if (!live || target === undefined) return;
      chart = new Chart(target, {
        type: "line",
        data: {
          datasets: [
            { label: homeName, data: homeLine, borderColor: homeColor, pointRadius: 0 },
            { label: awayName, data: awayLine, borderColor: awayColor, pointRadius: 0 },
          ],
        },
        options: { scales: { x: { type: "linear", min: 0, max: 60 }, y: { min: 0, max: 1 } } },
        plugins: [logoWatermarks([homeName, awayName], { league: "cfb" })],
      });
    });
    return () => {
      live = false;
      chart?.destroy();
    };
  });
</script>

<canvas bind:this={canvas}></canvas>
