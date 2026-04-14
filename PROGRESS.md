### Última atualização
2026-04-14

### Concluído
- Bug fix: card "Falhas" agora inclui números sem WhatsApp (commit ab75ebf)
- Remoção de rastros da Vercel: vercel.json deletado, headers migrados para next.config.ts
- Workflow de staging criado (.github/workflows/staging.yml)
- Servidor AWS configurado: /home/ubuntu/apps/smartzap-staging + docker-compose.yml + .env ajustado
- Nginx staging configurado em dev.smartzap.optivra.digital (aguardando DNS + SSL)
- PROGRESS.md e RELATORIO.md criados

### Em andamento
- Aguardando DNS: adicionar registro A `dev.smartzap` → `52.1.228.224` no painel do domínio
- Após DNS: rodar certbot para SSL do staging

### Próxima etapa
1. DNS + SSL do staging (ação do usuário: adicionar registro A)
2. GitHub branch protection em main (ação do usuário: Settings → Branches)
3. Sprint 1: Forgot password (Supabase resetPasswordForEmail)

### Bloqueios
- DNS de dev.smartzap.optivra.digital precisa ser criado pelo usuário
- Branch protection no GitHub (requer acesso ao painel do repositório)
