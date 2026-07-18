# Pesquisa por Zona + Investidor com Campos de Venda — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pesquisar contactos por zona na barra global (Cmd+K) e na página de Contactos; investidores ganham os campos estruturados de venda (com rótulo "O que oferece").

**Architecture:** Zero alterações à base de dados. As zonas já vivem em `people.details` (jsonb: `search_zone`/`selling_zone`/`working_zone`); estende-se o `.or()` da API, o filtro client-side da lista de Contactos e o CommandPalette. Os campos de venda do investidor são os mesmos do vendedor, só muda a condição de visibilidade e um rótulo.

**Tech Stack:** Next.js 16 (App Router), React 19, Supabase JS (PostgREST `.or()` com `details->>coluna.ilike`). **Sem framework de testes** — verificação é `npx tsc --noEmit` + preview manual. Branch: `claude/pesquisa-zona-investidor` (empilhado sobre o PR #10).

**Spec:** `docs/superpowers/specs/2026-07-18-pesquisa-zona-investidor-design.md`

---

## Mapa de ficheiros

| Ficheiro | Ação | Responsabilidade |
|---|---|---|
| `components/contacts/ContactDetailPanel.tsx` | Modificar | Bloco de venda visível para investidor; rótulo condicional |
| `components/contacts/NewContactModal.tsx` | Modificar | Idem no formulário de criação |
| `app/api/people/route.ts` | Modificar | `?search=` inclui address + zonas do jsonb |
| `app/(app)/people/page.tsx` | Modificar | Filtro client-side inclui address + zonas |
| `components/CommandPalette.tsx` | Modificar | Secção "Contactos" na pesquisa global |

---

### Task 1: Investidor mostra os campos de venda

**Files:**
- Modify: `components/contacts/ContactDetailPanel.tsx`
- Modify: `components/contacts/NewContactModal.tsx`

- [ ] **Step 1: `ContactDetailPanel` — condição e rótulo**

Ler o ficheiro primeiro. Localizar (perto das outras derivações `showBuyer`/`showConsultant`/`showService`, depois do early return):

```tsx
  const showSeller = activeTypes.includes('vendedor')
```

Substituir por:

```tsx
  // Investidores também podem vender: mostram o bloco de venda. Sem o tipo
  // "vendedor", o campo principal chama-se "O que oferece".
  const showSeller = activeTypes.includes('vendedor') || activeTypes.includes('investidor')
  const sellingLabel = activeTypes.includes('vendedor') ? 'O que vende' : 'O que oferece'
```

E no bloco `{showSeller && (...)}` da secção "Detalhes", trocar o primeiro campo:

```tsx
                      {field('O que vende', fieldValue(d.selling_property), <input className="input" value={d.selling_property ?? ''} onChange={e => setDetail('selling_property', e.target.value)} />)}
```

por:

```tsx
                      {field(sellingLabel, fieldValue(d.selling_property), <input className="input" value={d.selling_property ?? ''} onChange={e => setDetail('selling_property', e.target.value)} />)}
```

Os restantes campos do bloco (Onde vende, Preço, Tipologia, Garagem, Varanda, Exclusividade, Vendedor ativo) ficam como estão — o bloco renderiza uma única vez mesmo com ambos os tipos, porque é um único `{showSeller && ...}`.

- [ ] **Step 2: `NewContactModal` — mesma regra no formulário**

Localizar (linha ~222):

```tsx
          {has('vendedor') && (
```

Substituir por:

```tsx
          {(has('vendedor') || has('investidor')) && (
```

E o placeholder do primeiro input do bloco "Venda" (linha ~225):

```tsx
              <input className="input" placeholder="O que vende" value={details.selling_property ?? ''} onChange={e => d('selling_property', e.target.value)} />
```

por:

```tsx
              <input className="input" placeholder={has('vendedor') ? 'O que vende' : 'O que oferece'} value={details.selling_property ?? ''} onChange={e => d('selling_property', e.target.value)} />
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add components/contacts/ContactDetailPanel.tsx components/contacts/NewContactModal.tsx
git commit -m "feat: investidor mostra campos de venda (O que oferece)"
```

---

### Task 2: Pesquisa por zona — API + página de Contactos

**Files:**
- Modify: `app/api/people/route.ts`
- Modify: `app/(app)/people/page.tsx`

- [ ] **Step 1: API — `.or()` com address e zonas do jsonb**

No GET de `app/api/people/route.ts`, substituir:

```ts
  if (search) {
    const term = search.replace(/[%_\\]/g, '\\$&')
    query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`)
  }
