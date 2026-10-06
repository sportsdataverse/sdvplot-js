import { INDEX_VERSION, MANIFEST_LAST_MODIFIED } from "./data/index.js";

const VERSION = "0.0.0"; // Task 9 wires the real package version through the barrel

export function versions(): { sdvplot: string; index: string; manifestLastModified: string } {
  return { sdvplot: VERSION, index: INDEX_VERSION, manifestLastModified: MANIFEST_LAST_MODIFIED };
}
