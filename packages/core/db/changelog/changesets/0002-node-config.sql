--liquibase formatted sql

--changeset feroj:0002-node-config
ALTER TABLE node ADD COLUMN config JSONB NOT NULL DEFAULT '{}';

--rollback ALTER TABLE node DROP COLUMN config;
