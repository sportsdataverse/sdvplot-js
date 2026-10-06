import { INDEX_VERSION, MANIFEST_LAST_MODIFIED } from "./data/index.js";
import { VERSION } from "./version.js";

export function versions(): { sdvplot: string; index: string; manifestLastModified: string } {
  return { sdvplot: VERSION, index: INDEX_VERSION, manifestLastModified: MANIFEST_LAST_MODIFIED };
}
