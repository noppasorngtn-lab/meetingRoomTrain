-- ENT-005 — the facilities a room has, per version, so an older version keeps what it had (DQ-mrr-002).

CREATE TABLE room_version_facilities (
  room_version_id uuid NOT NULL REFERENCES meeting_room_versions (id),
  facility_id     uuid NOT NULL REFERENCES facilities (id),
  PRIMARY KEY (room_version_id, facility_id)
);
