--liquibase formatted sql

--changeset feroj:0001-initial-schema
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE workflow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workflow_version (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL,
  version INTEGER NOT NULL,
  definition JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workflow_id, version),
  UNIQUE (id, workflow_id),
  FOREIGN KEY (workflow_id) REFERENCES workflow (id)
);

CREATE INDEX idx_workflow_version_workflow_id ON workflow_version (workflow_id);

CREATE TABLE workflow_execution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL,
  workflow_version_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  FOREIGN KEY (workflow_id) REFERENCES workflow (id),
  FOREIGN KEY (workflow_version_id, workflow_id) REFERENCES workflow_version (id, workflow_id)
);

CREATE INDEX idx_workflow_execution_workflow_id ON workflow_execution (workflow_id);
CREATE INDEX idx_workflow_execution_workflow_version_id ON workflow_execution (workflow_version_id);
CREATE UNIQUE INDEX idx_workflow_execution_idempotency ON workflow_execution (workflow_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE step_execution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_execution_id UUID NOT NULL,
  step_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (workflow_execution_id) REFERENCES workflow_execution (id)
);

CREATE INDEX idx_step_execution_workflow_execution_id ON step_execution (workflow_execution_id);

CREATE TABLE step_attempt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_execution_id UUID NOT NULL,
  attempt_number INTEGER NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error TEXT,
  FOREIGN KEY (step_execution_id) REFERENCES step_execution (id)
);

CREATE INDEX idx_step_attempt_step_execution_id ON step_attempt (step_execution_id);

--rollback DROP TABLE IF EXISTS step_attempt;
--rollback DROP TABLE IF EXISTS step_execution;
--rollback DROP TABLE IF EXISTS workflow_execution;
--rollback DROP TABLE IF EXISTS workflow_version;
--rollback DROP TABLE IF EXISTS workflow;
