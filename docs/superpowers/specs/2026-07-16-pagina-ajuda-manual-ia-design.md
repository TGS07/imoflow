# Página de Ajuda: manual da app + chat de IA

**Data:** 2026-07-16 · **Estado:** aprovado pelo utilizador (conversa)

## Contexto

Os consultores precisam de perceber como usar cada parte do ImoFlow sem
formação presencial. Pedido: uma página "manual de instruções" com o
funcionamento de cada página da app, e um chat de IA onde se podem fazer
perguntas sobre a app e como funciona. Cada página da app deve ter um
botão "?" que abre a secção do manual correspondente.

## 1. Conteúdo do manual — `lib/help/manual.ts`

- Ficheiro TypeScript com o manual em português, fonte única de verdade:
  ```ts
  export type HelpSection = {
    key: string        // 'dashboard' | 'leads' | ... (usado no ?page=)
    title: string      // 'Dashboard'
    icon: string       // emoji simples
    purpose: string    // para que serve, 1-2 frases
    blocks: { heading: string; body: string }[]  // elementos + passo-a-passo
  }
  export const HELP_SECTIONS: HelpSection[]
  export function buildHelpManualText(): string  // manual inteiro em texto plano (para o prompt da IA)
  ```
- Uma secção por página: Dashboard, Leads, Pipeline, Contactos,
  Organizações, Imóveis, Atividades, Relatórios, Configurações (pipeline),
  Automações, Formulários, Templates, Agência, Equipa.
- Cobre as funcionalidades recentes: contacto regular + frequência custom,
  contacto especial (datas importantes), associações vendedor/consultor↔imóvel,
  Agenda de hoje, notificações (sino + email).

## 2. Página `/help`

- Nova rota `app/(app)/help/page.tsx` (client component).
- Sidebar ganha entrada "Ajuda" na secção Sistema (ícone `help`; se não
  existir no set de ícones, usar um existente adequado).
- Layout: cabeçalho da página; bloco do chat IA no topo; abaixo, duas
  colunas — índice de secções à esquerda (lista clicável), conteúdo da
  secção selecionada à direita. Em mobile, o índice vira dropdown/chips.
- Suporta `?page=<key>`: abre com essa secção selecionada (via
  `useSearchParams`).

## 3. Chat IA — `POST /api/ai/help`

- Body: `{ question: string, history?: { role: 'user'|'assistant', content: string }[] }`
  (histórico limitado às últimas ~6 mensagens, mantido só em memória no cliente).
- Auth obrigatória (mesmo padrão das outras rotas: `supabase.auth.getUser()`).
- Prompt de sistema: manual completo (`buildHelpManualText()`) + regras:
  responder em português europeu, apenas sobre o ImoFlow, respostas curtas
  e práticas com passos; se a pergunta não for sobre a app, dizer que só
  ajuda com o ImoFlow. Sem JSON — resposta em texto simples.
- Cliente Groq existente (`getAIClient`, `AI_MODEL`), `temperature: 0.3`,
  `max_tokens: 512`, sem streaming (padrão das outras rotas).

## 4. Botão "?" por página — `components/help/HelpButton.tsx`

- Componente pequeno: círculo discreto com "?", `title="Ajuda desta página"`,
  que navega para `/help?page=<key>` (Link).
- Colocado no cabeçalho das páginas principais: dashboard, leads, pipeline,
  people, organizations, properties, activities, reports e páginas de
  settings (pipeline, automations, forms, templates, agency, team).

## Fora do âmbito

- Persistência do histórico de chat na BD.
- Streaming das respostas da IA.
- Pesquisa full-text no manual (o índice + IA cobrem a necessidade).

## Testes / verificação

- `npm run build` sem erros.
- Preview: abrir /help, navegar secções, `?page=leads` abre em Leads,
  botão "?" numa página navega para a secção certa, chat responde a uma
  pergunta sobre a app e recusa uma pergunta fora do tema.
