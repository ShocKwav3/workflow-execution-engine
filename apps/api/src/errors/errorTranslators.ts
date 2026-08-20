import type { AppError } from "./AppError.js";
import { translateDatabaseError } from "./translateDatabaseError.js";
import { translateZodError } from "./translateZodError.js";

export type ErrorTranslator = (error: unknown) => AppError | undefined;

export const errorTranslators: ErrorTranslator[] = [translateZodError, translateDatabaseError];
