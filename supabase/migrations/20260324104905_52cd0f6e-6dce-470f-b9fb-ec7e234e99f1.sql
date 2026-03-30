
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'viewer');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'editor',
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  department TEXT DEFAULT '',
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'editor');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  dept TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  entry_date DATE DEFAULT CURRENT_DATE,
  priority TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Normal', 'High', 'Key highlight')),
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  author_name TEXT DEFAULT '',
  academic_year TEXT DEFAULT '',
  student_count INTEGER,
  external_link TEXT DEFAULT '',
  collaborating_org TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view entries"
  ON public.entries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Editors and admins can create entries"
  ON public.entries FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor')
  );

CREATE POLICY "Editors can update their own entries"
  ON public.entries FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = created_by OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins and creators can delete entries"
  ON public.entries FOR DELETE
  TO authenticated
  USING (
    auth.uid() = created_by OR public.has_role(auth.uid(), 'admin')
  );

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER entries_updated_at
  BEFORE UPDATE ON public.entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_entries_dept ON public.entries(dept);
CREATE INDEX idx_entries_type ON public.entries(type);
CREATE INDEX idx_entries_date ON public.entries(entry_date DESC);
CREATE INDEX idx_entries_priority ON public.entries(priority);
CREATE INDEX idx_entries_created ON public.entries(created_at DESC);

CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'image')),
  storage_path TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view attachments"
  ON public.attachments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Editors and admins can create attachments"
  ON public.attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor')
  );

CREATE POLICY "Admins can delete attachments"
  ON public.attachments FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_attachments_entry ON public.attachments(entry_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true);

CREATE POLICY "Authenticated users can view attachment files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'attachments');

CREATE POLICY "Editors can upload attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'attachments');

CREATE POLICY "Admins can delete attachment files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'attachments' AND public.has_role(auth.uid(), 'admin'));
