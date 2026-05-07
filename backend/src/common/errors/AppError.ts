import { ErrorCode, ERROR_CODES } from "./errorCodes";

type AppErrorOptions = {
  code?: ErrorCode;
  details?: unknown;
  message: string;
  statusCode?: number;
};

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: unknown;
  public readonly statusCode: number;

  constructor({
    code = ERROR_CODES.INTERNAL_SERVER_ERROR,
    details,
    message,
    statusCode = 500,
  }: AppErrorOptions) {
    super(message);

    this.name = "AppError";
    this.code = code;
    this.details = details;
    this.statusCode = statusCode;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}
