-- Vendedor (contacto) do imóvel
alter table public.properties add column if not exists seller_id uuid references public.people(id) on delete set null;

create index if not exists properties_seller_idx on public.properties(seller_id);
