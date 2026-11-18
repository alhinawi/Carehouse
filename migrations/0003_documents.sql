CREATE TABLE documents (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), patient_id TEXT NOT NULL REFERENCES records(id), filename TEXT NOT NULL, mime_type TEXT NOT NULL, byte_size INTEGER NOT NULL CHECK(byte_size BETWEEN 1 AND 131072), payload TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX documents_patient ON documents(workspace_id,patient_id);
