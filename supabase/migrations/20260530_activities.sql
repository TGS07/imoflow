-- Activities table
CREATE TABLE public.activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  lead_id       UUID REFERENCES leads(id) ON DELETE CASCADE,
  person_id     UUID REFERENCES people(id) ON DELETE SET NULL,
  assigned_to   UUID REFERENCES users(id) ON DELETE SET NULL,
  type          TEXT NOT NULL CHECK (type IN ('chamada','visita','email','reuniao','tarefa','nota')),
  title         TEXT NOT NULL,
  description   TEXT,
  due_date      TIMESTAMPTZ,
  end_date      TIMESTAMPTZ,
  completed     BOOLEAN NOT NULL DEFAULT false,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX activities_agency_idx ON activities(agency_id);
CREATE INDEX activities_lead_idx ON activities(lead_id);
CREATE INDEX activities_due_idx ON activities(agency_id, due_date);
CREATE INDEX activities_assigned_idx ON activities(assigned_to, completed);

-- RLS
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activities_agency_isolation" ON activities
  FOR ALL
  USING (agency_id = get_my_agency_id())
  WITH CHECK (agency_id = get_my_agency_id());

-- Migrate contacts → activities
INSERT INTO activities (agency_id, lead_id, assigned_to, type, title, description, due_date, completed, created_at)
SELECT l.agency_id, c.lead_id, c.user_id, c.type, c.title, c.description, c.created_at, true, c.created_at
FROM contacts c
JOIN leads l ON l.id = c.lead_id;

-- Migrate tasks → activities
INSERT INTO activities (agency_id, lead_id, assigned_to, type, title, due_date, completed, completed_at, created_at)
SELECT l.agency_id, t.lead_id, t.assigned_to, 'tarefa', t.title, t.due_date::timestamptz, t.completed,
  CASE WHEN t.completed THEN t.created_at END, t.created_at
FROM tasks t
JOIN leads l ON l.id = t.lead_id;
