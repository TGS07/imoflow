-- Junta dois contactos duplicados: move para o principal (p_primary_id)
-- tudo o que estava ligado ao duplicado (p_duplicate_id), resolvendo os
-- conflitos de unicidade conhecidos (lead_preferences.person_id é UNIQUE;
-- property_consultants tem UNIQUE (property_id, person_id)), preenche
-- campos vazios do principal a partir do duplicado, junta as notas dos
-- dois, e apaga o duplicado no fim.
create or replace function public.merge_people(p_primary_id uuid, p_duplicate_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.activities set person_id = p_primary_id where person_id = p_duplicate_id;
  update public.contact_interactions set person_id = p_primary_id where person_id = p_duplicate_id;
  update public.leads set person_id = p_primary_id where person_id = p_duplicate_id;
  update public.properties set seller_id = p_primary_id where seller_id = p_duplicate_id;
  update public.properties set buyer_id = p_primary_id where buyer_id = p_duplicate_id;
  update public.property_visits set person_id = p_primary_id where person_id = p_duplicate_id;

  delete from public.property_consultants pc_dup
    using public.property_consultants pc_primary
    where pc_dup.person_id = p_duplicate_id
      and pc_primary.person_id = p_primary_id
      and pc_primary.property_id = pc_dup.property_id;
  update public.property_consultants set person_id = p_primary_id where person_id = p_duplicate_id;

  delete from public.lead_preferences
    where person_id = p_duplicate_id
      and exists (select 1 from public.lead_preferences where person_id = p_primary_id);
  update public.lead_preferences set person_id = p_primary_id where person_id = p_duplicate_id;

  update public.people primary_row set
    email = coalesce(primary_row.email, dup.email),
    phone = coalesce(primary_row.phone, dup.phone),
    address = coalesce(primary_row.address, dup.address),
    notes = case
      when primary_row.notes is null or primary_row.notes = '' then dup.notes
      when dup.notes is null or dup.notes = '' then primary_row.notes
      else primary_row.notes || E'\n\n---\n' || dup.notes
    end
  from public.people dup
  where primary_row.id = p_primary_id and dup.id = p_duplicate_id;

  delete from public.people where id = p_duplicate_id;
end;
$$;
