import { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import { AppError } from "../errors/AppError";
import { ERROR_CODES } from "../errors/errorCodes";

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    return response.status(400).json({
      code: ERROR_CODES.VALIDATION_ERROR,
      details: error.flatten(),
      message: "Request validation failed.",
    });
  }

  if (error instanceof AppError) {
    return response.status(error.statusCode).json({
      code: error.code,
      details: error.details,
      message: error.message,
    });
  }

  return response.status(500).json({
    code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    message: "An unexpected error occurred.",
  });
};
