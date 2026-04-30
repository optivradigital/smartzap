-- Add organization_id to template_projects for proper multi-tenant isolation
ALTER TABLE template_projects
  ADD COLUMN IF NOT EXISTS organization_id TEXT;

CREATE INDEX IF NOT EXISTS idx_template_projects_org
  ON template_projects(organization_id);
