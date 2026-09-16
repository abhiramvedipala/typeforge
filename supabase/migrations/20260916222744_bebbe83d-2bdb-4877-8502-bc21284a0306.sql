CREATE TABLE public.custom_track (
  id uuid NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  charset text NOT NULL,
  seed_prompt text NOT NULL DEFAULT '',
  current_level text NOT NULL DEFAULT 'easy',
  stars integer NOT NULL DEFAULT 0,
  streak integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_track TO authenticated;
GRANT ALL ON public.custom_track TO service_role;
ALTER TABLE public.custom_track ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own custom tracks" ON public.custom_track FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.custom_attempt (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  track_id uuid NOT NULL REFERENCES public.custom_track(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  difficulty text NOT NULL,
  wpm numeric NOT NULL,
  accuracy numeric NOT NULL,
  errors_by_key jsonb NOT NULL DEFAULT '{}'::jsonb,
  passed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_attempt TO authenticated;
GRANT ALL ON public.custom_attempt TO service_role;
ALTER TABLE public.custom_attempt ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own custom attempts" ON public.custom_attempt FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX custom_attempt_track_idx ON public.custom_attempt(track_id, created_at DESC);
CREATE INDEX custom_track_user_idx ON public.custom_track(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_custom_track_updated_at BEFORE UPDATE ON public.custom_track
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();