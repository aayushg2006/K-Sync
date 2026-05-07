import { NextFunction, Request, Response } from "express";
import { ZodTypeAny } from "zod";

type RequestSchemas = Partial<{
  body: ZodTypeAny;
  params: ZodTypeAny;
  query: ZodTypeAny;
}>;

function replaceObjectValues<T extends object>(target: T, nextValue: unknown) {
  const mutableTarget = target as Record<string, unknown>;

  for (const key of Object.keys(mutableTarget)) {
    delete mutableTarget[key];
  }

  if (nextValue && typeof nextValue === "object") {
    Object.assign(mutableTarget, nextValue as Record<string, unknown>);
  }
}

export function validateRequest(schemas: RequestSchemas) {
  return (request: Request, _response: Response, next: NextFunction) => {
    if (schemas.params) {
      replaceObjectValues(request.params, schemas.params.parse(request.params));
    }

    if (schemas.query) {
      replaceObjectValues(request.query, schemas.query.parse(request.query));
    }

    if (schemas.body) {
      request.body = schemas.body.parse(request.body);
    }

    next();
  };
}
