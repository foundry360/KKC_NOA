import { describe, expect, it } from "vitest";
import {
  AppError,
  ConfigurationError,
  NotFoundError,
  ValidationError,
  isAppError,
} from "@/src/domain/errors/app-error";

describe("AppError hierarchy", () => {
  it("ValidationError defaults to 400", () => {
    const err = new ValidationError("bad content type", { contentType: "text/plain" });
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.statusCode).toBe(400);
    expect(isAppError(err)).toBe(true);
  });

  it("NotFoundError and ConfigurationError expose codes", () => {
    expect(new NotFoundError("missing").statusCode).toBe(404);
    expect(new ConfigurationError("no adapter").code).toBe("CONFIGURATION_ERROR");
  });

  it("isAppError is false for generic errors", () => {
    expect(isAppError(new Error("nope"))).toBe(false);
  });
});
