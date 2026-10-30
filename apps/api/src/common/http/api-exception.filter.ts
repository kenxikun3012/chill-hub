import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { ApiError } from "@chill-hub/shared";
import type { Response } from "express";
import { STATUS_CODES } from "node:http";
import { Prisma } from "../../generated/prisma/client";

/** Turns every error into the shared ApiError shape and maps database errors to sensible HTTP codes. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("ApiExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const body = this.toApiError(exception);
    if (body.statusCode >= 500) this.logger.error(exception instanceof Error ? exception.stack : exception);
    res.status(body.statusCode).json(body);
  }

  private toApiError(exception: unknown): ApiError {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const r = typeof response === "string" ? { message: response } : (response as Record<string, unknown>);
      const rawMessage = r["message"];
      const details = (r["details"] as string[] | undefined) ?? (Array.isArray(rawMessage) ? rawMessage : undefined);
      return {
        statusCode: status,
        error: STATUS_CODES[status] ?? "Error",
        message: typeof rawMessage === "string" ? rawMessage : exception.message,
        ...(details ? { details } : {}),
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const target = this.describeTarget(exception.meta);
      switch (exception.code) {
        case "P2002":
          return this.error(HttpStatus.CONFLICT, `This ${target || "value"} is already taken`);
        case "P2025":
        case "P2001":
          return this.error(HttpStatus.NOT_FOUND, "Not found");
        case "P2003":
          return this.error(HttpStatus.CONFLICT, "A related record is missing or still in use");
        case "P2004":
        case "P2011":
        case "P2012":
          return this.error(HttpStatus.BAD_REQUEST, "The data breaks a database rule");
      }
    }
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return this.error(HttpStatus.BAD_REQUEST, "Invalid request data");
    }

    return this.error(HttpStatus.INTERNAL_SERVER_ERROR, "Something went wrong");
  }

  private describeTarget(meta: Record<string, unknown> | undefined): string {
    const target = meta?.["target"] ?? (meta?.["driverAdapterError"] as { cause?: { constraint?: { fields?: string[] } } })?.cause?.constraint?.fields;
    if (Array.isArray(target)) return target.join(", ");
    return typeof target === "string" ? target : "";
  }

  private error(statusCode: number, message: string): ApiError {
    return { statusCode, error: STATUS_CODES[statusCode] ?? "Error", message };
  }
}
