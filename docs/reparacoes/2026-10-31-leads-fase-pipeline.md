# Reparação: leads com fase de outra pipeline

**Estado:** por aprovar. Nada aqui foi executado em produção.
**Contagem:** 95 de 615 leads, em 2026-10-31.

O SQL está de propósito fora de `supabase/migrations`.

## Causas e correção no código

| Leads | Causa | Certeza | Correção |
|---|---|---|---|
| 59 (agência SATUS) | A regra "Mover para Frio" procurava a fase só pelo nome, sem filtrar agência nem pipeline. O cron corre com o service client, que ignora o RLS, por isso apanhou a "Frio" da SATUS3. | Comprovada: `automation_logs` regista as 59 movidas para essa fase. | `lib/automations/engine.ts` só procura na pipeline da lead. |
| 6 (SATUS3) | Apagar uma fase movia as leads para a 1ª fase da agência, não da pipeline. | Muito provável: as 6 mudaram de fase no mesmo microssegundo (2026-09-07 11:34:00.777457), e o quadro não permite mover em massa para outra pipeline. | `app/api/pipeline-stages/[id]/route.ts` e "Aplicar template", que agora cria as fases novas antes de apagar as antigas. |
| 7 (SATUS3) | A página da lead mostrava botões com as fases de todas as pipelines. | Muito provável: mudanças isoladas, 4 delas segundos ou minutos depois de criar a lead. | `app/(app)/leads/[id]/page.tsx` só mostra as fases da pipeline da lead. |
| 23 (SATUS3) | Foi uma das duas anteriores, mas não dá para saber qual. Foram criadas a 16 e 17 de julho, e `stage_entered_at` só é registado desde 21 de julho. | Por confirmar. | Coberta pelas correções acima. |

Também fica validado na API: `PATCH /api/leads/[id]`, `POST /api/leads` e `PATCH /api/leads/bulk` recusam uma fase de outra pipeline. Mudar uma lead para uma pipeline sem fases devolve erro, em vez de deixar a fase antiga.

"Aplicar template" só existe desde 2026-09-13, por isso não explica o lote de julho.

## Regras de reparação

Não há histórico de fases, por isso a fase original destas leads não é recuperável.

| Grupo | Leads | Regra | Resultado |
|---|---|---|---|
| A | 59 SATUS | Mantém a pipeline e vai para a 1ª fase dela. | 37 Leads › Lead, 20 Compradores › Contacto, 2 Vendedores › Contacto |
| B | 29 SATUS3 | A fase foi um efeito lateral: mantém a pipeline e vai para a 1ª fase dela. | 15 AVPP › 1º Contacto, 8 Vendedor › Possivel Angariação, 6 Comprador › Novo/Não Atendeu |
| C | 7 SATUS3 | A fase foi escolhida por uma pessoa: mantém a fase e muda a pipeline. | 4 AVPP › 1º Contacto, 1 Frio › Comprador, 1 Pós-cliente › Follow-Up Final, 1 Empreendimento › Não Atendeu Empreendimento |

A simulação em modo só de leitura cobriu as 95 leads, todas com destino numa fase ativa.

A ter em conta:

- **Dias na fase:** nos grupos A e B o contador recomeça na data da reparação, porque o trigger `leads_set_stage_entered_at` atualiza `stage_entered_at`. O grupo C não muda de fase.
- **Automações e notificações:** não disparam, porque o SQL escreve diretamente na tabela.
- **Duplicados visíveis:** 17 das 37 leads da pipeline Leads têm outro negócio do mesmo contacto nessa pipeline, e vão aparecer como cards separados.
- **A rever à mão:** `043d90f0` (AVPP, estava em Vendedor › Angariado) e `26c735ec` (AVPP, estava em Comprador › Enviar excel) têm fases mais avançadas do que a 1ª. Ficam no grupo B, porque `043d90f0` já tem negócio na pipeline Vendedor.

## Ordem de execução

1. Fazer deploy da correção. Sem isto, o cron diário volta a estragar as leads.
2. Correr o passo 1 (reparação).
3. Decidir o passo 2 (regra "Mover para Frio").
4. Correr o passo 3 (proteção na base de dados).

Se a contagem mudar entretanto, o passo 1 cancela tudo sem alterar nada.

## Passo 1: reparação

