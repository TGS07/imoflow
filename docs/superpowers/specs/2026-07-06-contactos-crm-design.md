# Contactos — CRM central de contactos (design)

**Data:** 2026-07-06
**Estado:** aprovado (design), pendente plano de implementação
**Entrega:** faseada (4 fases)

## Objetivo

Transformar a atual secção "Pessoas" na base de dados central de **Contactos** do
ImoFlow, tornando-a profissional e segmentada por tipo (Vendedor, Comprador,
Comprador/Investidor, Serviços), com previews ricos, filtros avançados, histórico
de interações, capacidade financeira, notas, e integração com Leads, Imóveis e um
fluxo de criação por áudio.

## Decisões-chave (aprovadas)

1. **Contacto é o centro.** Os Contactos são a base central com todos os campos
   (tipo, capacidade financeira, preferências, notas). Cada lead liga-se a um
   contacto e ao chegar cria/atualiza o contacto.
2. **Histórico próprio no contacto.** Cada contacto tem o seu histórico de
   interações; o "último contacto" e a notificação de vendedor inativo calculam-se
   a partir daqui.
3. **Áudio: transcreve e confirmas.** Grava → Groq Whisper transcreve → IA extrai
   campos → formulário pré-preenchido para o agente confirmar antes de guardar.
4. **Entrega por fases** (um só documento de design, implementação em 4 fases).

## Nota de nomenclatura

A palavra "contacts" já é usada no código para **interações** (tipo `Contact` =
chamada/visita/email/nota, tabela `contacts` ligada a `lead_id`, API
`/api/contacts`). Para não colidir:

- A tabela na BD **mantém o nome `people`**.
- O **rótulo na UI passa a "Contactos"** (sidebar, títulos, breadcrumbs).
- O novo histórico da ficha usa a tabela `contact_interactions` (distinta de
  `contacts`).

## Modelo de dados

### Tabela `people` (novas colunas)

| Coluna | Tipo | Notas |
|---|---|---|
| `types` | `text[]` default `'{}'` | Multi: `comprador`, `vendedor`, `investidor`, `servico`. Um contacto pode ter vários (ex.: vende e compra). |
| `financial_capacity` | `text` nullable | Banda partilhada por comprador/investidor. Ver bandas abaixo. |
| `source` | `text` nullable | Origem: `idealista`, `site`, `referencia`, `audio`, `manual`, `outro`. |
| `last_interaction_at` | `timestamptz` nullable | Denormalizado; atualizado ao registar interação. |
| `details` | `jsonb` default `'{}'` | Campos específicos do tipo (ver abaixo). Filtros avançados correm no cliente. |

Colunas existentes mantêm-se: `id`, `agency_id`, `name`, `email`, `phone`,
`address`, `notes`, `created_at`.

**Bandas de capacidade financeira** (`financial_capacity`):

| Valor | Rótulo | Intervalo |
|---|---|---|
| `muito_baixo` | Muito baixo | < 250k |
| `baixo` | Baixo | 250k – 500k |
| `medio` | Médio | 500k – 1M |
| `medio_alto` | Médio-alto | 1M – 2.5M |
| `alto` | Alto | 2.5M – 5M |
| `altissimo` | Altíssimo | 5M+ |

**Estrutura de `details` (jsonb), por tipo:**

- Comprador / Investidor:
  - `looking_for` (o que procura, texto)
  - `search_zone` (zona onde procura)
  - `temperature` (`quente` | `morno` | `frio`)
  - `already_bought` (bool — já comprou connosco)
- Vendedor:
  - `selling_property` (o que tem — descrição curta / título)
  - `selling_zone` (onde vende)
  - `selling_price` (número, €)
  - `typology` (T2, T3, …)
  - `has_garage` (bool)
  - `has_balcony` (bool)
  - `has_exclusivity` (bool — exclusividade com o agente)
  - `is_active_seller` (bool — ainda sem negócio fechado; alimenta a notificação de inatividade)
- Serviço:
  - `service_type` (advogado, certificado energético, …)

Os campos usados nos **previews da lista** e nos **filtros** leem-se de `details`
e de `financial_capacity`; a filtragem avançada é feita no browser (a lista de uma
agência é pequena), o que mantém os filtros flexíveis sem explosão de colunas.

### Tabela nova `contact_interactions`

```
id            uuid pk
agency_id     uuid -> agencies
person_id     uuid -> people (on delete cascade)
user_id       uuid -> users (nullable)
type          text check in ('chamada','visita','email','whatsapp','nota')
note          text
created_at    timestamptz default now()
```

RLS por `agency_id` (padrão do projeto). Ao inserir uma interação, a API atualiza
`people.last_interaction_at = now()`.

### Cores por tipo (tons suaves, dourado continua o destaque global)

- Comprador → azul suave
- Vendedor → verde suave
- Investidor → roxo suave
- Serviços → âmbar/cinza

Implementadas como chips com fundo `cor+alpha` e texto colorido, no mesmo estilo
dos chips de stage existentes.

## Fase 1 — Contactos

### Lista (`/people`, rótulo "Contactos")

