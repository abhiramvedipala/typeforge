
CREATE TABLE public.user_stats (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  keys JSONB NOT NULL DEFAULT '{}'::jsonb,
  bigrams JSONB NOT NULL DEFAULT '{}'::jsonb,
  test_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_stats TO authenticated;
GRANT ALL ON public.user_stats TO service_role;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own stats" ON public.user_stats FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.user_settings (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  theme TEXT,
  sound_profile TEXT,
  heatmap_red NUMERIC,
  heatmap_yellow NUMERIC,
  heatmap_accuracy_weight NUMERIC,
  ghost_enabled BOOLEAN,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings" ON public.user_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.test_history (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  mode TEXT NOT NULL,
  duration NUMERIC NOT NULL,
  wpm INTEGER NOT NULL,
  raw_wpm INTEGER NOT NULL,
  accuracy NUMERIC NOT NULL,
  correct_chars INTEGER NOT NULL DEFAULT 0,
  incorrect_chars INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_history TO authenticated;
GRANT ALL ON public.test_history TO service_role;
ALTER TABLE public.test_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own history read" ON public.test_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own history insert" ON public.test_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX test_history_user_created ON public.test_history (user_id, created_at DESC);
