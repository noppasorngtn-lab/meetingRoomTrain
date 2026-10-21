-- ENT-006 — the periods a room spent under maintenance (BR-mrr-012 · STM-mrr-003).

CREATE TABLE room_maintenance_periods (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id  uuid NOT NULL REFERENCES meeting_rooms (id),
  start_at timestamptz NOT NULL,
  -- Empty while the room is still under maintenance; once set, after the start.
  end_at   timestamptz CHECK (end_at IS NULL OR end_at > start_at),
  set_by   uuid NOT NULL REFERENCES users (id)
);

-- A room has at most one open period; closed ones follow each other, so they never overlap.
CREATE UNIQUE INDEX room_maintenance_periods_open ON room_maintenance_periods (room_id) WHERE end_at IS NULL;
