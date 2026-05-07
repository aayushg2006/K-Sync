import { NextFunction, Request, Response } from "express";
import { nanoid } from "nanoid";

export function requestLogger(request: Request, response: Response, next: NextFunction) {
  const requestId = nanoid(10);

  response.setHeader("X-Request-Id", requestId);
  console.info(`[${requestId}] ${request.method} ${request.originalUrl}`);

  next();
}
