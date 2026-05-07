import jsonata from "jsonata";

import { AppError } from "../../common/errors/AppError";
import { ERROR_CODES } from "../../common/errors/errorCodes";

function isEmptyMappingResult(value: unknown) {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim().length === 0;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length === 0;
  }

  return false;
}

export async function applyJsonataMapping<T = unknown>(
  mappingExpression: string,
  input: unknown,
): Promise<T> {
  try {
    const expression = jsonata(mappingExpression);
    const result = await expression.evaluate(input);

    if (isEmptyMappingResult(result)) {
      throw new AppError({
        code: ERROR_CODES.INTERNAL_SERVER_ERROR,
        details: {
          reason: "EMPTY_MAPPING_RESULT",
        },
        message: "Failed to evaluate schema mapping: mapping returned an empty result.",
        statusCode: 500,
      });
    }

    return result as T;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    const message =
      error instanceof Error ? error.message : "Unknown JSONata evaluation error.";

    throw new AppError({
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      details: {
        cause: message,
      },
      message: "Failed to evaluate schema mapping.",
      statusCode: 500,
    });
  }
}
