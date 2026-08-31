# Bruno Collection

Select the **Local** environment before sending requests — it supplies `{{baseUrl}}`.

Requests that create a resource (`Create Workflow`, `Create Workflow Version`,
`Create Node`, `Create Execution`) auto-capture the new ID into a runtime variable
(`{{workflowId}}`, `{{versionId}}`, `{{nodeId}}`, `{{executionId}}`) via a
`script:post-response` block, so running requests in sequence needs no manual copying
of IDs between them.

## Known Bruno bug: body-less POST/PUT/PATCH requests get a 415

Bruno's HTTP client defaults `Content-Type` to `application/x-www-form-urlencoded` on
POST/PUT/PATCH requests with "No Body" selected, regardless of what the Headers tab
shows — a confirmed, unresolved upstream bug
([usebruno/bruno#1693](https://github.com/usebruno/bruno/issues/1693)). Workaround: set
the request's Body tab to JSON with `{}` instead of "No Body" — Bruno then sends a real
`application/json` content-type, and Fastify accepts it fine on routes with no declared
body schema. **Publish Workflow Version** already does this; apply the same fix to any
future body-less mutating route that hits the same issue.
