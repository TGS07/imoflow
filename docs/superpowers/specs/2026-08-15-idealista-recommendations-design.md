# Recomendações Idealista no ImoFlow

## Resumo

Migrar a funcionalidade do bot Python (idealista-bot) para dentro do ImoFlow. O bot no Railway é eliminado. O ImoFlow passa a fazer o scan do Gmail, parsing, matching, drafting e apresentação numa página de recomendações com carrossel.

## Arquitetura

### Cron Route — Scan e Matching

**Rota:** `app/api/cron/idealista/route.ts`
**Frequência:** 1 hora (Vercel cron, plano gratuito)

Fluxo:
1. Autenticar no Gmail via OAuth2 refresh token (`googleapis` SDK)
2. Listar emails de `from:naoresponder@idealista.pt` não processados (tabela `idealista_processed_emails`)
3. Para cada email novo:
   a. Extrair HTML → texto legível (preservar links)
   b. Enviar ao LLM (Anthropic SDK, já no projeto) com prompt para devolver JSON de listings
   c. Upsert cada listing na tabela `idealista_listings` (dedup por link)
4. Carregar todas as `lead_preferences` ativas com dados do lead e agente
5. Para cada listing × preferência:
   a. Filtros determinísticos: preço ≤ max, tipologia ≥ min, extras presentes
   b. Se passar, chamar LLM para matching fuzzy de zonas
   c. Se match, chamar LLM para draftar mensagem personalizada em PT
   d. Gravar match em `idealista_matches` com status "pending"
   e. Chamar `createNotification()` para o agente com `link: '/recommendations'`
6. Marcar email como processado

### Página de Recomendações

**Rota:** `app/(app)/recommendations/page.tsx`

- Nova entrada no menu lateral com ícone e badge de pendentes
- Carrossel horizontal — um card por recomendação, navegação por setas/swipe
- Cada card mostra:
  - Título do imóvel, zona, tipologia, preço, m²
  - Nome do lead e razão do match
  - Mensagem rascunhada (editável)
- Três ações por card:
  - **Enviar** → abre `https://wa.me/{telefone}?text={mensagem}` em nova tab, marca como "sent"
  - **Editar** → textarea inline para alterar mensagem, depois enviar
  - **Ignorar** → marca como "ignored", avança para próximo card

### Envio via WhatsApp

Ao clicar "Enviar":
1. Codificar mensagem com `encodeURIComponent()`
2. Abrir `https://wa.me/{telefone_lead}?text={mensagem_codificada}` em `window.open()`
3. Marcar match como "sent" via API call
4. Avançar para próximo card no carrossel

### Notificações

- `createNotification()` chamada para cada novo match
- Tipo: `'automation_rule_triggered'` (ou novo tipo se necessário)
- Link: `/recommendations`
- Agente vê no sino, clica, vai para a página

## Tabelas Supabase (existentes, sem alterações)

- `idealista_processed_emails` — gmail_message_id, listings_count
- `idealista_listings` — titulo, zona, tipologia, preco, m2, extras, link, raw
- `idealista_matches` — listing_id, lead_id, agency_id, user_id, drafted_message, status (pending/edited/sent/ignored)
- `lead_preferences` — lead_id, zonas, tipologia_min, preco_max, extras, is_active

## Variáveis de Ambiente

- `GMAIL_CLIENT_ID` — OAuth client ID
- `GMAIL_CLIENT_SECRET` — OAuth client secret
- `GMAIL_REFRESH_TOKEN` — refresh token da conta de email central
- `GMAIL_QUERY` — (opcional) query de pesquisa, default: `from:naoresponder@idealista.pt`

## Decisões

- **Cron no Vercel** em vez de Railway — elimina subscrição extra
- **WhatsApp via wa.me** — sem API oficial, abre com mensagem pré-preenchida
- **LLM Anthropic** — já configurado no projeto, reutilizar para parser/matching/drafting
- **Sem alterações ao schema** — tabelas do idealista-bot já existem no Supabase
