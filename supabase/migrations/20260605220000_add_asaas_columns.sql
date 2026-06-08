-- Adiciona colunas do gateway Asaas na tabela orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS asaas_payment_id text,
  ADD COLUMN IF NOT EXISTS asaas_customer_id text,
  ADD COLUMN IF NOT EXISTS asaas_status text,
  ADD COLUMN IF NOT EXISTS asaas_qrcode text,
  ADD COLUMN IF NOT EXISTS asaas_copia_cola text,
  ADD COLUMN IF NOT EXISTS asaas_expires_at text,
  ADD COLUMN IF NOT EXISTS asaas_payload jsonb,
  ADD COLUMN IF NOT EXISTS payment_provider text;

-- Índice para busca por asaas_payment_id (usado no polling e webhook)
CREATE INDEX IF NOT EXISTS orders_asaas_payment_id_idx ON orders (asaas_payment_id);
