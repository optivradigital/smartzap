### Última atualização
2026-04-14

### Concluído
- Exploração completa do codebase (53.4K linhas, 80 rotas API)
- Análise estratégica de mercado e concorrentes
- Diagnóstico e correção do bug de relatório de falhas:
  - Card "Falhas" agora soma `failed + invalid` das stats reais da API
  - Subvalue dinâmico mostra breakdown (sem WhatsApp vs bloqueio/erro)
  - CSV export corrigido com rótulo "Sem WhatsApp" para status invalid

### Em andamento
- Planejamento do CI/CD para ambiente AWS + dev/staging

### Próxima etapa
1. Configurar CI/CD: GitHub Actions → AWS (dev + prod), com aprovação de PR para prod
2. Sprint 1: Forgot password (Supabase resetPasswordForEmail)
3. Sprint 2: Signup público + trial 14 dias
4. Sprint 3: Billing Stripe

### Bloqueios
- Precisamos saber como está o servidor AWS atual (EC2? Docker? PM2? Nginx?) para configurar o CI/CD corretamente
