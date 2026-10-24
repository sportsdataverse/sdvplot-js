<script lang="ts">
  // An sdvplot/svelte component outside any chart, behind a boundary that reports what it throws.
  import type { Component } from "svelte";

  // biome-ignore lint/suspicious/noExplicitAny: any sdvplot/svelte component
  let { is, props, onerror }: { is: Component<any>; props: Record<string, unknown>; onerror: (e: unknown) => void } =
    $props();
  const Is = $derived(is);
</script>

<svg role="img" aria-label="test">
  <svelte:boundary onerror={(e) => onerror(e)}>
    <Is {...props} />
  </svelte:boundary>
</svg>
