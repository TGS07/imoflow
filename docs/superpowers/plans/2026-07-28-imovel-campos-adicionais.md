# Campos adicionais de imóvel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar cinco campos opcionais ao imóvel — área útil (m²), ano de construção, certificado energético, lugares de garagem e elevador — à tabela `properties`, ao tipo `Property`, e aos formulários de criação e edição de imóvel (incluindo a vista de leitura da ficha).

**Architecture:** Cinco colunas novas em `properties` (todas opcionais, sem check constraint). O `PATCH /api/properties/[id]` e o `POST /api/properties` são passthrough (`insert({...body, agency_id})` / `update(body)`), por isso aceitam os campos novos sem alterações às rotas. Todo o trabalho é migração + tipo TS + estado de formulário + JSX numa nova secção "Detalhes adicionais" em cada um dos dois formulários (criação e edição/leitura).

**Tech Stack:** Next.js 16, React 19, Supabase. **Sem framework de testes** — verificação é `npx tsc --noEmit` + `npm run build` + preview manual.

**Spec:** `docs/superpowers/specs/2026-07-28-imovel-campos-adicionais-design.md`

---

## Mapa de ficheiros

| Ficheiro | Ação | Responsabilidade |
|---|---|---|
| `supabase/migrations/20260728_property_additional_fields.sql` | Criar | 5 colunas novas em `properties` |
| `types/index.ts` | Modificar | 5 campos novos no tipo `Property` |
| `app/(app)/properties/page.tsx` | Modificar | Formulário de criação: `ENERGY_CERTIFICATES`, `emptyForm`, `createProperty`, nova secção JSX "Detalhes adicionais" |
| `app/(app)/properties/[id]/page.tsx` | Modificar | Formulário de edição/leitura: `ENERGY_CERTIFICATES`, estado `form`, `fetchProperty`, `save`, nova secção JSX "Detalhes adicionais" (leitura + edição) |

Nenhum outro ficheiro precisa de alterações — confirmado por investigação direta do código (ver "Factos do código" abaixo).

## Factos do código (verificados nesta sessão — não re-descobrir)

- **Migrações:** a mais recente é `supabase/migrations/20260728_calendar_sync.sql` (10:46) seguida de `20260728221500_notifications_type_automation_rule.sql` (13:04). O ficheiro mais recente que toca `properties` é `20260724222400_properties_idealista_url.sql`, que usa `ALTER TABLE public.properties ADD COLUMN idealista_url TEXT;` (maiúsculas). A tabela original (`20260530_properties.sql`) foi criada com `area_m2 numeric` — confirma que `numeric` é o tipo já usado para área nesta tabela. Nome de ficheiro escolhido para esta migração: `20260728_property_additional_fields.sql` (mesma convenção — sem timestamp de hora — do último ficheiro do dia, `20260728_calendar_sync.sql`; ordena-se depois de todos os ficheiros existentes por ordenação alfabética de nome de ficheiro).
- **Tipo `Property`** vive em `types/index.ts`, linhas 110–139. `condition: PropertyCondition | null` está na linha 123, `address: string | null` na linha 124 — os 5 campos novos entram entre estas duas linhas, agrupados com os outros campos de "detalhe físico" do imóvel (bedrooms/bathrooms/floor/condition).
- **`app/(app)/properties/page.tsx` (criação):** `emptyForm` está nas linhas 49–55; `createProperty` (POST) nas linhas 100–136, corpo do pedido nas linhas 107–128; a secção "Detalhes" (sem cabeçalho visível — inclui type/status/typology/reference/price/area/bedrooms/bathrooms/floor/condition) termina no `<select>` de Condição (linhas 187–190); a seguir vem o cabeçalho visível `Localização` (linha 192). O padrão de cabeçalho de secção usado é:
  ```tsx
  <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: 4 }}>Localização</div>
  ```
  Inputs numéricos usam `<input type="number" className="input" placeholder="..." value={...} onChange={...} />` dentro de `<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>`. O `<select>` de Condição é o molde a seguir para o `<select>` de Certificado energético (opção vazia `<option value="">Condição —</option>` seguida do map da lista).
