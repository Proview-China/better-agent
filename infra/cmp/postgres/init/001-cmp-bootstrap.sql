CREATE SCHEMA IF NOT EXISTS praxis_cmp;

CREATE TABLE IF NOT EXISTS praxis_cmp.runtime_heartbeat (
  service_name text PRIMARY KEY,
  updated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

INSERT INTO praxis_cmp.runtime_heartbeat (service_name, status)
VALUES ('cmp-postgres', 'ready')
ON CONFLICT (service_name) DO NOTHING;
