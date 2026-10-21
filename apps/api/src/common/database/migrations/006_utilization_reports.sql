-- ENT-012 · ENT-013 — utilization reports, one issue at a time; an issue is never changed, a new
-- one is issued instead (BR-mrr-015).

CREATE TABLE utilization_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_type  text NOT NULL CHECK (period_type IN ('MONTH', 'YEAR')),
  period_start date NOT NULL,
  period_end   date NOT NULL CHECK (period_end >= period_start),
  issue_no     integer NOT NULL CHECK (issue_no >= 1),
  issued_by    uuid NOT NULL REFERENCES users (id),
  issued_at    timestamptz NOT NULL,
  UNIQUE (period_type, period_start, issue_no)
);

CREATE TABLE utilization_report_lines (
  report_id         uuid NOT NULL REFERENCES utilization_reports (id),
  room_id           uuid NOT NULL REFERENCES meeting_rooms (id),
  booked_minutes    integer NOT NULL CHECK (booked_minutes >= 0),
  operating_minutes integer NOT NULL CHECK (operating_minutes >= 0),
  -- DQ-mrr-010: empty when nothing operated, and then the room takes no rank.
  utilization_pct   numeric(5, 2) CHECK (utilization_pct BETWEEN 0 AND 100),
  rank              integer CHECK (rank >= 1),
  PRIMARY KEY (report_id, room_id),
  CHECK ((utilization_pct IS NULL) = (operating_minutes = 0)),
  CHECK ((rank IS NULL) = (utilization_pct IS NULL))
);

-- BR-mrr-015: once issued, a report and its lines are never changed or removed — not even by the
-- application. TRUNCATE is left alone so a test database can still be emptied.
CREATE FUNCTION utilization_reports_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only (BR-mrr-015)', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER utilization_reports_append_only
  BEFORE UPDATE OR DELETE ON utilization_reports
  FOR EACH ROW EXECUTE FUNCTION utilization_reports_append_only();

CREATE TRIGGER utilization_report_lines_append_only
  BEFORE UPDATE OR DELETE ON utilization_report_lines
  FOR EACH ROW EXECUTE FUNCTION utilization_reports_append_only();