- **`app/(app)/properties/[id]/page.tsx` (edição/leitura):** **não existe um helper `field(...)`** nesta página (ao contrário de `ContactDetailPanel.tsx`) — cada campo é escrito inline com `{editing ? <input .../> : <div>...</div>}`. O estado `form` é inicializado nas linhas 68–73; `fetchProperty` popula `form` a partir da resposta da API nas linhas 75–92; `save()` (PATCH) constrói o corpo do pedido nas linhas 96–124. O primeiro cartão (`background: var(--card)`, linhas 202–261) tem uma grid de 2 colunas (linhas 221–260) com Referência/Tipo/Status/Condição (só em edição) e Preço/Área/Tipologia/Quartos/Casas de Banho/Andar (sempre visíveis, alternando input↔valor). `inputStyle` e `labelStyle` são constantes locais (linhas 160–161) reutilizadas em todos os campos — os campos novos devem usar as mesmas.
- **Checkbox boolean com o mesmo padrão visual:** `components/contacts/ContactDetailPanel.tsx` linhas 356–364, helper `boolField`, usa:
  ```tsx
  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-base)', color: 'var(--text)', cursor: 'pointer' }}>
    <input type="checkbox" checked={!!d[key]} onChange={e => setDetail(key, e.target.checked)} />
    {yesNo(d[key])}
  </label>
  ```
  Este é o molde a seguir para "Elevador" (checkbox + texto "Sim"/"Não" ao lado, dentro de um `<label>` clicável), adaptado ao `fontSize: 13` já usado nesta página (não existe `var(--fs-base)` em `properties/[id]/page.tsx`).
- **`POST /api/properties`** (`app/api/properties/route.ts`, linhas 40–62) faz `insert({ ...body, agency_id })` — sem allowlist. **`PATCH /api/properties/[id]`** (`app/api/properties/[id]/route.ts`, linhas 26–42) faz `update(body)` — sem allowlist. Nenhuma das duas rotas precisa de alterações.
- **Sem framework de testes:** `package.json` só tem `dev`/`build`/`start`/`lint`; não existem ficheiros `*.test.*`/`*.spec.*` nem config de Jest/Vitest/Playwright no projeto. Verificação é `npx tsc --noEmit` + `npm run build` + preview manual, confirmado nesta sessão.
- **Fora de âmbito confirmado:** `lib/pipeline/card-fields.ts`, `app/api/leads/[id]/route.ts`, rota de listagem de leads, e `lib/ai/prompts.ts` não são tocados (conforme a spec).

---

### Task 1: Migração da base de dados

**Files:**
- Create: `supabase/migrations/20260728_property_additional_fields.sql`

- [ ] **Step 1: Escrever o ficheiro de migração**

```sql
-- Campos adicionais de imóvel para refletir informação típica de anúncios
-- (ex.: Idealista): área útil, ano de construção, certificado energético,
-- lugares de garagem e elevador. Todos opcionais; nenhum dado existente é
-- afetado. `energy_certificate` é texto livre (sem check constraint) — o
-- formulário oferece um <select> com os valores padrão em Portugal, mas a
-- coluna não impõe essa lista.
alter table public.properties
  add column area_util_m2 numeric,
  add column construction_year integer,
  add column energy_certificate text,
  add column parking_spaces integer,
  add column has_elevator boolean;
```

- [ ] **Step 2: Aplicar a migração** (via MCP Supabase, `apply_migration`, nome `property_additional_fields`, SQL acima). Confirmar com `execute_sql`:

```sql
select column_name, data_type
from information_schema.columns
where table_name = 'properties'
  and column_name in ('area_util_m2', 'construction_year', 'energy_certificate', 'parking_spaces', 'has_elevator')
order by column_name;
```

Esperado: 5 linhas — `area_util_m2` (numeric), `construction_year` (integer), `energy_certificate` (text), `has_elevator` (boolean), `parking_spaces` (integer).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260728_property_additional_fields.sql
git commit -m "feat: adiciona campos de área útil, ano, certificado energético, garagem e elevador a properties"
```

---

### Task 2: Tipo TypeScript `Property`

**Files:**
- Modify: `types/index.ts:123-124`

- [ ] **Step 1: Adicionar os 5 campos ao tipo `Property`**

Em `types/index.ts`, entre `condition: PropertyCondition | null` (linha 123) e `address: string | null` (linha 124), inserir:

```ts
  condition: PropertyCondition | null
  area_util_m2: number | null
  construction_year: number | null
  energy_certificate: string | null
  parking_spaces: number | null
  has_elevator: boolean | null
  address: string | null
```

(Substituir apenas as duas linhas `condition: ...` / `address: ...` já existentes pelo bloco acima — as restantes linhas do tipo `Property` não mudam.)

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Esperado: sem erros novos relacionados com `Property` (os dois formulários ainda não usam os campos novos nesta task, por isso não deve haver erros de "missing property" — TypeScript não obriga objetos `Insert`/`PATCH` a incluir todos os campos do tipo).

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat: adiciona os 5 campos novos ao tipo Property"
```

