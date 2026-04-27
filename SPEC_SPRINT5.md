# Especificação — Sprint 5: Contexto do Agente + Redesign UI

## Contexto
SmartZAP é um SaaS B2B de disparo em massa via WhatsApp (Evolution API + Meta Cloud API).
Stack: Next.js 16, TypeScript, Supabase, shadcn/ui, Tailwind CSS.
Todo push vai direto para produção via CI/CD — revisar diff antes de commitar.

---

## FRENTE 1 — Contexto do Agente no Disparo de Campanha

### Problema
Quando um contato responde a uma mensagem de campanha, o agente GPT Maker não sabe o que foi enviado antes. Hoje `registerInGptMaker()` chama `renderTemplateText()` internamente e pode retornar um texto genérico, e o `botMessageDb.create()` salva `"Template X enviado para Y"` em vez do texto real.

### Objetivo
O agente deve receber a mensagem completa e real que foi enviada ao contato, como `role: "assistant"`, para que quando o contato responda, o GPT Maker já tenha contexto de:
```
assistant: "Oi João, temos uma oferta especial para você! 🎁"
user: "Quero saber mais"
```

### Arquivo a modificar
`app/api/campaign/process/route.ts`

### Mudança exata

**Ponto 1 — Evolution API (linha ~386):**
O texto já é renderizado em `const text = await renderTemplateText(...)` antes do envio.
Esse `text` deve ser passado para o bloco async de registro logo abaixo (linha ~440).

**Ponto 2 — `botMessageDb.create` (linha ~450):**
Trocar:
```ts
content: {
  templateName: chosenTemplate,
  text: `Template "${chosenTemplate}" enviado para ${contact.name || contact.phone}`,
},
```
Por:
```ts
content: {
  templateName: chosenTemplate,
  text: renderedText,  // texto real enviado
},
```

**Ponto 3 — `registerInGptMaker` (assinatura):**
Adicionar parâmetro `renderedText?: string`.
Se recebido, usar diretamente em vez de chamar `renderTemplateText` de novo.
Para Meta (sem texto pré-renderizado), mantém o fallback existente de buscar na Meta API.

**Assinatura nova:**
```ts
async function registerInGptMaker(
  phone: string,
  templateName: string,
  contactName: string,
  orgId?: string | null,
  templateVariables: string[],
  renderedText?: string   // <- novo parâmetro
)
```

**Ponto 4 — chamada (linha ~463):**
```ts
await registerInGptMaker(
  contact.phone,
  chosenTemplate,
  contact.name,
  payload.orgId,
  templateVariables,
  isEvolution ? text : undefined  // passa texto pronto só para Evolution
);
```

### Resultado esperado
- GPT Maker recebe `prompt: "Oi João, temos uma oferta especial para você!"` com `role: "assistant"`
- Histórico no Supabase (`bot_messages`) mostra o texto real enviado
- Para Meta API: continua buscando o corpo do template na Meta (já funciona)
- Nenhuma função existente é removida

---

## FRENTE 2 — Redesign Visual (Sprint 5 UI)

### Princípios
- **Zero perda de funcionalidade** — apenas estilo e layout, não lógica
- Paleta de referência: tom escuro/azulado (Image 4 do dashboard atual)
- Sistema de cores via CSS variables para suportar `brand_primary_color` do branding
- Dark/Light mode via `next-themes` (hoje está hardcoded `className="dark"`)

### 2.1 — Sistema de Cores (globals.css + tailwind.config.ts)

Substituir emerald hardcoded por CSS variables dinâmicas:
```css
:root {
  --brand-primary: #10b981;  /* sobrescrito pelo BrandingSettings */
  --bg-base: #0f0f11;
  --bg-raised: #141416;
  --bg-card: #1a1a1d;
  --border: rgba(255,255,255,0.07);
  --border-strong: rgba(255,255,255,0.13);
  --text-1: #f0f0f1;
  --text-2: #8a8a96;
  --text-3: #4e4e5a;
}
[data-theme="light"] { /* tokens light */ }
```

BrandingSettings já permite salvar `brand_primary_color` — aplicar via `style` tag dinâmico no layout.

### 2.2 — Dark/Light Mode

