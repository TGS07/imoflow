# Alternador de tema claro/escuro

**Data:** 2026-07-30
**Status:** Aprovado para planeamento

## Contexto

O ImoFlow tem hoje um único tema (claro, tons de marfim/linho com dourado como destaque), definido por um único bloco `:root` em `app/globals.css`. Não existe nenhuma infraestrutura de tema escuro, `prefers-color-scheme`, nem `localStorage`/cookie de preferências de UI. Quase toda a estilização de cor usa variáveis CSS (`var(--bg)`, `var(--text)`, etc.) em vez de classes utilitárias — Tailwind está instalado mas não é usado para cor em lado nenhum. Isto torna a introdução de um segundo tema relativamente contida: basta um segundo conjunto de variáveis, ativado por um atributo no `<html>`.

Uma exceção conhecida: o dropdown do `NotificationBell` (`components/layout/NotificationBell.tsx`) já tem cores escuras fixas no código (`#1A1A1E`, `#262629`, etc.), independentes do resto da app — inconsistência pré-existente, corrigida como parte deste trabalho.

Pedido do utilizador: alternador manual claro/escuro, botão junto ao sino de notificações, tema escuro "suave" (sem preto puro, coerente com o dourado atual), preferência guardada por utilizador e válida em qualquer dispositivo.

## Decisão de âmbito

- Alternador **binário** (claro ↔ escuro), sem opção "seguir sistema operativo" — não foi pedido.
- Preferência persistida em **dois sítios**: cookie (para pintar o `<html>` sem "flash" no carregamento) e coluna `theme` na tabela `users` (fonte de verdade entre dispositivos).
- Correção do `NotificationBell` para usar variáveis de tema, incluída (bug pré-existente que bloquearia a coerência do tema escuro).
- Fora de âmbito: opção "sistema", `theme-color` dinâmico do PWA (meta tag da barra de estado do telemóvel), qualquer preferência de tema que não seja claro/escuro.

## Modelo de dados

Nova coluna em `public.users`, seguindo o padrão de `email_notifications` (`supabase/migrations/20260521_notifications.sql`):

```sql
alter table public.users
  add column if not exists theme text not null default 'light' check (theme in ('light', 'dark'));
```

`types/index.ts`, tipo `User`: adicionar `theme: 'light' | 'dark'`.

## Fluxo de leitura (sem flash)

1. **`app/layout.tsx`** (root, server component) lê o cookie `theme` via `cookies()` de `next/headers`. Se existir e for `'light'`/`'dark'`, usa esse valor; caso contrário, `'light'`. Define `<html lang="pt" data-theme={theme} suppressHydrationWarning>`. `suppressHydrationWarning` evita o aviso de mismatch do React caso o valor seja corrigido no cliente (passo 3).
2. **`app/(app)/layout.tsx`** (já busca o perfil do utilizador) estende o `.select('name, avatar_initials, role')` para incluir `theme`, e passa `userTheme={profile?.theme ?? 'light'}` como nova prop a `AppShell`.
3. **Reconciliação no cliente**: um pequeno componente `'use client'` (pode viver dentro do próprio `ThemeToggle`, montado no cabeçalho via `AppShell`) compara, no primeiro render, o `data-theme` já aplicado no `<html>` (vindo do cookie) com a prop `userTheme` (vinda da base de dados). Se forem diferentes — ex.: primeira vez neste dispositivo, sem cookie ainda, ou tema mudado noutro dispositivo — aplica `userTheme`: atualiza `document.documentElement.dataset.theme` e o cookie. Isto só causa um "flash" na primeiríssima vez num dispositivo novo; depois disso, o cookie já está correto e o passo 1 pinta o tema certo de imediato.

## Escrita

Novo ficheiro `app/api/users/me/theme/route.ts`, mesmo padrão de `app/api/users/me/calendar-token/route.ts`:

```ts
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (body.theme !== 'light' && body.theme !== 'dark') {
    return NextResponse.json({ error: 'Tema inválido.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('users')
    .update({ theme: body.theme })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ theme: body.theme })
}
```

## Componente `ThemeToggle`

Novo ficheiro `components/layout/ThemeToggle.tsx`, `'use client'`, recebe `initialTheme: 'light' | 'dark'` como prop (vinda de `AppShell`, que a recebe de `app/(app)/layout.tsx`):