---

### Task 3: Formulário de criação (`app/(app)/properties/page.tsx`)

**Files:**
- Modify: `app/(app)/properties/page.tsx`

- [ ] **Step 1: Constante `ENERGY_CERTIFICATES`**

Depois da constante `CONDITIONS` (linhas 28–33), antes de `STATUS_COLORS` (linha 35), inserir:

```ts
const ENERGY_CERTIFICATES: { value: string; label: string }[] = [
  { value: 'A+', label: 'A+' },
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'B-', label: 'B-' },
  { value: 'C', label: 'C' },
  { value: 'D', label: 'D' },
  { value: 'E', label: 'E' },
  { value: 'F', label: 'F' },
  { value: 'Isento', label: 'Isento' },
]
```

- [ ] **Step 2: `emptyForm` — adicionar os 5 campos**

Em `emptyForm` (linhas 49–55), a linha:

```ts
    condition: '' as PropertyCondition | '', reference: '',
```

passa a:

```ts
    condition: '' as PropertyCondition | '', reference: '',
    area_util_m2: '', construction_year: '', energy_certificate: '', parking_spaces: '', has_elevator: false,
```

- [ ] **Step 3: `createProperty` — incluir os 5 campos no corpo do pedido**

Em `createProperty` (linhas 100–136), a linha:

```ts
          condition: form.condition || null,
```

passa a:

```ts
          condition: form.condition || null,
          area_util_m2: form.area_util_m2 ? Number(form.area_util_m2) : null,
          construction_year: form.construction_year ? Number(form.construction_year) : null,
          energy_certificate: form.energy_certificate || null,
          parking_spaces: form.parking_spaces ? Number(form.parking_spaces) : null,
          has_elevator: form.has_elevator,
```

- [ ] **Step 4: JSX — nova secção "Detalhes adicionais"**

Entre o `<select>` de Condição e o cabeçalho "Localização" (linhas 187–192), o bloco:

```tsx
              <select className="input" value={form.condition} onChange={e => setForm(p => ({ ...p, condition: e.target.value as PropertyCondition | '' }))}>
                <option value="">Condição —</option>
                {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>

              <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: 4 }}>Localização</div>
```

passa a:

```tsx
              <select className="input" value={form.condition} onChange={e => setForm(p => ({ ...p, condition: e.target.value as PropertyCondition | '' }))}>
                <option value="">Condição —</option>
                {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>

              <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: 4 }}>Detalhes adicionais</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <input type="number" className="input" placeholder="Área útil (m²)" value={form.area_util_m2} onChange={e => setForm(p => ({ ...p, area_util_m2: e.target.value }))} />
                <input type="number" className="input" placeholder="Ano de construção" value={form.construction_year} onChange={e => setForm(p => ({ ...p, construction_year: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <select className="input" value={form.energy_certificate} onChange={e => setForm(p => ({ ...p, energy_certificate: e.target.value }))}>
                  <option value="">Certificado energético —</option>
                  {ENERGY_CERTIFICATES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <input type="number" className="input" placeholder="Lugares de garagem" value={form.parking_spaces} onChange={e => setForm(p => ({ ...p, parking_spaces: e.target.value }))} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.has_elevator} onChange={e => setForm(p => ({ ...p, has_elevator: e.target.checked }))} />
                Tem elevador
              </label>

              <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: 4 }}>Localização</div>
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/properties/page.tsx"
git commit -m "feat: secção Detalhes adicionais no formulário de criação de imóvel"
```

---

### Task 4: Formulário de edição/leitura (`app/(app)/properties/[id]/page.tsx`)

**Files:**
- Modify: `app/(app)/properties/[id]/page.tsx`

- [ ] **Step 1: Constante `ENERGY_CERTIFICATES`**

Depois da constante `CONDITIONS` (linhas 32–37), antes de `STATUS_COLORS` (linha 39), inserir a mesma constante da Task 3:

```ts
const ENERGY_CERTIFICATES: { value: string; label: string }[] = [
  { value: 'A+', label: 'A+' },
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'B-', label: 'B-' },
  { value: 'C', label: 'C' },
  { value: 'D', label: 'D' },
  { value: 'E', label: 'E' },
  { value: 'F', label: 'F' },
  { value: 'Isento', label: 'Isento' },
]
```