- **Toggles de tipo** no topo (check-buttons): Todos · Compradores · Vendedores ·
  Investidores · Serviços. Multi-seleção; nenhum/todos = mostra todos.
- **Pesquisa** por nome ou telefone/email.
- Botão **Filtros** → painel com checkboxes abrangentes: tipo, banda de capacidade,
  temperatura, origem, tem garagem, tem varanda, exclusividade, vendedor ativo,
  já comprou, etc. Filtragem no cliente.
- **Previews específicos por tipo** em cada linha/cartão:
  - Comprador/Investidor: nome · o que procura · zona · capacidade · temperatura
  - Vendedor: nome · o que tem · onde vende · preço · último contacto (+ aviso se >10 dias)
  - Serviço: nome · tipo de serviço · contacto

### Ficha (`/people/[id]`)

- Cabeçalho com chips de tipo (coloridos).
- Info comum: nome, email, telefone, morada, capacidade, origem.
- Secção específica do tipo (comprador: procura/zona/capacidade/temperatura/já
  comprou; vendedor: tipologia/varanda/garagem/exclusividade/preço/onde vende/ativo).
- **Timeline de interações** + botão "Registar interação" (chamada/visita/email/nota).
- **Secção de Notas** no fim.
- Leads e imóveis associados (mantém/estende o que já existe).

### Criar contacto

- "+ Novo Contacto" com seletor de tipo(s) e campos condicionais + capacidade +
  origem. (Modo áudio entra na Fase 4.)

### Notificação de vendedor inativo

- Estende o cron existente (`app/api/cron/lead-inactive`) ou cria cron paralelo:
  encontra contactos com `vendedor` em `types` e `details.is_active_seller = true`
  cujo `last_interaction_at` (ou `created_at` se nulo) é anterior a hoje-10 dias, e
  cria notificação na app (reutiliza `lib/notifications.ts`). Evita duplicar
  notificações para o mesmo contacto.

## Fase 2 — Leads → Contactos

- Ao criar uma lead (inclui webform e Idealista), garantir contacto ligado: se a
  lead tem `person_id`, usa-o; senão cria um contacto.
- Leads do Idealista → `types = ['comprador']`, origem `idealista`, preenche o
  máximo: mapeia `budget` → banda `financial_capacity`, `zone` → `details.search_zone`,
  `typology`/notas → `details.looking_for`.
- **Origem sempre gravada no contacto** (`source`), para saber de onde veio.
- Mapa `budget → financial_capacity`: <250k `muito_baixo`; 250k–500k `baixo`;
  500k–1M `medio`; 1M–2.5M `medio_alto`; 2.5M–5M `alto`; >5M `altissimo`.

## Fase 3 — Imóveis

- Ficha do imóvel mostra o **contacto vendedor** (via `person_id`), com link.
- **Visitas**: nova tabela `property_visits`:
  ```
  id uuid pk · agency_id uuid · property_id uuid -> properties
  person_id uuid -> people (nullable) · visitor_name text · agency_name text
  visited_at timestamptz · notes text · created_at timestamptz
  ```
  Se o visitante corresponder a um contacto, liga por `person_id`; senão guarda
  `visitor_name`/`agency_name`.
- Ao mudar o estado do imóvel para **Vendido**, ação "Gerar email de fecho": a IA
  redige um email a parabenizar todos os contactos envolvidos no negócio (vendedor
  + comprador(es) + serviços ligados) e a pedir uma **Google review** (link
  configurável mais tarde; placeholder por agora). Reutiliza a infra de email
  (`lib/email`, `SendEmailModal`).

## Fase 4 — Áudio

- Botão "Áudio" no criar contacto → grava com `MediaRecorder` → envia blob para
  `/api/ai/transcribe-contact`:
  1. Groq **Whisper** (`whisper-large-v3`) transcreve.
  2. LLM (`llama-3.3-70b-versatile`) extrai um JSON no schema do contacto
     (tipos, nome, contacto, capacidade, `details`).
  3. Devolve os campos → **formulário pré-preenchido** para o agente rever/corrigir.
- Ao guardar, `source = 'audio'`. Reutiliza o mesmo POST `/api/people`.

## Fora de âmbito (por agora)

- Configuração do link/fluxo de Google review (só placeholder na Fase 3).
- Configuração detalhada das leads/automação Idealista (virá depois; a Fase 2 só
  garante a criação/atualização do contacto e a origem).
- Deduplicação avançada de contactos (matching por telefone/email fica simples).

## Testes / verificação

- Migrações aplicáveis sem erro; RLS por agência nas tabelas novas.
- Fase 1: criar contactos de cada tipo, toggles e filtros filtram corretamente,
  registar interação atualiza `last_interaction_at`, notas guardam.
- Fase 2: criar lead sem `person_id` cria contacto com origem correta; Idealista
  mapeia capacidade/zona/procura.
- Fase 3: visita liga a contacto existente; email de fecho gera texto com todos os
  contactos e placeholder de review.
- Fase 4: gravação → transcrição → extração → formulário pré-preenchido.
- Verificação visual no preview (lista, ficha, filtros) em desktop e mobile.
