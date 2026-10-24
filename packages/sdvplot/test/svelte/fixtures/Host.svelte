<script lang="ts">
  // A fixed-size LayerChart chart (no padding: the plot area is the whole 400 x 300) holding the given sdvplot marks.
  import { Chart, Svg } from "layerchart";
  import type { Component } from "svelte";

  interface Mark {
    // biome-ignore lint/suspicious/noExplicitAny: any sdvplot/svelte component, each with its own props
    is: Component<any>;
    props: Record<string, unknown>;
  }
  let {
    chart = {},
    marks,
    onerror,
  }: { chart?: Record<string, unknown>; marks: Mark[]; onerror?: (e: unknown) => void } = $props();
</script>

<Chart width={400} height={300} padding={{ top: 0, right: 0, bottom: 0, left: 0 }} {...chart}>
  <Svg>
    <svelte:boundary onerror={(e) => onerror?.(e)}>
      {#each marks as m, i (i)}
        <m.is {...m.props} />
      {/each}
    </svelte:boundary>
  </Svg>
</Chart>
