import { INDEX_VERSION, VERSION, versions } from "@sportsdataverse/sdvplot";
import { VERSION as SDVTABLES_VERSION } from "@sportsdataverse/sdvtables";
import { VERSION as SPORTY_VERSION } from "@sportsdataverse/sporty";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Package and data versions",
  tags: ["versions", "VERSION", "INDEX_VERSION"],
} satisfies ExampleMeta;

// Quote these in a bug report: each package's code, the bundled team index and the manifest the shards came from.
export default {
  VERSION,
  INDEX_VERSION,
  versions: versions(),
  "@sportsdataverse/sporty VERSION": SPORTY_VERSION,
  "@sportsdataverse/sdvtables VERSION": SDVTABLES_VERSION,
};
