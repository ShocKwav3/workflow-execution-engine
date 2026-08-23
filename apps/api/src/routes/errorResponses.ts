import { problemDetailsSchema } from "../errors/problemDetails.js";

export const ERROR_RESPONSES = {
  400: problemDetailsSchema,
  404: problemDetailsSchema,
  409: problemDetailsSchema,
  503: problemDetailsSchema,
};
