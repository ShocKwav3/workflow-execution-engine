--liquibase formatted sql

--changeset feroj:0004-status-check-constraints
ALTER TABLE workflow_version
  ADD CONSTRAINT workflow_version_status_check CHECK (status IN ('DRAFT', 'PUBLISHED'));

ALTER TABLE workflow_execution
  ADD CONSTRAINT workflow_execution_status_check CHECK (status IN ('CREATED', 'RUNNING', 'COMPLETED'));

ALTER TABLE node_execution
  ADD CONSTRAINT node_execution_status_check CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED'));

--rollback ALTER TABLE node_execution DROP CONSTRAINT node_execution_status_check;
--rollback ALTER TABLE workflow_execution DROP CONSTRAINT workflow_execution_status_check;
--rollback ALTER TABLE workflow_version DROP CONSTRAINT workflow_version_status_check;
