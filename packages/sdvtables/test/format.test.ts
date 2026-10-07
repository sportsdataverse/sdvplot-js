// expected strings are Python outputs (f"{v:,.{d}f}", _natural, _format_value), confirmed against sdvplot/_cells.py
import { expect, test } from "vitest";
import { formatNumber, formatValue, isBlank, naturalDigits, ordinal, pxOf, toNumber } from "../src/format.js";

test("blank detection and coercion (Review Focus 2)", () => {
  for (const v of [null, undefined, Number.NaN, "", "  "]) expect(isBlank(v)).toBe(true);
  expect(toNumber("13.0")).toBe(13);
  expect(toNumber("abc")).toBeNull();
  expect(toNumber(Number.NaN)).toBeNull();
  expect(toNumber("0x10")).toBeNull();
  expect(toNumber(true)).toBe(1);
});
test("natural digits and format types", () => {
  expect(naturalDigits(21)).toBe("21");
  expect(naturalDigits(22.8)).toBe("22.8");
  expect(naturalDigits(1234.5, true)).toBe("1,234.5");
  expect(naturalDigits(123456789)).toBe("123456789");
  expect(naturalDigits(123456789, true)).toBe("123,456,789");
  expect(naturalDigits(1e-7)).toBe("0.0000001");
  expect(naturalDigits(0)).toBe("0");
  expect(naturalDigits(1234567.5)).toBe("1234568");
  expect(naturalDigits(1234568.5)).toBe("1234568");
  expect(naturalDigits(12345.625)).toBe("12345.62");
  expect(naturalDigits(1e22)).toBe("10000000000000000000000");
  expect(naturalDigits(Number.POSITIVE_INFINITY)).toBe("Inf");
  expect(formatValue(0.456, null, "percent", "")).toBe("0.456%");
  expect(formatValue(1234, 0, "currency", "")).toBe("$1,234");
  expect(formatValue(null, 1, "number", "M")).toBe("NAM");
  expect(formatNumber(0.071, { digits: 3, forceSign: true })).toBe("+0.071");
  expect(formatNumber(-3, { digits: 0 })).toBe("-3");
  expect(formatNumber(0, { digits: 1, forceSign: true })).toBe("0.0");
});
test("exact ties round half to even like Python (ruling R2)", () => {
  const f = (v: number, d: number): string => formatNumber(v, { digits: d });
  expect(f(2.5, 0)).toBe("2");
  expect(f(3.5, 0)).toBe("4");
  expect(f(0.125, 2)).toBe("0.12");
  expect(f(0.375, 2)).toBe("0.38");
  expect(f(38.5, 0)).toBe("38");
  expect(f(-2.5, 0)).toBe("-2");
  expect(f(2.675, 2)).toBe("2.67"); // not an exact tie in binary
  expect(f(1234.5, 0)).toBe("1234");
  expect(formatNumber(1234.5, { digits: 0, big: true })).toBe("1,234");
  expect(f(1e21, 2)).toBe("1000000000000000000000.00"); // toFixed would switch to exponent form
  expect(f(-0.04, 1)).toBe("-0.0"); // Python keeps the sign (_cells.py f-format)
  expect(pxOf(0.25)).toBe("0.2px");
  expect(pxOf(0.35)).toBe("0.3px"); // Python round(0.35, 1) == 0.3: 0.35 is below the tie in binary
  expect(pxOf(0.15)).toBe("0.1px");
  expect(pxOf(0.45)).toBe("0.5px");
  expect(pxOf(10.04)).toBe("10px");
});
test("more than 100 decimals never throws and matches Python", () => {
  expect(naturalDigits(1e-101)).toBe(`0.${"0".repeat(100)}1`);
  expect(naturalDigits(5e-324)).toMatch(/^0\.0{300,}4940656$/);
  expect(formatNumber(1.5, { digits: 101 })).toBe(`1.5${"0".repeat(100)}`);
  expect(formatNumber(1e-101, { digits: 101 })).toBe(`0.${"0".repeat(100)}1`);
});
test("ordinals: 1st 2nd 3rd 4th 11th 12th 13th 21st 22nd 23rd 111th", () => {
  expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 111].map(ordinal)).toEqual([
    "1st",
    "2nd",
    "3rd",
    "4th",
    "11th",
    "12th",
    "13th",
    "21st",
    "22nd",
    "23rd",
    "111th",
  ]);
});
