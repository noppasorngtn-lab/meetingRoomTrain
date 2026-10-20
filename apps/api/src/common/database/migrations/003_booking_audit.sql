-- ENT-010 — the trail of what a Room Administrator did to a booking (BR-mrr-017).

CREATE TABLE booking_audit_entries (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings (id),
  actor_id   uuid NOT NULL REFERENCES users (id),
  action     text NOT NULL CHECK (action IN (
               'APPROVE', 'REJECT', 'CHANGE_DECISION', 'EDIT_ON_BEHALF', 'CANCEL_ON_BEHALF',
               'CREATE_ADJUSTMENT', 'APPROVE_ADJUSTMENT', 'REJECT_ADJUSTMENT')),
  reason     text,
  detail     jsonb,
  at         timestamptz NOT NULL
);

CREATE INDEX booking_audit_entries_booking ON booking_audit_entries (booking_id, at);

-- BR-mrr-018: once written, an entry is never changed or removed — not even by the application.
CREATE FUNCTION booking_audit_entries_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'booking_audit_entries is append-only (BR-mrr-018)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER booking_audit_entries_append_only
  BEFORE UPDATE OR DELETE ON booking_audit_entries
  FOR EACH ROW EXECUTE FUNCTION booking_audit_entries_append_only();
