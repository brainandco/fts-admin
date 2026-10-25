-- Petty cash allotments and employee purchase invoices.
-- Writes go through service-role API routes. RLS blocks direct client access.

CREATE TABLE IF NOT EXISTS public.petty_cash_allotments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  allotted_on DATE NOT NULL DEFAULT (timezone('Asia/Riyadh', now()))::date,
  source TEXT NOT NULL CHECK (source IN ('admin', 'pm', 'company')),
  allotted_by_user_id UUID,
  allotted_by_name TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_petty_cash_allotments_employee
  ON public.petty_cash_allotments (employee_id, allotted_on DESC);

CREATE INDEX IF NOT EXISTS idx_petty_cash_allotments_day
  ON public.petty_cash_allotments (allotted_on DESC);

CREATE TABLE IF NOT EXISTS public.petty_cash_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  returned_on DATE NOT NULL DEFAULT (timezone('Asia/Riyadh', now()))::date,
  received_by_name TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_petty_cash_returns_employee
  ON public.petty_cash_returns (employee_id, returned_on DESC);

CREATE TABLE IF NOT EXISTS public.purchase_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'rejected')),
  is_vat BOOLEAN NOT NULL DEFAULT false,
  invoice_number TEXT,
  seller_name TEXT,
  seller_vat_number TEXT,
  invoice_date DATE,
  amount_without_vat NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (amount_without_vat >= 0),
  vat_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (vat_amount >= 0),
  amount_with_vat NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (amount_with_vat >= 0),
  qr_payload TEXT,
  image_url TEXT,
  ocr_text TEXT,
  amount_mismatch BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_employee
  ON public.purchase_invoices (employee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_date
  ON public.purchase_invoices (invoice_date DESC, created_at DESC);

ALTER TABLE public.petty_cash_allotments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petty_cash_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;
