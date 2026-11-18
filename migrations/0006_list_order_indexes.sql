CREATE INDEX IF NOT EXISTS records_workspace_created ON records(workspace_id,created_at DESC);
CREATE INDEX IF NOT EXISTS documents_workspace_patient_created ON documents(workspace_id,patient_id,created_at DESC);
