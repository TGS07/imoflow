-- Token de acesso ao feed XML de imóveis (CASA/SAPO), gerado por agência.
-- Mesmo modelo do calendar_token em `users`: identificador opaco que dá
-- acesso público (sem sessão) aos dados, revogável via regeneração.

alter table public.agencies add column if not exists feed_token uuid default gen_random_uuid();
