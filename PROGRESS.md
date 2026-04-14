### Última atualização
2026-04-14

### Concluído
- Bug fix: card "Falhas" inclui números sem WhatsApp — DEPLOYADO (commit ab75ebf)
- Vercel removido por completo (vercel.json deletado, headers em next.config.ts)
- CI/CD staging: develop → dev.smartzap.optivra.digital (porta 3004, SSL ativo)
- CI/CD produção: main → smartzap.optivra.digital (push disparou build agora)
- PROGRESS.md e RELATORIO.md criados e ativos

### Em andamento
- Build CI/CD em execução (push fa4e244 → GitHub Actions → deploy prod)

### Próxima etapa
1. Confirmar branch protection no GitHub (Settings → Branches → main → require PR)
2. Decidir novo nome do produto (renomear de SmartZAP)
3. Sprint 1: Forgot password (Supabase resetPasswordForEmail)

### Bloqueios
- Branch protection: ação manual no GitHub
- Nome do produto: decisão do usuário pendente
