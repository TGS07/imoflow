-- Pipeline card fields v2: flexible multi-field selection + property_type on leads + special_dates on leads

-- 1. Add card_fields (jsonb) to pipelines — replaces card_primary_field / card_secondary_field
alter table pipelines add column if not exists card_fields jsonb;

-- 2. Migrate existing primary/secondary into card_fields array
update pipelines
set card_fields = jsonb_build_array(card_primary_field, card_secondary_field)
where card_fields is null;

-- 3. Add property_type to leads (for leads without a linked property)
alter table leads add column if not exists property_type text;
alter table leads add constraint leads_property_type_check
  check (property_type is null or property_type in ('apartamento','moradia','terreno','loja','escritorio','armazem','outro'));

-- 4. Add special_dates to leads
alter table leads add column if not exists special_dates jsonb default '[]'::jsonb;
