#checkov:skip=CKV_DOCKER_2:Kubernetes runs the migration as a Job; it needs no HEALTHCHECK
FROM liquibase/liquibase:5.0.4 AS dev
RUN lpm add postgresql --global

# Compose mounts the changelog over this path; a cluster has no mount.
FROM dev AS runtime
COPY packages/core/db/changelog/ /liquibase/changelog/

# lpm installs the driver at build time; the Job does not need it.
# shortcut: the base image lags behind Ubuntu fixes; drop the package upgrade once the Liquibase image includes them.
USER root
RUN rm /liquibase/bin/lpm \
  && apt-get update \
  && apt-get install -y --no-install-recommends --only-upgrade libbrotli1 libssl3t64 openssl \
  && rm -rf /var/lib/apt/lists/*

USER liquibase
