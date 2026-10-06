export class SportyError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}
export class UnknownLeagueError extends SportyError {}
export class UnknownDisplayRangeError extends SportyError {}
