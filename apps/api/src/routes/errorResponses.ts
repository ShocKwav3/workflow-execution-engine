import { errorEnvelopeSchema } from "../errorHandler.js";

export const ERROR_RESPONSES = {
  400: errorEnvelopeSchema,
  409: errorEnvelopeSchema,
  503: errorEnvelopeSchema,
};
