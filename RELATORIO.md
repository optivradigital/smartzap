# RELATÓRIO DE ANDAMENTO — SmartZAP
> Projeto da Optivra | Atualizado em: 2026-04-14

---

## Status Geral
🟡 Em desenvolvimento ativo — produto funcional, em transformação para SaaS

---

## Itens do Roadmap

### 🔴 Bugs / Correções
| # | Item | Status | Commit |
|---|---|---|---|
| B-01 | Card "Falhas" não contava números inválidos (sem WhatsApp) | ✅ Corrigido | ab75ebf |
| B-02 | Subvalue do card Falhas era hardcoded, sem breakdown real | ✅ Corrigido | ab75ebf |
| B-03 | CSV export não traduzia status `invalid` para PT-BR | ✅ Corrigido | ab75ebf |

---

### 🟡 Infraestrutura / CI/CD
| # | Item | Status | Obs |
|---|---|---|---|
| I-01 | Ambiente de dev/staging acessível online | ⏳ Pendente | Servidor AWS — precisa definir stack (EC2, Docker, Nginx) |
| I-02 | GitHub Actions → deploy automático em dev | ⏳ Pendente | Após I-01 |
| I-03 | Aprovação de PR obrigatória para deploy em produção | ⏳ Pendente | GitHub branch protection |

---

### 🟡 Sprint 1 — Auth (Forgot Password)
| # | Item | Status |
|---|---|---|
| A-01 | Endpoint `POST /api/auth/forgot-password` | ⏳ Pendente |
| A-02 | Endpoint `POST /api/auth/reset-password` | ⏳ Pendente |
| A-03 | Página `/auth/reset-password` | ⏳ Pendente |
| A-04 | Link "Esqueci minha senha" na tela de login | ⏳ Pendente |
| A-05 | E-mail de reset (via Resend ou Supabase SMTP) | ⏳ Pendente |

---

### 🔵 Sprint 2 — Self-service Signup
| # | Item | Status |
|---|---|---|
| S-01 | Página pública `/signup` | ⏳ Pendente |
| S-02 | Endpoint `POST /api/auth/signup` | ⏳ Pendente |
| S-03 | Criação automática de organização na conta | ⏳ Pendente |
| S-04 | Campo `trial_ends_at` na tabela `organizations` | ⏳ Pendente |
| S-05 | Bloqueio suave após trial expirado | ⏳ Pendente |

---

### 🔵 Sprint 3 — Billing (Stripe)
| # | Item | Status |
|---|---|---|
| P-01 | Integração Stripe Checkout | ⏳ Pendente |
| P-02 | Webhook: `checkout.session.completed` | ⏳ Pendente |
| P-03 | Webhook: `customer.subscription.deleted` | ⏳ Pendente |
| P-04 | Tabela `subscriptions` no Supabase | ⏳ Pendente |
| P-05 | Aba "Plano & Faturamento" em Settings | ⏳ Pendente |
| P-06 | Adicional de número extra (+ R$97/mês por número) | ⏳ Pendente |

---

### 🔵 Sprint 4 — Design & Onboarding
| # | Item | Status |
|---|---|---|
| D-01 | Landing page pública com pricing | ⏳ Pendente |
| D-02 | Wizard de onboarding pós-cadastro | ⏳ Pendente |
| D-03 | Empty states em todas as telas | ⏳ Pendente |
| D-04 | Melhoria do mobile responsivo | ⏳ Pendente |

---

## Histórico de Commits Relevantes
| Data | Commit | Descrição |
|---|---|---|
| 2026-04-14 | ab75ebf | fix: contagem real de falhas + subvalue dinâmico no relatório de campanha |

---

## Decisões Tomadas
- **Auth**: Manter auth custom + adicionar forgot password via Supabase `resetPasswordForEmail` (não migrar para Clerk agora)
- **Banco**: Manter Supabase (não migrar para PostgreSQL local)
- **Modelo de preços**: Plano único ~R$197/mês + R$97/número adicional
- **Deploy**: AWS (não Vercel) — CI/CD a ser configurado com GitHub Actions

---

## Legenda
✅ Concluído | 🟡 Em andamento | ⏳ Pendente | ❌ Cancelado
