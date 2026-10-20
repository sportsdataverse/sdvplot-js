<svelte:options namespace="svg" />

<script lang="ts">
  // Internal: the images of a LogoMark or HeadshotMark, drawn once layerchart has loaded (its chart context is read
  // here, during this component's setup inside the chart).
  import {
    type HeadshotMarkProps,
    type LayerChart,
    type LogoMarkProps,
    markImages,
  } from "../svelte-core.js";

  let {
    lc,
    kind,
    options,
  }: { lc: LayerChart; kind: "logo" | "wordmark" | "headshot"; options: LogoMarkProps | HeadshotMarkProps } = $props();
  // svelte-ignore state_referenced_locally
  const ctx = lc.getChartContext(); // once, at setup: a context is only readable then (lc never changes)
  const images = $derived(markImages(ctx, kind, options));
</script>

{#each images as m (m.key)}
  <image {...m.attrs} />
{/each}
