// @vitest-environment jsdom
import { beforeAll, expect, test } from "vitest";
import { loadLeague } from "../../src/index.js";
import { checkAdapterContract } from "../../src/testing/index.js";
import { d3Adapter, makeTarget } from "./contract-adapter.js";

beforeAll(async () => {
  await loadLeague("nfl");
});

test("the d3 adapter passes the adapter contract (rules 0-8)", async () => {
  await expect(checkAdapterContract(d3Adapter, { makeTarget })).resolves.toBeUndefined();
});
