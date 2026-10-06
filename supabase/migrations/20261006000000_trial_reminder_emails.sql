-- Marca quando os avisos de fim de trial foram enviados, para não repetir.
-- Aditiva: colunas nulas, sem efeito nos dados existentes.
alter table public.agencies
  add column if not exists trial_ending_email_sent_at timestamptz,
  add column if not exists trial_ended_email_sent_at timestamptz;
