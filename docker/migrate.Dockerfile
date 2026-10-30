#checkov:skip=CKV_DOCKER_2:Kubernetes runs the migration as a Job; it needs no HEALTHCHECK
FROM liquibase/liquibase:5.0.4 AS dev
RUN lpm add postgresql --global

# Compose mounts the changelog over this path; a cluster has no mount.
FROM dev AS runtime
COPY packages/core/db/changelog/ /liquibase/changelog/

# lpm installs the driver at build time; the Job does not need it.
USER root
RUN rm /liquibase/bin/lpm

USER liquibase
