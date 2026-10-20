-- ENT-001 · ENT-002 · ENT-003 · ENT-007 · ENT-008 — the tables the calendar reads.
-- The no-overlap exclusion constraint (BR-mrr-001) arrives with the unit that creates bookings.

CREATE TABLE users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL UNIQUE,
  full_name  varchar(200) NOT NULL,
  role       text NOT NULL CHECK (role IN ('GENERAL_USER', 'ROOM_ADMINISTRATOR', 'SYSTEM_ADMINISTRATOR')),
  active     boolean NOT NULL DEFAULT true
);

CREATE TABLE meeting_rooms (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code               text NOT NULL UNIQUE,
  current_version_id uuid NOT NULL,
  status             text NOT NULL CHECK (status IN ('ACTIVE', 'UNDER_MAINTENANCE', 'ARCHIVED')),
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE meeting_room_versions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id           uuid NOT NULL REFERENCES meeting_rooms (id),
  version_no        integer NOT NULL CHECK (version_no >= 1),
  name              varchar(100) NOT NULL,
  capacity          integer NOT NULL CHECK (capacity >= 1),
  photos            jsonb NOT NULL DEFAULT '[]',
  requires_approval boolean NOT NULL,
  approver_id       uuid REFERENCES users (id),
  created_by        uuid NOT NULL REFERENCES users (id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, version_no)
);

-- A room and its first version point at each other, so the room's side is checked at commit.
ALTER TABLE meeting_rooms
  ADD CONSTRAINT meeting_rooms_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES meeting_room_versions (id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE bookings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         uuid NOT NULL REFERENCES meeting_rooms (id),
  room_version_id uuid NOT NULL REFERENCES meeting_room_versions (id),
  booked_by       uuid NOT NULL REFERENCES users (id),
  title           text NOT NULL,
  start_at        timestamptz NOT NULL,
  end_at          timestamptz NOT NULL CHECK (end_at > start_at),
  status          text NOT NULL CHECK (status IN ('PENDING_APPROVAL', 'CONFIRMED', 'APPROVED', 'REJECTED', 'CANCELLED')),
  reminder_status text NOT NULL DEFAULT 'NOT_SENT' CHECK (reminder_status IN ('NOT_SENT', 'SENT', 'FAILED')),
  reminder_at     timestamptz,
  cancel_reason   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bookings_room_time ON bookings (room_id, start_at);

CREATE TABLE booking_attendees (
  booking_id uuid NOT NULL REFERENCES bookings (id),
  user_id    uuid NOT NULL REFERENCES users (id),
  PRIMARY KEY (booking_id, user_id)
);