```sql
begin;

create table public.leads_stage_repair_20261031 as
select
  l.id as lead_id,
  l.agency_id,
  l.pipeline_id as old_pipeline_id,
  l.stage_id as old_stage_id,
  l.stage_entered_at as old_stage_entered_at,
  case
    when l.id in (
      '925c0896-761c-4c75-9fbe-b9bb9bfc3457', '8d85e84a-052b-49d3-8c16-fb151888e483',
      '962c3000-8fc9-44f7-9f6b-b1b08fa833eb', 'cd5ea27e-c9b7-4b54-b7fa-6ed1a5b2c882',
      'beb9d122-2670-4720-b402-b9013b76c1a6', 'b5fad18d-e71c-4a25-9942-cc6f0b85cac4',
      '652a1362-4054-47be-90c0-26d619471d9e'
    ) then 'C'
    when l.agency_id <> s.agency_id then 'A'
    else 'B'
  end as grupo
from public.leads l
join public.pipeline_stages s on s.id = l.stage_id
where l.pipeline_id is distinct from s.pipeline_id;

-- Sem políticas: a cópia não fica acessível pela API.
alter table public.leads_stage_repair_20261031 enable row level security;

-- Grupos A e B: mantêm a pipeline, vão para a 1ª fase dela.
update public.leads l
set stage_id = (
  select f.id from public.pipeline_stages f
  where f.pipeline_id = l.pipeline_id
  order by f.position, f.created_at
  limit 1
)
from public.leads_stage_repair_20261031 r
where r.lead_id = l.id and r.grupo in ('A', 'B');

-- Grupo C: mantém a fase, muda a pipeline.
update public.leads l
set pipeline_id = s.pipeline_id
from public.leads_stage_repair_20261031 r
join public.pipeline_stages s on s.id = r.old_stage_id
where r.lead_id = l.id and r.grupo = 'C';

do $$
declare
  a int; b int; c int; restantes int;
begin
  select count(*) filter (where grupo = 'A'), count(*) filter (where grupo = 'B'), count(*) filter (where grupo = 'C')
    into a, b, c
    from public.leads_stage_repair_20261031;
  select count(*) into restantes
    from public.leads l
    join public.pipeline_stages s on s.id = l.stage_id
    where l.pipeline_id is distinct from s.pipeline_id or l.agency_id <> s.agency_id;
  if a <> 59 or b <> 29 or c <> 7 or restantes <> 0 then
    raise exception 'Contagem inesperada: A=%, B=%, C=%, restantes=%', a, b, c, restantes;
  end if;
end $$;

commit;
```

Para reverter:

```sql
begin;
update public.leads l
set pipeline_id = r.old_pipeline_id,
    stage_id = r.old_stage_id
from public.leads_stage_repair_20261031 r
where r.lead_id = l.id;

update public.leads l
set stage_entered_at = r.old_stage_entered_at
from public.leads_stage_repair_20261031 r
where r.lead_id = l.id;
commit;
```

Depois de confirmar o resultado, a tabela de cópia pode ser apagada.

## Passo 2: regra "Mover para Frio"

A SATUS não tem nenhuma fase "Frio". Com a correção, a regra deixa de mover leads e passa a registar falha em `automation_logs`, no máximo uma vez por lead a cada 14 dias. Recomendo desativá-la. A alternativa é criar uma fase "Frio" em cada pipeline da SATUS.

```sql
update public.automation_rules
set is_active = false
where id = '06746174-8605-4e32-bcbf-fba446a25bc7';
```

## Passo 3: proteção na base de dados

Isto impede o problema em qualquer escrita, incluindo as que não passam pela API, como o bot do Idealista. Só é possível depois do passo 1, porque `validate` falha se ainda houver leads erradas.

```sql
alter table public.pipeline_stages
  add constraint pipeline_stages_id_pipeline_id_key unique (id, pipeline_id);

alter table public.leads
  add constraint leads_stage_same_pipeline_fkey
  foreign key (stage_id, pipeline_id)
  references public.pipeline_stages (id, pipeline_id)
  not valid;

alter table public.leads
  validate constraint leads_stage_same_pipeline_fkey;
```

Uma escrita incoerente passa a dar erro. Nos dados atuais, nenhuma lead do bot estava errada por causa da inserção. Se o bot alguma vez enviar uma pipeline e uma fase incoerentes, essa lead é recusada, em vez de ficar escondida do quadro.
