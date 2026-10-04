-- Fase 8 (Trial + 3 Planos): adiciona trial_ends_at e atualiza o campo plan
-- para suportar 'trial', 'starter', 'essential', 'pro' (mantém 'free' legado).
-- Migration aditiva — não remove nem renomeia colunas existentes.

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;
