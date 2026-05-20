CREATE TABLE t_p76555076_online_disk_project.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE t_p76555076_online_disk_project.files
  ADD COLUMN user_id UUID REFERENCES t_p76555076_online_disk_project.users(id);
