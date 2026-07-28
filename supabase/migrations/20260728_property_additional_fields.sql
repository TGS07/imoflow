-- Campos adicionais de imóvel para refletir informação típica de anúncios
-- (ex.: Idealista): área útil, ano de construção, certificado energético,
-- lugares de garagem e elevador. Todos opcionais; nenhum dado existente é
-- afetado. `energy_certificate` é texto livre (sem check constraint) — o
-- formulário oferece um <select> com os valores padrão em Portugal, mas a
-- coluna não impõe essa lista.
alter table public.properties
  add column area_util_m2 numeric,
  add column construction_year integer,
  add column energy_certificate text,
  add column parking_spaces integer,
  add column has_elevator boolean;
