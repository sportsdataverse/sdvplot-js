// @vitest-environment jsdom
import { beforeAll, expect, test } from "vitest";
import { loadLeague } from "../../src/index.js";
import type { Value } from "../../src/resolve.js";
import { ContractError, type ContractMarkOptions, checkAdapterContract } from "../../src/testing/index.js";
import { makeAxisTarget, makeTarget, plotAdapter } from "./contract-adapter.js";

beforeAll(() => loadLeague("nfl"));
test("the Plot adapter passes rules 0-9", async () => {
  await checkAdapterContract(plotAdapter, { makeTarget, makeAxisTarget });
});
test("a broken adapter fails with the rule named", async () => {
  const broken = { ...plotAdapter, addLogos: (t: ReturnType<typeof makeTarget>) => t }; // draws nothing
  await expect(checkAdapterContract(broken, { makeTarget, makeAxisTarget })).rejects.toThrow(ContractError);
  await expect(checkAdapterContract(broken, { makeTarget, makeAxisTarget })).rejects.toThrow(/^rule 1/);
});
test("an adapter that ignores alpha fails rule 8", async () => {
  const noAlpha = {
    ...plotAdapter,
    addLogos: (
      t: ReturnType<typeof makeTarget>,
      x: ArrayLike<Value>,
      y: ArrayLike<Value>,
      v: readonly Value[],
      o: ContractMarkOptions,
    ) =>
      plotAdapter.addLogos(t, x, y, v, {
        league: o.league,
        ...(o.height === undefined ? {} : { height: o.height }),
      }),
  };
  await expect(checkAdapterContract(noAlpha, { makeTarget, makeAxisTarget })).rejects.toThrow(/^rule 8/);
});
