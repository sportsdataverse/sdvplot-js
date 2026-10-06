import { beforeEach, expect, test, vi } from "vitest";
import {
  InputError,
  SdvplotError,
  UnresolvedTeamError,
  resetWarnings,
  setWarningHandler,
  warn,
} from "../src/errors.js";

beforeEach(() => {
  resetWarnings();
  setWarningHandler(null);
});

test("error hierarchy and names", () => {
  const e = new UnresolvedTeamError("x");
  expect(e).toBeInstanceOf(SdvplotError);
  expect(e).toBeInstanceOf(Error);
  expect(e.name).toBe("UnresolvedTeamError");
  expect(new InputError("y").name).toBe("InputError");
});

test("warn fires once per key", () => {
  const spy = vi.fn();
  setWarningHandler(spy);
  warn("nfl:XXX", "1 value(s) did not resolve");
  warn("nfl:XXX", "1 value(s) did not resolve");
  warn("nfl:YYY", "other");
  expect(spy).toHaveBeenCalledTimes(2);
});
