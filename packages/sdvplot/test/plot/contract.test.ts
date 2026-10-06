// @vitest-environment jsdom
import { beforeAll, expect, test } from "vitest";
import { loadLeague } from "../../src/index.js";
import { ContractError, checkAdapterContract } from "../../src/testing/index.js";
import { makeAxisTarget, makeTarget, plotAdapter } from "./contract-adapter.js";

beforeAll(() => loadLeague("nfl"));
test("the Plot adapter passes rules 0-8", async () => {
  await checkAdapterContract(plotAdapter, { makeTarget, makeAxisTarget });
});
test("a broken adapter fails with the rule named", async () => {
  const broken = { ...plotAdapter, addLogos: (t: ReturnType<typeof makeTarget>) => t }; // draws nothing
  await expect(checkAdapterContract(broken, { makeTarget, makeAxisTarget })).rejects.toThrow(ContractError);
  await expect(checkAdapterContract(broken, { makeTarget, makeAxisTarget })).rejects.toThrow(/^rule 1/);
});
