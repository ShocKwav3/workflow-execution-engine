--liquibase formatted sql

--changeset feroj:0003-workflow-execution-created-status
ALTER TABLE workflow_execution ALTER COLUMN status SET DEFAULT 'CREATED';

--rollback ALTER TABLE workflow_execution ALTER COLUMN status SET DEFAULT 'PENDING';
