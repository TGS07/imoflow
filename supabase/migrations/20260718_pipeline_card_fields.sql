-- Campos configuráveis do card do kanban, por pipeline: qual a informação
-- principal (em grande) e secundária (em pequeno) de cada card.
alter table public.pipelines
  add column card_primary_field   text not null default 'name'
    check (card_primary_field in ('name','zone','property','typology','value')),
  add column card_secondary_field text not null default 'zone'
    check (card_secondary_field in ('name','zone','property','typology','value'));

-- Vendedores: o pedido original do cliente — zona em grande, nome em pequeno
update public.pipelines
  set card_primary_field = 'zone', card_secondary_field = 'name'
  where name = 'Vendedores';

-- Nunca permitir principal igual à secundária (a API valida, isto é a garantia final)
alter table public.pipelines
  add constraint pipelines_card_fields_distinct check (card_primary_field <> card_secondary_field);
