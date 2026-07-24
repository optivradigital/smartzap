-- smartzap_users e smartzap_sessions estavam sem RLS, expostas para as chaves
-- anon/authenticated do client Supabase. Todo acesso do app é feito via
-- service_role (server-side, lib/clerk-auth.ts, lib/multi-user-auth.ts),
-- que ignora RLS — habilitar aqui apenas fecha o acesso client-side indevido.
ALTER TABLE public.smartzap_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smartzap_sessions ENABLE ROW LEVEL SECURITY;