```

por:

```ts
  if (search) {
    const term = search.replace(/[%_\\]/g, '\\$&')
    // Inclui morada e as zonas do perfil (jsonb details) — permite pesquisar
    // por zona ("Parede", "Cascais") além de nome/email/telefone.
    query = query.or(
      `name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,address.ilike.%${term}%,` +
      `details->>search_zone.ilike.%${term}%,details->>selling_zone.ilike.%${term}%,details->>working_zone.ilike.%${term}%`
    )
  }
```

Nota PostgREST: `details->>search_zone.ilike.%term%` é sintaxe válida dentro de `.or()` (operador `->>` extrai texto do jsonb). Se o preview devolver erro 400 do PostgREST nesta query, reportar em vez de improvisar outra sintaxe.

- [ ] **Step 2: Página de Contactos — filtro client-side**

Em `app/(app)/people/page.tsx` (a página carrega `/api/people` sem `?search=` e filtra localmente), substituir no `useMemo`:

```tsx
    if (q) {
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.phone ?? '').toLowerCase().includes(q) ||
        (p.email ?? '').toLowerCase().includes(q)
      )
    }
```

por:

```tsx
    if (q) {
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.phone ?? '').toLowerCase().includes(q) ||
        (p.email ?? '').toLowerCase().includes(q) ||
        (p.address ?? '').toLowerCase().includes(q) ||
        (p.details?.search_zone ?? '').toLowerCase().includes(q) ||
        (p.details?.selling_zone ?? '').toLowerCase().includes(q) ||
        (p.details?.working_zone ?? '').toLowerCase().includes(q)
      )
    }
```

Atualizar também o placeholder do input de pesquisa dessa página (procurar o `<input`/`value={search}`): se o texto atual não mencionar zona, mudar para `"Pesquisar por nome, telefone, zona…"`.

- [ ] **Step 3: Type-check e commit**

```bash
npx tsc --noEmit
git add app/api/people/route.ts "app/(app)/people/page.tsx"
git commit -m "feat: pesquisa de contactos por zona e morada"
```

---

### Task 3: CommandPalette — secção "Contactos"

**Files:**
- Modify: `components/CommandPalette.tsx`

- [ ] **Step 1: Tipo, estado e fetch em paralelo**

Junto a `type LeadHit` acrescentar:

```tsx
type PersonHit = {
  id: string
  name: string
  phone: string | null
  email: string | null
  address?: string | null
  details?: { search_zone?: string; selling_zone?: string; working_zone?: string }
}

// Linha secundária do resultado: zona do perfil, senão morada/telefone/email
function personHint(p: PersonHit) {
  return p.details?.search_zone || p.details?.selling_zone || p.details?.working_zone || p.address || p.phone || p.email || ''
}
```

Estado, junto a `leads`:

```tsx
  const [people, setPeople] = useState<PersonHit[]>([])
```

No reset ao abrir (`useEffect` do `open`), acrescentar `setPeople([])` junto a `setLeads([])`.

Substituir o efeito de pesquisa inteiro por:

```tsx
  // Pesquisa de leads + contactos (debounce). Contactos incluem zona/morada
  // do lado da API (details->>*_zone).
  useEffect(() => {
    if (!open || query.trim().length < 2) { setLeads([]); setPeople([]); return }
    const t = setTimeout(async () => {
      try {
        const [lr, pr] = await Promise.all([
          fetch(`/api/leads?search=${encodeURIComponent(query)}`),
          fetch(`/api/people?search=${encodeURIComponent(query)}`),
        ])
        const ldata = lr.ok ? await lr.json() : []
        const pdata = pr.ok ? await pr.json() : []
        setLeads((Array.isArray(ldata) ? ldata : []).slice(0, 6).map((l: LeadHit) => ({ id: l.id, name: l.name, phone: l.phone, email: l.email })))
        setPeople((Array.isArray(pdata) ? pdata : []).slice(0, 5))
      } catch { setLeads([]); setPeople([]) }
    }, 220)
    return () => clearTimeout(t)
  }, [query, open])
