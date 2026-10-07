import { generate } from "../scripts/gen.js";

/** The registry is generated, never committed: every test run starts from the current examples and docstrings. */
export default function setup(): void {
  generate();
}
