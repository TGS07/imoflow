# Campos adicionais de imóvel (área útil, ano, energia, garagem, elevador)

**Data:** 2026-07-28
**Status:** Aprovado para planeamento

## Contexto

A tabela `properties` tem hoje um único campo de área (`area_m2`) e um conjunto básico de características (`typology`, `bedrooms`, `bathrooms`, `floor`, `condition`, `features` — lista livre de texto). Anúncios reais de imóveis (nomeadamente no Idealista) pedem tipicamente mais informação do que isto: área útil separada da área bruta, ano de construção, certificado energético, lugares de garagem, elevador, entre outros. O pedido original era "todas as infos possíveis que o Idealista poderá revelar" — depois de rever os campos mais comuns, foi acordado um conjunto concreto e mais restrito (ver "Decisão de âmbito").

## Decisão de âmbito

Dos campos candidatos levantados (áreas — útil, bruta privativa, terreno; características — ano de construção, certificado energético, garagem, elevador; amenidades — varanda, terraço, piscina, mobilado, ar condicionado), foram aprovados apenas:

1. **Área útil (m²)**
2. **Ano de construção**
3. **Certificado energético**
4. **Lugares de garagem/estacionamento**
5. **Elevador (sim/não)**

Não avançam nesta spec: área bruta privativa, área de terreno, nem amenidades como campos estruturados — as amenidades continuam a viver no campo `features` (lista livre de texto) já existente, sem alterações.

## Modelo de dados

Nova migração, cinco colunas opcionais em `properties` (nenhuma quebra dados existentes):

```sql
alter table public.properties
  add column area_util_m2 numeric,
  add column construction_year integer,
  add column energy_certificate text,
  add column parking_spaces integer,
  add column has_elevator boolean;
```

`energy_certificate` é texto livre, não uma `check constraint` — o formulário oferece um `<select>` com os valores padrão em Portugal (A+, A, B, B-, C, D, E, F, Isento, e uma opção vazia), mas a coluna em si não impõe essa lista ao nível da base de dados, evitando uma migração extra se a escala energética alguma vez mudar. Isto segue o mesmo espírito de `type`/`status`/`condition` (que têm `check`) mas opta por menos rigidez aqui, dado tratar-se de um valor menos crítico para a integridade dos dados.

`area_m2` (campo de área já existente) não é alterado nem redefinido — continua a ser o campo de área "geral" já usado pelos cards da pipeline, pelo detalhe do lead e pelo modo de voz/IA. `area_util_m2` é um campo adicional, independente.

## Tipo TypeScript

`types/index.ts`, tipo `Property`: adicionar os cinco campos, todos opcionais/nuláveis:

```ts
area_util_m2: number | null
construction_year: number | null
energy_certificate: string | null
parking_spaces: number | null
has_elevator: boolean | null
```

## Formulários

Ambos `app/(app)/properties/page.tsx` (criação) e `app/(app)/properties/[id]/page.tsx` (edição) ganham uma nova secção **"Detalhes adicionais"**, junto às secções já existentes (Localização, Detalhes, Fotos, Idealista):

- **Área útil (m²)** — input numérico, ao lado do campo "Área (m²)" já existente.
- **Ano de construção** — input numérico.
- **Certificado energético** — `<select>` com as opções acima.
- **Lugares de garagem** — input numérico.
- **Elevador** — checkbox/toggle sim/não.

As rotas `POST /api/properties` e `PATCH /api/properties/[id]` não têm allowlist de campos (aceitam o corpo do pedido diretamente) — não é necessário alterar a API; basta incluir os novos campos no estado e no corpo do pedido de ambos os formulários.

Na página de detalhe do imóvel (`app/(app)/properties/[id]/page.tsx`), os campos aparecem também na vista de leitura (fora do modo de edição), seguindo o mesmo padrão (`field(...)`) já usado pelos campos existentes.

## Fora de âmbito

- Área bruta privativa e área de terreno como campos adicionais.
- Amenidades (varanda, terraço, piscina, mobilado, ar condicionado, etc.) como campos estruturados — continuam a viver em `features`.
- Adicionar os novos campos à lista de "campos configuráveis" dos cards da pipeline (`lib/pipeline/card-fields.ts`).
- Adicionar os novos campos ao `select` explícito usado no detalhe do lead (`app/api/leads/[id]/route.ts` e rota de listagem de leads) — o imóvel associado a um lead continua a mostrar só os campos já selecionados hoje.
- Atualizar o esquema de extração por voz/IA (`lib/ai/prompts.ts`) para reconhecer estes novos campos ao ditar um imóvel — continuam só editáveis manualmente no formulário.

## Testes

- Criar um imóvel novo preenchendo os 5 campos novos → confirmar que ficam gravados corretamente (via `GET /api/properties/[id]` ou diretamente na BD).
- Criar um imóvel sem preencher nenhum dos 5 campos novos → confirmar que ficam `null`, sem erro.
- Editar um imóvel existente (criado antes desta funcionalidade) e definir os 5 campos novos → confirmar que gravam corretamente sem afetar os restantes campos.
- Confirmar que a vista de leitura da ficha do imóvel mostra os valores preenchidos, e omite/mostra "—" quando `null`.
- Confirmar que `area_m2` continua a funcionar exatamente como antes (cards da pipeline, detalhe do lead, modo de voz) — nenhuma regressão.
