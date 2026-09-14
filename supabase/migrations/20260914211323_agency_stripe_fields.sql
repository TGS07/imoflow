-- Fase 6 (Billing/Stripe): campos para associar cada agency ao respetivo
-- Customer e Subscription no Stripe. Migration aditiva.

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
