import { expectTypeOf, test } from "vitest";
import type { WithAthleteId } from "../src/athletes.js";

test("WithAthleteId keeps each union member's own fields and overwrites athlete_id", () => {
  type Row = { p: string; kind: "rush"; yards: number } | { p: string; kind: "pass"; attempts: number };
  const r = {} as WithAthleteId<Row>;
  if (r.kind === "rush") expectTypeOf(r.yards).toEqualTypeOf<number>();
  else expectTypeOf(r.attempts).toEqualTypeOf<number>();
  expectTypeOf<WithAthleteId<{ p: string; athlete_id: number }>["athlete_id"]>().toEqualTypeOf<
    string | undefined
  >();
});
