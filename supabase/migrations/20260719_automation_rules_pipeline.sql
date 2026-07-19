-- O tipo AutomationRule e o motor (matchesTriggerConfig) referem
-- pipeline_id desde o multi-pipeline, mas a coluna nunca foi criada na BD —
-- o filtro por pipeline lia sempre undefined (inofensivo) e qualquer insert
-- com pipeline_id falhava. Alinha a BD com o código.
alter table public.automation_rules
  add column pipeline_id uuid references public.pipelines(id) on delete cascade;

create index automation_rules_pipeline_idx on public.automation_rules(pipeline_id);
