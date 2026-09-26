--liquibase formatted sql

--changeset feroj:0005-outbox-message
CREATE TABLE outbox_message (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destination TEXT NOT NULL,
  message_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  correlation_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  claim_token UUID,
  lease_until TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  CONSTRAINT outbox_message_destination_check CHECK (destination IN ('bullmq')),
  CONSTRAINT outbox_message_status_check CHECK (status IN ('PENDING', 'PROCESSING', 'PUBLISHED'))
);

CREATE INDEX idx_outbox_message_unpublished ON outbox_message (destination, created_at)
  WHERE status IN ('PENDING', 'PROCESSING');

--rollback DROP TABLE outbox_message;