- [ ] **Step 2: Estado `form` — adicionar os 5 campos**

Em `useState` do `form` (linhas 68–73), a linha final:

```ts
    description: '', notes: '', features: '', photos: '', idealista_url: ''
  })
```

passa a:

```ts
    description: '', notes: '', features: '', photos: '', idealista_url: '',
    area_util_m2: '', construction_year: '', energy_certificate: '', parking_spaces: '', has_elevator: false,
  })
```

- [ ] **Step 3: `fetchProperty` — popular os 5 campos**

Em `fetchProperty` (linhas 75–92), a linha final do `setForm`:

```ts
      idealista_url: data.idealista_url ?? '',
    })
```

passa a:

```ts
      idealista_url: data.idealista_url ?? '',
      area_util_m2: data.area_util_m2?.toString() ?? '',
      construction_year: data.construction_year?.toString() ?? '',
      energy_certificate: data.energy_certificate ?? '',
      parking_spaces: data.parking_spaces?.toString() ?? '',
      has_elevator: data.has_elevator ?? false,
    })
```

- [ ] **Step 4: `save()` — incluir os 5 campos no corpo do PATCH**

Em `save()` (linhas 96–124), a linha:

```ts
        idealista_url: form.idealista_url || null,
```

passa a:

```ts
        idealista_url: form.idealista_url || null,
        area_util_m2: form.area_util_m2 ? Number(form.area_util_m2) : null,
        construction_year: form.construction_year ? Number(form.construction_year) : null,
        energy_certificate: form.energy_certificate || null,
        parking_spaces: form.parking_spaces ? Number(form.parking_spaces) : null,
        has_elevator: form.has_elevator,
```

- [ ] **Step 5: JSX — nova secção "Detalhes adicionais" (leitura + edição)**

No primeiro cartão (`background: var(--card)`, linhas 202–261), o bloco final da grid de 2 colunas (campo "Andar" e fecho da grid, linhas 256–261):

```tsx
              <div>
                <div style={labelStyle}>Andar</div>
                {editing ? <input style={inputStyle} value={form.floor} onChange={e => setForm(p => ({ ...p, floor: e.target.value }))} /> : <div style={{ fontSize: 13, color: property.floor ? 'var(--text)' : 'var(--muted)' }}>{property.floor ?? '—'}</div>}
              </div>
            </div>
          </div>
```

passa a:

```tsx
              <div>
                <div style={labelStyle}>Andar</div>
                {editing ? <input style={inputStyle} value={form.floor} onChange={e => setForm(p => ({ ...p, floor: e.target.value }))} /> : <div style={{ fontSize: 13, color: property.floor ? 'var(--text)' : 'var(--muted)' }}>{property.floor ?? '—'}</div>}
              </div>
            </div>

            <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: 16, marginBottom: 8 }}>Detalhes adicionais</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={labelStyle}>Área útil</div>
                {editing ? <input type="number" style={inputStyle} value={form.area_util_m2} onChange={e => setForm(p => ({ ...p, area_util_m2: e.target.value }))} /> : <div style={{ fontSize: 13, color: property.area_util_m2 != null ? 'var(--text)' : 'var(--muted)' }}>{property.area_util_m2 != null ? `${property.area_util_m2} m²` : '—'}</div>}
              </div>
              <div>
                <div style={labelStyle}>Ano de construção</div>
                {editing ? <input type="number" style={inputStyle} value={form.construction_year} onChange={e => setForm(p => ({ ...p, construction_year: e.target.value }))} /> : <div style={{ fontSize: 13, color: property.construction_year != null ? 'var(--text)' : 'var(--muted)' }}>{property.construction_year ?? '—'}</div>}
              </div>
              <div>
                <div style={labelStyle}>Certificado energético</div>
                {editing ? (
                  <select style={inputStyle} value={form.energy_certificate} onChange={e => setForm(p => ({ ...p, energy_certificate: e.target.value }))}>
                    <option value="">—</option>
                    {ENERGY_CERTIFICATES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                ) : <div style={{ fontSize: 13, color: property.energy_certificate ? 'var(--text)' : 'var(--muted)' }}>{property.energy_certificate ?? '—'}</div>}
              </div>
              <div>
                <div style={labelStyle}>Lugares de garagem</div>
                {editing ? <input type="number" style={inputStyle} value={form.parking_spaces} onChange={e => setForm(p => ({ ...p, parking_spaces: e.target.value }))} /> : <div style={{ fontSize: 13, color: property.parking_spaces != null ? 'var(--text)' : 'var(--muted)' }}>{property.parking_spaces ?? '—'}</div>}
              </div>
              <div>
                <div style={labelStyle}>Elevador</div>
                {editing ? (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.has_elevator} onChange={e => setForm(p => ({ ...p, has_elevator: e.target.checked }))} />
                    {form.has_elevator ? 'Sim' : 'Não'}
                  </label>
                ) : <div style={{ fontSize: 13, color: property.has_elevator == null ? 'var(--muted)' : 'var(--text)' }}>{property.has_elevator == null ? '—' : property.has_elevator ? 'Sim' : 'Não'}</div>}
              </div>
            </div>
          </div>
```

