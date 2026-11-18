CREATE INDEX records_workspace_department ON records(workspace_id, department);
CREATE INDEX records_workspace_staff ON records(workspace_id, staff_id);
CREATE INDEX records_workspace_demo ON records(workspace_id, demo);
CREATE INDEX users_workspace ON users(workspace_id);
CREATE INDEX sessions_workspace_user ON sessions(workspace_id, user_id);
ALTER TABLE workspaces ADD COLUMN data_version INTEGER NOT NULL DEFAULT 0;
