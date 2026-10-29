FROM liquibase/liquibase:5.0.3 AS dev
RUN lpm add postgresql --global

# Compose mounts the changelog over this path; a cluster has no mount.
FROM dev AS runtime
COPY packages/core/db/changelog/ /liquibase/changelog/
