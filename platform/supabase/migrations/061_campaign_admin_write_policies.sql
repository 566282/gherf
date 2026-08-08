-- 061_campaign_admin_write_policies.sql
-- Allows authenticated admins to manage campaigns, campaign tasks, and businesses.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = 'businesses'
  ) THEN
    ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.businesses FORCE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = 'campaigns'
  ) THEN
    ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.campaigns FORCE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = 'campaign_tasks'
  ) THEN
    ALTER TABLE public.campaign_tasks ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.campaign_tasks FORCE ROW LEVEL SECURITY;
  END IF;
END
$$;

DROP POLICY IF EXISTS businesses_select_authenticated ON public.businesses;
CREATE POLICY businesses_select_authenticated ON public.businesses
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS businesses_manage_admin ON public.businesses;
CREATE POLICY businesses_manage_admin ON public.businesses
  FOR INSERT WITH CHECK (public.is_super_admin(auth.uid()) OR EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'campaign_manager')
  ));

CREATE POLICY businesses_update_admin ON public.businesses
  FOR UPDATE USING (public.is_super_admin(auth.uid()) OR EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'campaign_manager')
  ));

DROP POLICY IF EXISTS campaigns_select_authenticated ON public.campaigns;
CREATE POLICY campaigns_select_authenticated ON public.campaigns
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS campaigns_manage_admin ON public.campaigns;
CREATE POLICY campaigns_manage_admin ON public.campaigns
  FOR INSERT WITH CHECK (public.is_super_admin(auth.uid()) OR EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'campaign_manager')
  ));

CREATE POLICY campaigns_update_admin ON public.campaigns
  FOR UPDATE USING (public.is_super_admin(auth.uid()) OR EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'campaign_manager')
  ));

DROP POLICY IF EXISTS campaign_tasks_select_authenticated ON public.campaign_tasks;
CREATE POLICY campaign_tasks_select_authenticated ON public.campaign_tasks
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS campaign_tasks_manage_admin ON public.campaign_tasks;
CREATE POLICY campaign_tasks_manage_admin ON public.campaign_tasks
  FOR INSERT WITH CHECK (public.is_super_admin(auth.uid()) OR EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'campaign_manager')
  ));

CREATE POLICY campaign_tasks_update_admin ON public.campaign_tasks
  FOR UPDATE USING (public.is_super_admin(auth.uid()) OR EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'campaign_manager')
  ));