(Nota: o fecho `</div>` a mais no final corresponde ao fecho do cartão `background: var(--card)` que já existia — a grid nova fica dentro do mesmo cartão, como a grid original.)

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 7: Commit**

```bash
git add "app/(app)/properties/[id]/page.tsx"
git commit -m "feat: secção Detalhes adicionais na ficha do imóvel (leitura e edição)"
```

---

### Task 5: Build e verificação manual final

- [ ] **Step 1: Build**

```bash
npm run build
```

Esperado: build sem erros.

- [ ] **Step 2: Preview manual — criação com os 5 campos preenchidos**

1. Abrir `/properties`, "+ Novo Imóvel".
2. Preencher título, tipo, preço, área e os 5 campos novos: Área útil (ex. `85`), Ano de construção (ex. `2015`), Certificado energético (escolher `B`), Lugares de garagem (ex. `1`), marcar "Tem elevador".
3. Criar. Abrir o imóvel criado (`/properties/[id]`) e confirmar que os 5 valores aparecem corretamente na vista de leitura ("Detalhes adicionais": `85 m²`, `2015`, `B`, `1`, `Sim`).

- [ ] **Step 3: Preview manual — criação sem os 5 campos**

1. Criar um segundo imóvel sem preencher nenhum dos 5 campos novos (deixar "Tem elevador" desmarcado).
2. Confirmar que a ficha mostra "—" para Área útil, Ano de construção, Certificado energético, Lugares de garagem, e "Não" para Elevador (não erro/crash).

- [ ] **Step 4: Preview manual — edição de imóvel existente (criado antes desta funcionalidade)**

1. Abrir um imóvel já existente antes desta alteração (`area_util_m2`/`construction_year`/etc. devem estar `null` na BD).
2. Confirmar que a vista de leitura mostra "—"/"Não" para os 5 campos sem erro.
3. Entrar em modo de edição, preencher os 5 campos, Guardar.
4. Confirmar que os valores gravam e aparecem na vista de leitura, e que os restantes campos do imóvel (título, preço, morada, etc.) não foram afetados.

- [ ] **Step 5: Preview manual — regressão de `area_m2`**

1. Confirmar que o campo "Área" (m²) já existente continua a funcionar como antes na lista de imóveis (`/properties`), na ficha do imóvel, e no detalhe de um lead associado a este imóvel (ex. `/leads/[id]`) — sem alterações de comportamento.

- [ ] **Step 6: Consola do browser sem erros novos** durante os passos acima.

- [ ] **Step 7: Limpar dados de teste** (eliminar os imóveis de teste criados nos Steps 2–3, se aplicável).

---

## Auto-revisão (cobertura da spec)

- Migração com as 5 colunas exatas da spec (`area_util_m2 numeric`, `construction_year integer`, `energy_certificate text`, `parking_spaces integer`, `has_elevator boolean`, sem check constraint) → **Task 1**.
- Tipo `Property` com os 5 campos opcionais/nuláveis → **Task 2**.
- Secção "Detalhes adicionais" no formulário de criação, com os 5 inputs (incluindo `<select>` de certificado energético e checkbox de elevador) → **Task 3**.
- Secção "Detalhes adicionais" na ficha do imóvel, tanto em leitura como em edição → **Task 4**.
- Nenhuma alteração às rotas `POST`/`PATCH` de properties (confirmado que já são passthrough) → nenhuma task toca `app/api/properties/**`.
- Nenhuma alteração a `lib/pipeline/card-fields.ts`, `app/api/leads/[id]/route.ts`, rota de listagem de leads, ou `lib/ai/prompts.ts` → confirmado como fora de âmbito, nenhuma task toca estes ficheiros.
- Os 5 testes da secção "Testes" da spec → cobertos nos Steps 2–5 da Task 5.
