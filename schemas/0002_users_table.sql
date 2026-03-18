-- 0002_users_table.sql
-- Users table for authentication (missing from initial schema)

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, -- UUID generated via crypto.randomUUID()
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, -- bcrypt hash
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  active INTEGER NOT NULL DEFAULT 1, -- boolean: 1 = active, 0 = inactive
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);