```

- [ ] **Step 2: Rows, navegação e render**

Alterar o tipo `Row` e a lista:

```tsx
  type Row = { type: 'nav'; item: NavItem } | { type: 'lead'; item: LeadHit } | { type: 'person'; item: PersonHit }
  const rows: Row[] = [
    ...filteredNav.map(item => ({ type: 'nav' as const, item })),
    ...leads.map(item => ({ type: 'lead' as const, item })),
    ...people.map(item => ({ type: 'person' as const, item })),
  ]
```

No `go()`:

```tsx
  const go = useCallback((row: Row) => {
    setOpen(false)
    if (row.type === 'nav') router.push(row.item.href)
    else if (row.type === 'lead') router.push(`/leads/${row.item.id}`)
    else router.push(`/people/${row.item.id}`)
  }, [router])
```

No reset do índice ativo, acrescentar `people.length`:

```tsx
  useEffect(() => { setActive(0) }, [query, leads.length, people.length])
```

No render do `rows.map`, o ramo dos leads mantém-se; acrescentar ANTES do `return` dos leads um ramo para `person` (estrutura idêntica à dos leads — cabeçalho de secção quando o anterior não é person):

```tsx
            if (row.type === 'person') {
              const prev = rows[i - 1]
              const showHeader = !prev || prev.type !== 'person'
              return (
                <div key={'p' + row.item.id}>
                  {showHeader && <div className="cmdk-section">Contactos</div>}
                  <button className={`cmdk-row${isActive ? ' active' : ''}`}
                    onMouseEnter={() => setActive(i)} onClick={() => go(row)}>
                    <Icon name="people" size={15} style={{ flexShrink: 0, opacity: 0.7 }} />
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.item.name}</span>
                    <span className="cmdk-hint">{personHint(row.item)}</span>
                  </button>
                </div>
              )
            }
```

(Confirmar que `'people'` existe como `IconName` — é usado no `NAV` para a página Contactos, por isso existe.)

Atualizar o placeholder do input:

```tsx
            placeholder="Pesquisar páginas, leads, contactos, zonas…"
```

- [ ] **Step 3: Type-check e commit**

```bash
npx tsc --noEmit
git add components/CommandPalette.tsx
git commit -m "feat: contactos (com zonas) na pesquisa global Cmd+K"
```

---

### Task 4: Verificação final

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: sem erros. (O worktree já tem `.env.local`; se faltar, copiar de `/Users/tomassampaio/Desktop/ImoFlow/.env.local`.)

- [ ] **Step 2: Preview**

Com o dev server (`.claude/launch.json` → `imoflow-dev`, sessão já autenticada):
1. Cmd+K → escrever uma zona real (ex: "Parede"): secção "Contactos" aparece com contactos dessa zona; Enter navega para `/people/{id}`. (Verificável também por `fetch('/api/people?search=Parede')` — deve devolver contactos cujo details tem essa zona.)
2. Página `/people`: pesquisar a mesma zona na caixa de pesquisa filtra a lista.
3. Ficha de um contacto só investidor: bloco de venda visível com rótulo "O que oferece"; contacto vendedor(+investidor): "O que vende", bloco único.
4. Modal "+ Novo Contacto": selecionar tipo Investidor mostra o bloco "Venda" com placeholder "O que oferece".
5. Consola sem erros novos.

**Atenção:** dados reais da agência — não criar/apagar contactos reais; para o ponto 4 basta abrir o modal e ver os campos, sem submeter.

- [ ] **Step 3: Commit final (só se a verificação obrigar a correções)**

```bash
git add -A && git commit -m "fix: ajustes da verificação (pesquisa por zona/investidor)"
```
