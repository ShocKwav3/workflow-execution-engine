import type { AppError } from "./AppError.js";
import { translateZodError } from "./translateZodError.js";
import { translateClassifiedError } from "./translateClassifiedError.js";

export type ErrorTranslator = (error: unknown) => AppError | undefined;

export const errorTranslators: ErrorTranslator[] = [translateZodError, translateClassifiedError];
