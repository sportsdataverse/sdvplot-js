export class SdvplotError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}
export class InputError extends SdvplotError {}
export class UnresolvedTeamError extends SdvplotError {}
export class UnsupportedTargetError extends SdvplotError {}
export class OfflineError extends SdvplotError {}
export class DownloadError extends OfflineError {
  constructor(
    message: string,
    readonly url: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export type WarningHandler = (message: string) => void;
let handler: WarningHandler | null = null;
const seen = new Set<string>();
export function setWarningHandler(fn: WarningHandler | null): void {
  handler = fn;
}
export function resetWarnings(): void {
  seen.clear();
}
/** One warning per `key` per process (spec §4.3): a 10k-row join must not print 10k lines. */
export function warn(key: string, message: string): void {
  if (seen.has(key)) return;
  seen.add(key);
  (handler ?? ((m: string) => console.warn(`[sdvplot] ${m}`)))(message);
}
