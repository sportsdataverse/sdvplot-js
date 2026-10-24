<!--
@component
  A team-painted court, field or rink under a LayerChart chart's marks: a child of its `<Svg>` layer, before the
  marks. It is drawn in the chart's x/y units: set `xDomain` / `yDomain` to the surface's bbox (sporty's
  `surface(...).bbox`) to fill the plot area. Both scales must be linear and unreversed (otherwise nothing is drawn,
  with one warning). layerchart and `@sportsdataverse/sporty` load on first render; either missing throws then.
-->
<script lang="ts">
  import { type SurfaceBackdropProps, type SurfaceKit, loadSurfaceKit, raise } from "../svelte-core.js";
  import Surface from "./Surface.svelte";

  let props: SurfaceBackdropProps = $props();
  let kit = $state<SurfaceKit>();
  let failed = $state<{ error: unknown }>();
  // a failed import is rethrown from the template (an effect), where a <svelte:boundary> catches it
  loadSurfaceKit().then(
    (k) => (kit = k),
    (error: unknown) => (failed = { error }),
  );
</script>

{#if failed}
  {raise(failed.error)}
{:else if kit}
  <Surface {kit} options={props} />
{/if}
