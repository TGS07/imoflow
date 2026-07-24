-- Link do anúncio do imóvel no Idealista (texto livre, sem validação de
-- formato). Pedido do cliente para poder colar o link do anúncio existente.
ALTER TABLE public.properties ADD COLUMN idealista_url TEXT;
