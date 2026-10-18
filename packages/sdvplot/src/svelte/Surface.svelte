<svelte:options namespace="svg" />

<script lang="ts">
  // Internal: the backdrop once its code has loaded (the chart context is read here, during setup inside the chart).
  import { type SurfaceBackdropProps, type SurfaceKit, surfaceMarkup } from "../svelte-core.js";

  let { kit, options }: { kit: SurfaceKit; options: SurfaceBackdropProps } = $props();
  // svelte-ignore state_referenced_locally
  const ctx = kit.lc.getChartContext(); // once, at setup: a context is only readable then (kit never changes)
  const uid = $props.id();
  const clip = `sdv-surface-${uid.replace(/[^\w-]/g, "")}`;
  const scene = $derived.by(() => {
    const { league, ...o } = options;
    return kit.scene(league, o as never);
  });
  const markup = $derived(surfaceMarkup(ctx, kit, scene));
</script>

{#if markup !== null}
  <g data-sdv-surface="" class="sdv-surface">
    <defs>
      <clipPath id={clip}>
        <rect x="0" y="0" width={ctx.width} height={ctx.height} />
      </clipPath>
    </defs>
    <!-- sporty's own SVG, its text and colours escaped by toSVG -->
    <g clip-path="url(#{clip})">{@html markup}</g>
  </g>
{/if}
