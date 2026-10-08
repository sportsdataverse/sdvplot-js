export class SportyError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}
export class UnknownLeagueError extends SportyError {}
export class UnknownDisplayRangeError extends SportyError {}
export class UnknownUnitError extends SportyError {}
/** A scene or option that cannot be drawn (e.g. a `custom` league with an empty bbox). */
export class InputError extends SportyError {}
