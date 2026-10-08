import { INDEX_VERSION, VERSION, versions } from "@sportsdataverse/sdvplot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Package and data versions",
  tags: ["versions"],
} satisfies ExampleMeta;

// Quote these in a bug report: the code, the bundled team index and the manifest the shards came from.
export default { VERSION, INDEX_VERSION, versions: versions() };
