-- Company documents library + leave performa workflow statuses

DO $$ BEGIN
  ALTER TYPE public.approval_status ADD VALUE 'Awaiting_Signed_Performa';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.approval_status ADD VALUE 'Performa_Submitted';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.company_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  is_leave_performa_template BOOLEAN NOT NULL DEFAULT false,
  uploaded_by UUID REFERENCES public.users_profile(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_documents_created ON public.company_documents(created_at DESC);

-- At most one row may be the active leave performa template.
CREATE UNIQUE INDEX IF NOT EXISTS company_documents_one_leave_template
  ON public.company_documents (is_leave_performa_template)
  WHERE is_leave_performa_template = true;

ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; authenticated users use admin API with service client only.
CREATE POLICY company_documents_deny_authenticated ON public.company_documents
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

COMMENT ON TABLE public.company_documents IS 'Internal company files; managed via admin API (service role).';
COMMENT ON COLUMN public.company_documents.is_leave_performa_template IS 'PDF with AcroForm fields (fts_* names) used to generate filled leave performas.';
