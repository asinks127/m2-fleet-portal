-- Enable RLS on SignableDocument if not already enabled
ALTER TABLE public."SignableDocument" ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to SELECT all documents
DROP POLICY IF EXISTS "Allow authenticated SELECT on SignableDocument" ON public."SignableDocument";
CREATE POLICY "Allow authenticated SELECT on SignableDocument"
  ON public."SignableDocument"
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to INSERT their own documents
DROP POLICY IF EXISTS "Allow authenticated INSERT on SignableDocument" ON public."SignableDocument";
CREATE POLICY "Allow authenticated INSERT on SignableDocument"
  ON public."SignableDocument"
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to UPDATE any document
DROP POLICY IF EXISTS "Allow authenticated UPDATE on SignableDocument" ON public."SignableDocument";
CREATE POLICY "Allow authenticated UPDATE on SignableDocument"
  ON public."SignableDocument"
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to DELETE any document
DROP POLICY IF EXISTS "Allow authenticated DELETE on SignableDocument" ON public."SignableDocument";
CREATE POLICY "Allow authenticated DELETE on SignableDocument"
  ON public."SignableDocument"
  FOR DELETE
  TO authenticated
  USING (true);

-- Also enable RLS and add policies for SignatureRequest if not already done
ALTER TABLE public."SignatureRequest" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated SELECT on SignatureRequest" ON public."SignatureRequest";
CREATE POLICY "Allow authenticated SELECT on SignatureRequest"
  ON public."SignatureRequest"
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated INSERT on SignatureRequest" ON public."SignatureRequest";
CREATE POLICY "Allow authenticated INSERT on SignatureRequest"
  ON public."SignatureRequest"
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated UPDATE on SignatureRequest" ON public."SignatureRequest";
CREATE POLICY "Allow authenticated UPDATE on SignatureRequest"
  ON public."SignatureRequest"
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated DELETE on SignatureRequest" ON public."SignatureRequest";
CREATE POLICY "Allow authenticated DELETE on SignatureRequest"
  ON public."SignatureRequest"
  FOR DELETE
  TO authenticated
  USING (true);
