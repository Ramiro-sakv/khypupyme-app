/** Application category; a local validation has no HTTP request. Never replace SDK errors with this class. */
export class AppError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly appCode = "VALIDATION",
    readonly field?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}
