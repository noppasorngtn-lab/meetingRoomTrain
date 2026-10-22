-- ENT-014 LoginCode — one row per sign-in email: the code and the magic link share it (BR-mrr-027).
-- Only hashes are stored. STM-mrr-004: ISSUED -> USED | EXPIRED.

CREATE TABLE login_codes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES users (id),
  code_hash             text NOT NULL,
  magic_link_token_hash text NOT NULL UNIQUE,
  issued_at             timestamptz NOT NULL,
  expires_at            timestamptz NOT NULL,
  status                text NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('ISSUED', 'USED', 'EXPIRED')),
  used_at               timestamptz,
  used_via              text CHECK (used_via IN ('CODE', 'MAGIC_LINK'))
);

-- At most one usable code per user, even when two requests arrive together (BR-mrr-025 · DQ-mrr-015).
-- A code past expires_at is moved to EXPIRED before a new one is issued.
CREATE UNIQUE INDEX login_codes_one_issued_per_user ON login_codes (user_id) WHERE status = 'ISSUED';

-- The session a used code opens. Not a business entity (ENT-014 notes): its storage is dev's.
-- It ends after 30 minutes with no request (decided by Noppasorn, 2026-10-22).
CREATE TABLE sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash   text NOT NULL UNIQUE,
  user_id      uuid NOT NULL REFERENCES users (id),
  created_at   timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL
);
