--liquibase formatted sql

--changeset feroj:0002-outbox-message
CREATE TABLE outbox_message (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destination TEXT NOT NULL,
  routing_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'PUBLISHED')),
  claimed_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_outbox_message_status_created_at ON outbox_message (status, created_at);

--rollback DROP TABLE IF EXISTS outbox_message;
