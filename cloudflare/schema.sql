PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS audit_reference_counters (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS audit_requests (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  submission_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','IN_REVIEW','REPORT_READY','TO_VALIDATE','SENT','CLOSED')),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  company_name TEXT NOT NULL,
  activity TEXT NOT NULL,
  city TEXT,
  company_description TEXT,
  digital_presence TEXT NOT NULL DEFAULT '{}',
  main_objective TEXT NOT NULL,
  objective_details TEXT,
  main_problem TEXT NOT NULL,
  problem_details TEXT,
  additional_information TEXT,
  answers TEXT NOT NULL DEFAULT '{}',
  consent_at TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_id TEXT NOT NULL REFERENCES audit_requests(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  actor TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_id TEXT NOT NULL REFERENCES audit_requests(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  note TEXT NOT NULL CHECK (length(note) BETWEEN 1 AND 5000),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_documents (
  id TEXT PRIMARY KEY,
  audit_id TEXT NOT NULL REFERENCES audit_requests(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('request_summary','final_report','evidence')),
  storage_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  size_bytes INTEGER,
  content BLOB NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (audit_id, document_type)
);

CREATE TABLE IF NOT EXISTS audit_notification_deliveries (
  id TEXT PRIMARY KEY,
  audit_id TEXT NOT NULL REFERENCES audit_requests(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('admin','client')),
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','failed','unknown')),
  provider TEXT,
  provider_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  attempted_at TEXT,
  sent_at TEXT,
  locked_at TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (audit_id, notification_type)
);

CREATE TABLE IF NOT EXISTS audit_submission_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fingerprint_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_admin_login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fingerprint_hash TEXT NOT NULL,
  successful INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_findings (
  id TEXT PRIMARY KEY,
  audit_id TEXT NOT NULL REFERENCES audit_requests(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT,
  finding TEXT NOT NULL,
  impact TEXT,
  recommendation TEXT,
  priority TEXT CHECK (priority IS NULL OR priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  internal_comment TEXT,
  evidence_key TEXT,
  include_in_report INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_reports (
  id TEXT PRIMARY KEY,
  audit_id TEXT NOT NULL REFERENCES audit_requests(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','READY','VALIDATED','SENT')),
  storage_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (audit_id, version)
);

CREATE INDEX IF NOT EXISTS audit_requests_status_idx ON audit_requests(status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS audit_requests_email_idx ON audit_requests(email);
CREATE INDEX IF NOT EXISTS audit_history_idx ON audit_status_history(audit_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_notes_idx ON audit_notes(audit_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_notifications_idx ON audit_notification_deliveries(audit_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_rate_limit_idx ON audit_submission_limits(fingerprint_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_login_limit_idx ON audit_admin_login_attempts(fingerprint_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS configurator_reference_counters (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS configurator_requests (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  submission_key TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  company_name TEXT,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp TEXT,
  country TEXT NOT NULL,
  city TEXT,
  preferred_language TEXT,
  request_types TEXT NOT NULL DEFAULT '[]',
  answers TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS configurator_notification_deliveries (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES configurator_requests(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('admin','client')),
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','failed','unknown')),
  provider TEXT,
  provider_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  attempted_at TEXT,
  sent_at TEXT,
  locked_at TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (request_id, notification_type)
);

CREATE TABLE IF NOT EXISTS configurator_submission_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fingerprint_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS configurator_requests_email_idx ON configurator_requests(email);
CREATE INDEX IF NOT EXISTS configurator_notifications_idx ON configurator_notification_deliveries(request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS configurator_rate_limit_idx ON configurator_submission_limits(fingerprint_hash, created_at DESC);