- Estado local inicializado a `initialTheme`.
- `useEffect` no mount: se `document.documentElement.dataset.theme !== initialTheme`, aplica `initialTheme` ao `<html>` e ao cookie (reconciliação do passo 3 acima), e atualiza o estado local.
- Ao clicar: inverte o tema — atualiza `document.documentElement.dataset.theme`, define o cookie (`document.cookie = "theme=${next}; path=/; max-age=31536000; SameSite=Lax"`), atualiza o estado local (para o ícone mudar imediatamente), e dispara `fetch('/api/users/me/theme', { method: 'PATCH', ... })` em segundo plano (não bloqueia a UI; se falhar, o dispositivo atual continua a funcionar corretamente via cookie — só a sincronização entre dispositivos fica desatualizada até a próxima escrita bem-sucedida).
- Ícone: sol quando o tema atual é claro, lua quando é escuro (representa o estado atual, não a ação). Usa o componente `Icon` existente (`components/ui/Icon.tsx`), com dois novos nomes `'sun'` e `'moon'` adicionados ao tipo `IconName` e ao mapa `PATHS`. Estilo do botão: reutiliza a classe `.icon-btn` já existente em `globals.css` (mesma usada por outros ícones do cabeçalho).

## Integração no cabeçalho

`components/layout/AppShell.tsx`: nova prop `userTheme: 'light' | 'dark'` (passada de `app/(app)/layout.tsx`). No `<header>`, `<ThemeToggle initialTheme={userTheme} />` é inserido entre o botão de pesquisa (`.search-trigger`) e `<NotificationBell />`. O botão é só ícone (sem texto), pelo que fica sempre visível em mobile e desktop, sem precisar da classe `.hide-mobile` usada no texto/atalho do botão de pesquisa.

## Paleta escura

Novo bloco em `app/globals.css`, seletor `[data-theme="dark"]`, com o mesmo conjunto de variáveis do `:root` claro, tons quentes escuros (nunca preto puro) e o dourado ligeiramente mais claro para manter contraste:

```css
[data-theme="dark"] {
  --bg: #1E1912;
  --surface: #262019;
  --card: #262019;
  --card-hover: #2E2720;
  --border: #3A3125;
  --border-strong: #4A3F2F;

  --gold: #C9A84C;
  --gold-bright: #E0C171;
  --gold-dim: #8C6B2E;
  --gold-glow: rgba(201,168,76,0.16);

  --text: #F2EDE3;
  --muted: #A69C8A;

  --green: #34D399;
  --red: #F87171;
  --blue: #60A5FA;
  --purple: #A78BFA;
  --whatsapp: #25D366;

  --shadow-sm: 0 1px 3px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.25);
  --shadow-md: 0 4px 14px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.25);
  --shadow-lg: 0 16px 40px rgba(0,0,0,0.5), 0 4px 10px rgba(0,0,0,0.3);
}
```

Adiciona-se também uma transição suave nas propriedades de cor mais visíveis (`body`, `.card`, `.btn`, etc. já têm `transition` em muitos casos via `var(--ease)`; onde não tiverem, uma transição curta em `background-color`/`color`/`border-color` evita uma troca abrupta ao alternar).

## Correção do `NotificationBell`

`components/layout/NotificationBell.tsx`: as cores fixas do dropdown (`#1A1A1E`, `#262629`, `#E8E4DC`, `#7A7870`, `#C9A84C`, badge `#ef4444`) são substituídas pelas variáveis equivalentes (`var(--surface)`, `var(--card-hover)`, `var(--text)`, `var(--muted)`, `var(--gold-bright)`, `var(--red)`), para o dropdown passar a respeitar o tema ativo em vez de ficar sempre escuro.

## Fora de âmbito

- Opção "seguir tema do sistema operativo".
- `theme-color` dinâmico do manifesto PWA / barra de estado do telemóvel.
- Qualquer outra preferência de UI além de claro/escuro (ex.: densidade, tamanho de letra).
- Migração de `email_notifications`/`calendar_token` para o tipo `User` em `types/index.ts` (já em falta hoje, não relacionado com este trabalho — não mexer).

## Testes

- Aplicar a migração → confirmar `theme = 'light'` por omissão em utilizadores existentes.
- Alternar o tema pelo botão → `<html data-theme>` muda instantaneamente, cores de toda a app (incluindo o dropdown de notificações) mudam coerentemente, sem elementos a ficar "presos" no tema antigo.
- Recarregar a página depois de alternar → tema mantém-se (sem flash), graças ao cookie.
- Confirmar na base de dados (`select theme from users where id = ...`) que o `PATCH` gravou o novo valor.
- Limpar cookies do browser (simular dispositivo novo) e recarregar autenticado → tema aplicado deve corresponder ao valor da base de dados (não ao padrão claro), mesmo que com um único flash inicial nesse dispositivo.
- Confirmar que o botão aparece entre o campo de pesquisa e o sino, em ambos os breakpoints (desktop e mobile).
