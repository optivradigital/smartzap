-- Enable RLS on template tables (security advisor fix)
-- All CRUD still uses service_role (bypasses RLS automatically)
-- SELECT policy for anon preserves realtime subscriptions in the browser client

ALTER TABLE public.template_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_project_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select" ON public.template_projects
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_select" ON public.template_project_items
  FOR SELECT TO anon USING (true);
