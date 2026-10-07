// src/errors.ts — spec §3: sdvtables adds TableSpecError to the SdvplotError hierarchy (the base sets name = new.target.name)
import { SdvplotError } from "@sportsdataverse/sdvplot";
export class TableSpecError extends SdvplotError {}
