<!--
@component
  Team logos (or wordmarks) as marks in a LayerChart chart: a child of its `<Svg>` layer. Each row draws its
  `team`'s logo centred on its scaled (`x`, `y`), `height` (a fraction of the plot area's height) tall. A team with no
  logo draws nothing and warns once. layerchart loads on first render; missing, it throws an install error then.
-->
<script lang="ts">
  import { type LayerChart, type LogoMarkProps, loadLayerChart, raise } from "../svelte-core.js";
  import Marks from "./Marks.svelte";

  let props: LogoMarkProps = $props();
  let lc = $state<LayerChart>();
  let failed = $state<{ error: unknown }>();
  // a failed import is rethrown from the template (an effect), where a <svelte:boundary> catches it
  loadLayerChart("LogoMark").then(
    (m) => (lc = m),
    (error: unknown) => (failed = { error }),
  );
</script>

{#if failed}
  {raise(failed.error)}
{:else if lc}
  <Marks {lc} kind={props.markType ?? "logo"} options={props} />
{/if}
