-- ENT-011 · STM-mrr-002 — an edit made after a meeting ended waits as a request; the booking keeps
-- its values until another Room Administrator approves it (BR-mrr-014).

CREATE TABLE booking_adjustment_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       uuid NOT NULL REFERENCES bookings (id),
  requested_by     uuid NOT NULL REFERENCES users (id),
  proposed_changes jsonb NOT NULL CHECK (jsonb_typeof(proposed_changes) = 'object' AND proposed_changes <> '{}'::jsonb),
  reason           text NOT NULL CHECK (btrim(reason) <> ''),
  status           text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  decided_by       uuid REFERENCES users (id),
  decided_at       timestamptz,
  created_at       timestamptz NOT NULL,
  -- BR-mrr-014: whoever asked does not decide.
  CHECK (decided_by IS NULL OR decided_by <> requested_by),
  CHECK ((status = 'PENDING') = (decided_by IS NULL AND decided_at IS NULL))
);

CREATE INDEX booking_adjustment_requests_pending ON booking_adjustment_requests (status, created_at);
