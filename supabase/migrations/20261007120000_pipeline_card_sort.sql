-- Ordem dos cards dentro de cada fase, configurável por pipeline.
-- oldest_first: há mais tempo na fase em cima (comportamento atual)
-- newest_first: entrou há menos tempo na fase em cima

alter table public.pipelines
  add column if not exists card_sort text not null default 'oldest_first';

alter table public.pipelines drop constraint if exists pipelines_card_sort_check;
alter table public.pipelines
  add constraint pipelines_card_sort_check
    check (card_sort in ('oldest_first', 'newest_first'));
