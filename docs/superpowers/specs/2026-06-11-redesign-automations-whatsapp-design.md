# Design: Redesenho visual + Automações de email + WhatsApp

**Data:** 2026-06-11
**Estado:** Aprovado pelo utilizador

## Contexto

O ImoFlow já tem um motor de automações (`lib/automations/engine.ts`) com triggers
(`lead_created`, `stage_changed`, `activity_completed`, `lead_inactive`) e três ações
(`create_activity`, `send_notification`, `move_stage`), templates de email com envio
manual via Resend, e crons (`task-reminders` agendado; `lead-inactive` existe mas **não
está agendado** no `vercel.json`).

Faltam: emails automáticos nas automações, UI para criar/editar regras, qualquer
integração WhatsApp, e o design não tem animações nem consistência (estilos inline
espalhados, ícones emoji).

## Decisões do utilizador

1. **WhatsApp:** ambos — respostas rápidas via `wa.me` já a funcionar + estrutura
   preparada para a WhatsApp Business API (Meta Cloud API) com guia de configuração.
2. **Remetente de email:** cada agência define o seu. Como o Resend exige domínio
   verificado, os emails saem do domínio verificado em nome da agência
   (`From: <nome agência> <noreply@dominio-verificado>`) com `Reply-To` para o email
   da agência. Guia para verificação de domínio próprio incluído.
3. **Design:** redesenho profundo mantendo a identidade (escuro + dourado + Playfair).

## 1. Redesenho visual

- **Sistema de design em `globals.css`:** tokens existentes mantidos/expandidos
  (níveis de superfície, sombras, raios, escala tipográfica) + classes utilitárias
  reutilizáveis: `.card`, `.btn`, `.btn-primary`, `.btn-ghost`, `.input`, `.label`,
  `.badge`, `.skeleton`, `.modal-backdrop`, `.modal`. Substituição progressiva dos
  estilos inline nos componentes principais.
- **Ícones:** componente `components/ui/Icon.tsx` com ícones SVG de linha (stroke
  1.5) para substituir os emojis na sidebar e nas páginas. Sem dependências novas.
- **Animações (CSS puro):**
  - entrada de página/listas com fade+slide e stagger;
  - modais com scale-in + backdrop blur;
  - hover com elevação e borda dourada subtil nos cards;
  - skeletons de loading em vez de texto "A carregar...";
  - transições no kanban (drag) e nos botões (estados hover/active);
  - respeitar `prefers-reduced-motion`.
- **Sidebar renovada:** ícones SVG, indicador ativo, hover states, logotipo com
  gradiente dourado.

## 2. Automações — email automático + construtor de regras

### Nova ação `send_email`

- `AutomationActionType` ganha `send_email`; `action_config` =
  `{ template_id: string }`.
- Novo módulo `lib/email/send.ts` (extraído e partilhado com `/api/emails/send`):
  envia via Resend, regista em `emails_sent` e `contacts`.
- **Variáveis nos templates:** `{{nome}}`, `{{email}}`, `{{agente}}`, `{{agencia}}`
  substituídas com dados da lead/agente no momento do envio (módulo
  `lib/email/variables.ts`, usado também no envio manual).
- O motor (`executeAction`) usa o service client quando corre em contexto de cron
  (sem sessão), e só envia se a lead tiver email.

### Remetente por agência

- Migração: `agencies` ganha `email_from_name text`, `email_reply_to text`.
- Secção em Configurações (admin) para editar.
- Envio: `from` = `"<email_from_name || nome agência> <noreply@dominio>"`,
  `reply_to` = `email_reply_to` quando definido. Domínio de envio em
  `EMAIL_FROM_DOMAIN` (default: `onboarding@resend.dev` em teste).

### Construtor de regras (UI)

- Página de Automações ganha "Nova regra" + editar + apagar (API já suporta POST/
  PATCH/DELETE; falta UI).
- Formulário guiado "Quando … → Então …": seleção de trigger com campos de config
  contextuais (stage destino, dias de inatividade) e ação com config contextual
  (template de email, tipo/título de atividade, mensagem de notificação, stage
  destino).

### Cron em falta

- `vercel.json` ganha `{ "path": "/api/cron/lead-inactive", "schedule": "0 9 * * *" }`.

## 3. WhatsApp

### Templates de mensagem

- Migração: tabela `whatsapp_templates` (id, agency_id, name, body, created_by,
  timestamps) com RLS por agência, espelhando `email_templates`.
- Gestão em Configurações → Templates (separador Email | WhatsApp).
- Suporta as mesmas variáveis `{{nome}}`, `{{agente}}`, `{{agencia}}`.

### Respostas rápidas (já funcionais)

- Botão WhatsApp na página da lead (quando tem telefone): modal para escolher
  template → pré-visualização com variáveis preenchidas → abre
  `https://wa.me/<numero>?text=<mensagem>`; regista contacto do tipo `whatsapp`
  no histórico.
- Normalização de número PT (+351 por omissão quando sem indicativo).

### Business API (preparada, desativada por omissão)

- `app/api/whatsapp/webhook/route.ts`: GET (verificação Meta) + POST (mensagens
  recebidas). Guarda mensagens em `whatsapp_messages` e dispara trigger
  `whatsapp_message_received`.
- Nova ação `send_whatsapp` no motor: envia via Meta Cloud API
  (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`).
  Sem env vars → ação falha com mensagem clara no log; UI mostra aviso
  "não configurado".
- Caso de uso: resposta automática à primeira mensagem / fora de horas.
- Guia `docs/WHATSAPP_SETUP.md`: criar Meta Business, app, número, token, webhook,
  custos e limitações (janela de 24h, templates aprovados).

## Fora de âmbito

- Editor visual drag-and-drop de workflows multi-passo.
- Sequências de email multi-etapa (drip campaigns).
- Sincronização de respostas de email recebidas (inbound email).

## Ordem de implementação

1. Migrações de BD + tipos
2. Motor: ação `send_email`, variáveis, remetente por agência, cron
3. UI: construtor de regras
4. WhatsApp: templates + respostas rápidas + webhook/ação Business API + guia
5. Redesenho visual transversal
6. Verificação com a app a correr
