BEGIN;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'Channel',
    'ChannelMember',
    'ChatMessage',
    'DirectMessageThread',
    'Invoice',
    'SafetyAcknowledgement',
    'User',
    'VeloSurvey',
    'VeloSurveyResponse',
    'velo_project_managers'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, public', table_name);
  END LOOP;
END
$$;

COMMIT;
