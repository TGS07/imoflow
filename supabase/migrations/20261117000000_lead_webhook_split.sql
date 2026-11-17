-- Dividir as leads de um parceiro entre várias contas (agências) em
-- alternância: ligações com o mesmo split_group recebem uma lead cada, à vez.
-- Liga-se colando a chave da ligação da outra conta (quem tem a chave já
-- podia enviar-lhe leads, por isso não dá acesso a mais nada).

alter table public.lead_webhooks add column if not exists split_group uuid;
alter table public.lead_webhooks add column if not exists last_assigned_at timestamptz;

create index if not exists lead_webhooks_split_group_idx
  on public.lead_webhooks (split_group) where split_group is not null;

-- Escolhe a próxima ligação do grupo (a que recebeu há mais tempo) e marca-a
-- logo, com lock, para dois pedidos em simultâneo não irem para a mesma conta.
-- Só considera ligações ativas cuja agência tem pelo menos uma pipeline com fases.
create or replace function public.claim_next_split_webhook(p_group uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select w.id into v_id
  from public.lead_webhooks w
  where w.split_group = p_group
    and w.is_active
    and exists (
      select 1 from public.pipeline_stages s
      join public.pipelines p on p.id = s.pipeline_id
      where p.agency_id = w.agency_id
    )
  order by w.last_assigned_at asc nulls first, w.created_at asc
  limit 1
  for update skip locked;

  if v_id is not null then
    update public.lead_webhooks set last_assigned_at = now() where id = v_id;
  end if;
  return v_id;
end;
$$;

-- Só o endpoint (service role) chama isto
revoke all on function public.claim_next_split_webhook(uuid) from public, anon, authenticated;
grant execute on function public.claim_next_split_webhook(uuid) to service_role;
