<script lang="ts">
  // One sdvtables cell that is more than text, as tanstackTable hands it over: a logo, wordmark or headshot image (and
  // the team's name after it, with includeName), or a rank with its superscript suffix.
  import type { CellPart } from "@sportsdataverse/sdvtables/tanstack-table";

  const { part }: { part: CellPart } = $props();
</script>

{#if part.type === "rank"}{part.num}<sup style:font-size={part.size}>{part.suffix}</sup>{:else}<span
    style="display:inline-flex;align-items:center;gap:0.4em"
    ><img
      src={part.src}
      alt={part.alt}
      height={part.height}
      data-sdv-id={part.id}
      data-sdv-kind={part.kind}
    />{part.text ?? ""}</span
  >{/if}
