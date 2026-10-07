--liquibase formatted sql

--changeset feroj:0006-node-execution-attempt-status
ALTER TABLE node_execution_attempt
  ADD CONSTRAINT node_execution_attempt_status_check CHECK (status IN ('RUNNING', 'COMPLETED', 'ABANDONED'));

-- The unique constraint's index leads with node_execution_id, so the single-column index is redundant.
ALTER TABLE node_execution_attempt
  ADD CONSTRAINT node_execution_attempt_number_unique UNIQUE (node_execution_id, attempt_number);

DROP INDEX idx_node_execution_attempt_node_execution_id;

--rollback CREATE INDEX idx_node_execution_attempt_node_execution_id ON node_execution_attempt (node_execution_id);
--rollback ALTER TABLE node_execution_attempt DROP CONSTRAINT node_execution_attempt_number_unique;
--rollback ALTER TABLE node_execution_attempt DROP CONSTRAINT node_execution_attempt_status_check;
