# Exportar contactos para Excel — Design

**Data:** 2026-10-31
**Estado:** Aguarda aprovação

## Objetivo

O cliente pede listas específicas de contactos (por exemplo, os de "Frio Empreendimento") e hoje cada lista é feita à mão. Esta página deixa qualquer utilizador escolher uma pipeline e as fases, rever os contactos, tirar os que não quer e descarregar um `.xlsx`.

## Âmbito

Incluído:

- Página `/exportar`, no menu e na paleta de comandos.
- Filtros por pipelines (uma ou mais), fases (uma ou mais) e temperatura (opcional).
- Pré-visualização com checkboxes, pesquisa e "selecionar todos".
- Ficheiro `.xlsx` com colunas fixas.
- Botão "Exportar" da página Leads a abrir esta página.

Fora de âmbito:

- Escolha de colunas, templates guardados, exportações agendadas ou enviadas por email.
- Botão "Exportar" da página Relatórios, porque exporta outro tipo de dados.
- Alterações à base de dados: não há migração.

## Permissões

| Papel | Pode exportar |
|---|---|
| `admin` | Todas as leads da agência |
| `agent` | Só as leads com `assigned_to` igual ao próprio |

É a mesma regra de `GET /api/leads`. O filtro é aplicado no servidor, tanto na pré-visualização como na geração do ficheiro. Todas as queries filtram por `agency_id`.

## Fluxo

1. O utilizador escolhe uma ou mais pipelines. Aparecem as fases de cada uma pela ordem de `position`, nenhuma marcada.
2. Marca uma ou mais fases e, se quiser, uma temperatura. A lista atualiza.
3. Todos os contactos vêm com a checkbox marcada. Desmarca os que não quer. A pesquisa por nome, telefone ou email só filtra o que se vê: não altera as seleções.
4. O topo mostra o resumo, por exemplo "18 selecionados · 5 sem email · 0 sem telefone".
5. Clica em "Criar Excel (18 contactos)" e o ficheiro descarrega.

Tirar uma pipeline tira também as fases dela. Mudar pipelines, fases ou temperatura volta a marcar todos os contactos da nova lista.

## Regras dos dados

**Uma linha por contacto.** As leads agrupam-se por `person_id`. Se a mesma pessoa tiver várias leads nas fases escolhidas, mesmo em pipelines diferentes, sai uma linha. Consultor e Imóvel vêm da lead mais recente (`created_at`), e Pipeline e Fase mostram todos os valores, separados por vírgula.

**Leads sem contacto ligado.** Lead com `person_id` nulo fica como linha própria, com nome, email e telefone da própria lead. Nas leads com contacto, usam-se os dados de `people`, e os campos vazios recorrem aos da lead.

**Leads com a fase de outra pipeline** ficam de fora: exporta-se o que o quadro mostra, por isso a fase da lead tem de pertencer à pipeline da lead.

**Fases ganhas e perdidas** aparecem como as outras: só entram se forem marcadas.

**Temperatura** é a de `people.temperature`. O filtro oferece Frio, Fresco, Morno, Quente e Sem temperatura. Linhas sem contacto ligado contam como "Sem temperatura".

**Volume.** O Supabase devolve no máximo 1000 linhas por query, por isso a leitura de leads é paginada com `.range()`. As leituras por `person_id` são feitas em blocos de 200, como em `GET /api/leads`.

## Colunas do Excel

| Coluna | Origem |
|---|---|
| Nome | `people.name`, senão `leads.name` |
| Telefone | `people.phone`, senão `leads.phone` |
| Email | `people.email`, senão `leads.email` |
| Pipeline | `pipelines.name` |
| Fase | `pipeline_stages.name` |
| Temperatura | `people.temperature`, com a primeira letra em maiúscula |
| Consultor | `users.name` da lead |
| Imóvel | Referência e título de `properties` |
| Último contacto | Data da última chamada atendida |

"Último contacto" segue a regra dos dias desde o último contacto: `contact_interactions` com `type = 'chamada'` e `outcome = 'atendeu'`. As notas ficam de fora, porque são internas e o ficheiro pode sair da agência.

Formato: uma folha "Contactos", cabeçalho a negrito e fixo, filtros automáticos ligados e larguras ajustadas. Os valores entram como texto, para o Excel manter o `+351` e não interpretar nada como fórmula. O ficheiro chama-se `contactos-<pipeline>-<AAAA-MM-DD>.xlsx`, sem acentos nem espaços. Com mais do que uma pipeline, chama-se `contactos-varias-pipelines-<AAAA-MM-DD>.xlsx`.

## Arquitetura

Tudo corre no servidor, para que a regra de permissões fique num só sítio e a ExcelJS não vá para o browser.

**`lib/exports/contacts.ts`** — carrega as linhas. Recebe o cliente Supabase, o perfil e os filtros, e devolve as linhas já agrupadas. Não sabe nada de Excel nem de HTTP. É usado pelas duas rotas, para a pré-visualização e o ficheiro aplicarem exatamente as mesmas regras.

**`lib/exports/build-workbook.ts`** — recebe linhas e devolve o buffer do `.xlsx`. Não toca na base de dados.

**`app/api/exports/contacts/route.ts`**

- `GET ?pipeline_ids=a,b&stage_ids=c,d&temperature=` devolve as linhas em JSON.
- `POST` com `{ pipeline_ids, stage_ids, temperature, selected_keys }` devolve o ficheiro. O servidor volta a carregar as linhas pelos filtros e fica só com as que estão em `selected_keys`, por isso o cliente não consegue pedir contactos fora do que pode ver. Um contacto que entre na fase entre a pré-visualização e o clique não é exportado sem ser visto.

A chave de cada linha é `p:<person_id>` ou `l:<lead_id>`.

**`app/(app)/exportar/page.tsx`** — página cliente com filtros, tabela e botão. Lê pipelines e fases das rotas existentes.

**Navegação** — entrada "Exportar Excel" nos itens de gestão de `SidebarNav`, `TopNav` e `MobileNav`, e em `CommandPalette`. O botão "Exportar" de `app/(app)/leads/page.tsx` passa a ligar a `/exportar`.

**Dependência nova:** `exceljs`.

## Erros e casos limite

| Caso | Comportamento |
|---|---|
| Nenhuma fase escolhida | Texto a pedir para escolher pipelines e fases, sem lista |
| Sem contactos nos filtros | "Nenhum contacto nestes filtros", botão desativado |
| Tudo desmarcado | Botão desativado |
| Alguma pipeline de outra agência | 404, como em `add-contacts` |
| Sem sessão | 401 |
| Filtros inválidos ou `selected_keys` vazio | 400 |
| Falha ao gerar | Mensagem de erro na página, seleções mantidas |

## Verificação

O projeto não tem testes automáticos, por isso a verificação é manual no preview local, seguida de `npm run build` e `npm run lint`:

- Com `admin`, exportar "Frio Empreendimento" e confirmar no `.xlsx` as linhas, as colunas e o contacto desmarcado que ficou de fora.
- Com `agent`, confirmar que só aparecem as leads atribuídas a esse consultor, incluindo no ficheiro.
- Marcar uma fase com a mesma pessoa em duas leads e confirmar que sai uma só linha.
- Confirmar que os telefones com `+351` ficam intactos ao abrir o ficheiro.
- Confirmar a página em largura de telemóvel.
