ALTER TABLE records ADD COLUMN duration INTEGER NOT NULL DEFAULT 30;
CREATE TABLE mutation_guards (id TEXT PRIMARY KEY, ok INTEGER NOT NULL CHECK(ok=1));
CREATE TRIGGER appointments_no_overlap_insert BEFORE INSERT ON records
WHEN NEW.module='appointments' AND NEW.status NOT IN ('Cancelled','No-show')
BEGIN
 SELECT RAISE(ABORT,'Appointment overlaps an existing appointment') WHERE EXISTS (
 SELECT 1 FROM records r WHERE r.workspace_id=NEW.workspace_id AND r.module='appointments' AND r.staff_id=NEW.staff_id AND r.status NOT IN ('Cancelled','No-show')
 AND julianday(NEW.scheduled_at)<julianday(r.scheduled_at,'+'||r.duration||' minutes')
 AND julianday(NEW.scheduled_at,'+'||NEW.duration||' minutes')>julianday(r.scheduled_at));
END;
CREATE TRIGGER appointments_no_overlap_update BEFORE UPDATE ON records
WHEN NEW.module='appointments' AND NEW.status NOT IN ('Cancelled','No-show')
BEGIN
 SELECT RAISE(ABORT,'Appointment overlaps an existing appointment') WHERE EXISTS (
 SELECT 1 FROM records r WHERE r.workspace_id=NEW.workspace_id AND r.id!=NEW.id AND r.module='appointments' AND r.staff_id=NEW.staff_id AND r.status NOT IN ('Cancelled','No-show')
 AND julianday(NEW.scheduled_at)<julianday(r.scheduled_at,'+'||r.duration||' minutes')
 AND julianday(NEW.scheduled_at,'+'||NEW.duration||' minutes')>julianday(r.scheduled_at));
END;
