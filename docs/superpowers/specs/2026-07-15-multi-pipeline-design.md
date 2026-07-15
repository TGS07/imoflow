# Múltiplas pipelines + popup de contactos

**Data:** 2026-07-15 · **Estado:** aprovado (conversa)

## Objetivo
Permitir várias pipelines por agência, alternar entre elas na página Pipeline,
e um popup para adicionar contactos em massa (lista A-Z, pesquisa, checkbox) à
pipeline que está a ser vista.

## Modelo de dados
- Nova tabela `pipelines` (id, agency_id, name, position, created_at).
- `pipeline_stages` ganha `pipeline_id` (FK → pipelines, on delete cascade).
- `leads` ganha `pipeline_id` (FK → pipelines, on delete set null).
- Trigger `leads_ensure_pipeline` (before insert): se `pipeline_id` vier null,
  deriva do `stage_id` (pipeline da etapa) ou, na falta, da 1ª pipeline da
  agência; se `stage_id` vier null, usa a 1ª etapa dessa pipeline. Torna todos
  os caminhos de inserção de leads seguros sem alterar cada rota.

### Seed (migração, por agência)
- **Leads** (pos 0): reaproveita as etapas existentes e os leads existentes
  (passam a pertencer a esta pipeline).
- **Vendedores** (pos 1): etapas novas — Contacto · Angariação · Avaliação ·
  Em promoção · Proposta · Vendido (won) · Perdido (lost).
- **Compradores** (pos 2): etapas novas — Contacto · Qualificação · Visitas ·
  Proposta · Negociação · Fechado (won) · Perdido (lost).
- Sem contactos/leads nas duas novas — ficam vazias para a equipa preencher.

Pipelines criadas depois pela UI nascem **vazias** (equipa cria as etapas).

## APIs
- `/api/pipelines` — GET (lista da agência, por position), POST (criar vazia,
  admin), PATCH (renomear), DELETE (admin).
- `/api/pipeline-stages` — GET aceita `?pipeline_id=`; POST exige `pipeline_id`.
- `/api/leads` — GET aceita `?pipeline_id=`.
- `/api/pipelines/[id]/add-contacts` — POST `{ person_ids: [] }`: cria um lead
  por contacto na 1ª etapa da pipeline, ligado ao contacto (`person_id`).
  Ignora contactos que já tenham lead ativa (etapa não won/lost) nessa pipeline.

## UI
- **Página Pipeline** vira wrapper client (`PipelineBoard`): seletor de pipeline
  (abas/dropdown), botão **+ Nova pipeline**, botão **+ Contactos** (popup),
  e o KanbanBoard da pipeline selecionada (carrega etapas+leads por
  `pipeline_id`). "+ Novo Lead" cria na pipeline atual.
- **Popup de contactos:** quadrado pequeno, lista de contactos A-Z, campo de
  pesquisa por nome, checkbox por linha; os já presentes aparecem marcados e
  desativados. Confirmar → cria os leads e atualiza o board.
- **Definições → Pipeline:** seletor de pipeline no topo; criação/edição de
  etapas fica scoped à pipeline escolhida (para preencher as vazias).

## Fora do âmbito
- Automações por pipeline (o campo `pipeline_id` em `automation_rules` já
  existe; não mexer agora).
- Mover leads entre pipelines diferentes por drag (só dentro da mesma).

## Verificação
- `tsc --noEmit`; preview: criar pipeline, alternar, popup adiciona contactos e
  ignora duplicados, criar etapas nas pipelines vazias.
