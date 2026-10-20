-- ENT-007 · ENT-009 (and ENT-004, the facility ENT-009 points at) — what creating a booking needs.

-- BR-mrr-001: [start, end) of one room never overlaps another booking that holds the time.
-- The database is the last word, so two confirms racing for the same slot cannot both win (DQ-mrr-006).
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (room_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&)
  WHERE (status IN ('PENDING_APPROVAL', 'CONFIRMED', 'APPROVED'));

CREATE TABLE facilities (
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name   varchar(100) NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE booking_equipment_requests (
  booking_id  uuid NOT NULL REFERENCES bookings (id),
  facility_id uuid NOT NULL REFERENCES facilities (id),
  PRIMARY KEY (booking_id, facility_id)
);
