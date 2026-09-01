import {
  PROBLEM_DETAILS_CONTENT_TYPE,
  problemDetailsSchema,
} from "@workflow-engine/core/errors/problemDetails.js";

const problemDetailsResponse = {
  content: { [PROBLEM_DETAILS_CONTENT_TYPE]: { schema: problemDetailsSchema } },
};

export const ERROR_RESPONSES = {
  400: problemDetailsResponse,
  404: problemDetailsResponse,
  409: problemDetailsResponse,
  503: problemDetailsResponse,
};
