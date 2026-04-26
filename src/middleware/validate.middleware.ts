import type { AnyZodObject } from "zod";
import type { NextFunction, Request, Response } from "express";

export function validate(schema: AnyZodObject) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params
      });
      next();
    } catch (err) {
      // FIX: pass Zod errors to the error handler middleware instead of
      // letting them propagate as unhandled exceptions
      next(err);
    }
  };
}
