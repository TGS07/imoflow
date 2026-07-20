-- Comprador (contacto) do imóvel — quem comprou, quando vendido.
alter table public.properties
  add column buyer_id uuid references public.people(id) on delete set null;

create index properties_buyer_idx on public.properties(buyer_id);
