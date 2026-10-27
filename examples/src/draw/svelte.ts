import "layerchart/core.css";
import { mount, unmount } from "svelte";
import BumpChart from "../../snippets/svelte/BumpChart.svelte";
import CourtShots from "../../snippets/svelte/CourtShots.svelte";
import QbHeadshots from "../../snippets/svelte/QbHeadshots.svelte";
import TanstackStandings from "../../snippets/svelte/TanstackStandings.svelte";
import { type Draw, figureBox } from "./index.js";

/** The Svelte components the examples draw: the snippets the guide shows, so the page runs the code it prints. */
const COMPONENTS = { BumpChart, CourtShots, QbHeadshots, TanstackStandings } as const;

/** A Svelte 5 component (a LayerChart chart of its own size, or a table) on a white card: LayerChart's axes are dark ink. */
const draw: Draw<"svelte"> = async (el, s) => {
  const box = figureBox(el, s.label);
  box.style.background = "#ffffff";
  box.style.color = "#1c1e21";
  box.style.display = "inline-block";
  const app = mount(COMPONENTS[s.component], { target: box, props: s.props });
  return () => {
    void unmount(app);
    box.remove();
  };
};
export default draw;
