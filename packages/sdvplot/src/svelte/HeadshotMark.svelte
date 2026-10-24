<!--
@component
  ESPN player headshots as marks in a LayerChart chart: a child of its `<Svg>` layer. Each row draws its `player`'s
  headshot centred on its scaled (`x`, `y`), `height` (a fraction of the plot area's height) tall. An id with no
  headshot draws nothing and warns once. layerchart loads on first render; missing, it throws an install error then.
-->
<script lang="ts">
  import { type HeadshotMarkProps, type LayerChart, loadLayerChart, raise } from "../svelte-core.js";
  import Marks from "./Marks.svelte";

  let props: HeadshotMarkProps = $props();
  let lc = $state<LayerChart>();
  let failed = $state<{ error: unknown }>();
  // a failed import is rethrown from the template (an effect), where a <svelte:boundary> catches it
  loadLayerChart("HeadshotMark").then(
    (m) => (lc = m),
    (error: unknown) => (failed = { error }),
  );
</script>

{#if failed}
  {raise(failed.error)}
{:else if lc}
  <Marks {lc} kind="headshot" options={props} />
{/if}
