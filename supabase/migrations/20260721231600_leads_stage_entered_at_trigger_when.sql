-- Corrige o trigger leads_set_stage_entered_at: usa "update of stage_id ... when (...)"
-- para o Postgres só invocar a função quando stage_id realmente muda (em vez de um IF
-- dentro da função, que corria em todo UPDATE de leads). Isto garante que
-- leads.stage_entered_at fica correto em todos os caminhos que mudam stage_id,
-- incluindo a ação move_stage das automações e a limpeza ao apagar uma etapa —
-- não só o PATCH manual.

drop trigger if exists leads_set_stage_entered_at on public.leads;
drop function if exists public.set_leads_stage_entered_at();

create or replace function public.set_leads_stage_entered_at()
returns trigger
language plpgsql
as $$
begin
  new.stage_entered_at := now();
  return new;
end;
$$;

create trigger leads_set_stage_entered_at
  before update of stage_id on public.leads
  for each row
  when (old.stage_id is distinct from new.stage_id)
  execute function public.set_leads_stage_entered_at();