Arquivo: `app/layout.tsx`
- Instalar `next-themes`
- Remover `className="dark"` hardcoded do `<html>`
- Envolver app com `<ThemeProvider attribute="data-theme" defaultTheme="dark">`
- Botão de toggle no `DashboardShell.tsx` (topbar, ícone sol/lua)

### 2.3 — Sidebar (`app/(dashboard)/DashboardShell.tsx`)

**Mudanças:**
- Remover dot pattern do background
- Adicionar seção `SISTEMA` separando os itens de suporte dos itens principais
- `Conversas` e `Workflows` (ocultos) ficam em seção `SISTEMA` com badge `beta` — não são removidos, apenas sinalizados
- `Configurações` desce para o rodapé (abaixo do user card), fora do menu principal
- Manter toda a lógica de `brand_logo_url`, `brand_name`, avatar, role

**Estrutura nova:**
```
[Logo]
[+ Nova Campanha]

MENU
  Dashboard
  Campanhas
  Templates
  Contatos

SISTEMA
  Conversas (beta)
  Workflows (beta)

─────────────────
  Configurações
  [User Card]
```

### 2.4 — Wizard de Campanha (`components/features/campaigns/CampaignWizardView.tsx`)

**Mudanças:**
- Footer do wizard: aplicar `position: sticky; bottom: 0` — botão "Continuar" sempre visível
- Toggle `Simular digitando...`: remover o `<Checkbox>` redundante à esquerda — manter apenas o `<Switch>` à direita com label
- Sem alteração na lógica dos 3 steps, validações, modais de bloqueio ou agendamento

### 2.5 — Configurações (`components/features/settings/SettingsView.tsx`)

**Problema:** mistura itens técnicos, comerciais e administrativos em abas horizontais. Subtítulo errado.

**Mudanças:**
- Substituir tabs horizontais por **navegação lateral interna** (sidebar dentro da página)
- Subtítulo: trocar `"Gerencie sua conexão com a WhatsApp Business API"` → `"Gerencie integrações, equipe e preferências da conta."`
- Reagrupar abas existentes sem remover nenhuma:

| Grupo | Itens |
|-------|-------|
| Integrações | Conexão WhatsApp (ex-WhatsApp), Agente IA (ex-AI Settings), Webhooks |
| Conta | Equipe (ex-Usuários), Faturamento (ex-Plano & Faturamento), Aparência (ex-Branding) |
| Sistema | Organizações (só super_admin) |

- Todas as funções existentes dentro de cada aba são preservadas integralmente

### 2.6 — Dashboard (`app/(dashboard)/page.tsx`)

Dashboard atual já existe e funciona. Aplicar apenas:
- Remover dot pattern do background
- Ajustar cores para usar CSS variables (não hardcoded emerald)
- Sem mudança em métricas, gráficos ou tabela de campanhas

### 2.7 — Relatórios

A ser especificado em sprint futura — não existe tela de relatórios hoje.
Candidato a nova página `/reports` com:
- Gráfico de disparos por período (já existe no dashboard, extrair para página própria)
- Filtros por campanha, data, status
- Exportação CSV

---

## Ordem de implementação sugerida

1. `registerInGptMaker` — mudança backend pontual, baixo risco (1 arquivo)
2. Dark/Light mode + CSS variables — base para tudo que vem depois
3. Sidebar reorganizada
4. Wizard sticky footer + toggle fix
5. Settings reorganizada

---

## Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `app/api/campaign/process/route.ts` | Passa `renderedText` para `registerInGptMaker`, atualiza `botMessageDb.create` |
| `app/layout.tsx` | Adiciona `next-themes`, remove `className="dark"` hardcoded |
| `app/globals.css` | CSS variables de cor, suporte `[data-theme="light"]` |
| `tailwind.config.ts` | Mapear tokens para CSS variables |
| `app/(dashboard)/DashboardShell.tsx` | Sidebar reorganizada, toggle de tema |
| `components/features/campaigns/CampaignWizardView.tsx` | Footer sticky, toggle fix |
| `components/features/settings/SettingsView.tsx` | Side nav, reagrupamento de abas, subtítulo |

---

## Garantia de não-regressão

- Toda lógica de campanhas, webhooks, disparo, GPT Maker, Stripe, Clerk permanece intacta
- Nenhum componente é removido — apenas reorganizados visualmente
- Workflows e Conversas continuam no código, apenas sinalizados como `beta`
- Permissões por role (super_admin, manager, user) mantidas nas abas de settings
