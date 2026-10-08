import { STANDINGS } from "@sportsdataverse/examples/data";
import { snakeAlign } from "@sportsdataverse/sdvtables";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "snakeAlign: rows split into the blocks .snake() draws",
  tags: ["layout", "snakeAlign", "gt_snake_align", "snake"],
} satisfies ExampleMeta;

// Eight rows into three blocks of three; the last block is padded with fill (null unless you pass one).
export default snakeAlign(STANDINGS, { nCols: 3 }).map((block) => block.map((r) => r?.team ?? "(fill)"));
