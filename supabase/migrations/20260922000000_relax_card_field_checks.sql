-- Relax check constraints on card_primary_field / card_secondary_field
-- to accept all PipelineCardField values (the old constraint only allowed 5 fields).
-- These columns are legacy (card_fields jsonb is the source of truth) but
-- PipelineSettingsModal still writes to them for backwards compat.

alter table public.pipelines drop constraint if exists pipelines_card_primary_field_check;
alter table public.pipelines drop constraint if exists pipelines_card_secondary_field_check;
alter table public.pipelines drop constraint if exists pipelines_card_fields_distinct;

-- Re-add with the full set of valid fields
alter table public.pipelines
  add constraint pipelines_card_primary_field_check
    check (card_primary_field in ('name','phone','email','zone','typology','property','property_ref','property_type','value','call_status','source','notes'));

alter table public.pipelines
  add constraint pipelines_card_secondary_field_check
    check (card_secondary_field in ('name','phone','email','zone','typology','property','property_ref','property_type','value','call_status','source','notes'));
