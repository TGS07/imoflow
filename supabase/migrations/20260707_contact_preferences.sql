-- Estende lead_preferences para também suportar contactos (person_id),
-- mantendo lead_id 100% compatível com o fluxo existente (inclui o bot
-- do Idealista, que faz matching diretamente contra esta tabela).
alter table public.lead_preferences add column if not exists person_id uuid references public.people(id) on delete cascade;
alter table public.lead_preferences add column if not exists agency_id uuid references public.agencies(id) on delete cascade;
alter table public.lead_preferences alter column lead_id drop not null;

-- Backfill agency_id a partir da lead associada (linhas existentes são todas de leads)
update public.lead_preferences lp
set agency_id = l.agency_id
from public.leads l
where lp.lead_id = l.id and lp.agency_id is null;

alter table public.lead_preferences alter column agency_id set not null;

-- Exatamente um dono: lead OU contacto, nunca os dois nem nenhum
alter table public.lead_preferences add constraint lead_preferences_one_owner_chk check (
  (lead_id is not null and person_id is null) or (lead_id is null and person_id is not null)
);

-- Constraint única "cheia" (não parcial): necessária para o upsert(...).onConflict('person_id')
-- do Supabase resolver o conflito. NULL != NULL em SQL, por isso as leads (person_id null)
-- continuam a poder coexistir sem colidir entre si.
alter table public.lead_preferences add constraint lead_preferences_person_id_unique unique (person_id);

alter table public.lead_preferences enable row level security;
create policy "lead_preferences: own agency" on public.lead_preferences
  for all using (agency_id = public.get_my_agency_id());
