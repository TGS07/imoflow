-- Pedido do cliente (out/2026): temperatura escolhida só à mão, com 4 níveis
-- (frio, fresco, morno, quente). Sem temperatura = sem border no card.
-- "neutro" deixa de existir e passa a "sem temperatura".

alter table public.people drop constraint if exists people_temperature_check;
update public.people set temperature = null where temperature = 'neutro';
alter table public.people add constraint people_temperature_check
  check (temperature is null or temperature in ('frio', 'fresco', 'morno', 'quente'));
