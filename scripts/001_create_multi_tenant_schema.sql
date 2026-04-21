-- Multi-Tenant SaaS Schema with Module Subscriptions
-- This schema supports organizations (tenants) subscribing to different modules

-- 1. Organizations (Tenants) table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Profiles table (links auth.users to organizations)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Modules table (defines available modules in the system)
CREATE TABLE IF NOT EXISTS public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  is_core BOOLEAN DEFAULT FALSE, -- Core modules are always included
  monthly_price DECIMAL(10,2) DEFAULT 0,
  yearly_price DECIMAL(10,2) DEFAULT 0,
  features JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Subscriptions table (links organizations to modules they've subscribed to)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'trial', 'cancelled', 'past_due')),
  billing_cycle TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ DEFAULT NOW(),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, module_id)
);

-- 5. Organization invites table (for inviting users to organizations)
CREATE TABLE IF NOT EXISTS public.organization_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  invited_by UUID REFERENCES public.profiles(id),
  token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default modules based on sidebar navigation
INSERT INTO public.modules (name, display_name, description, icon, is_core, monthly_price, yearly_price, features) VALUES
  ('dashboard', 'Dashboard', 'Main dashboard and analytics', 'Home', TRUE, 0, 0, '["Overview", "Quick stats", "Recent activity"]'),
  ('ticketing', 'Ticketing', 'Event ticketing and sales', 'Ticket', FALSE, 29.99, 299.99, '["Ticket creation", "Sales tracking", "Check-in management"]'),
  ('bookings', 'Bookings', 'Space and event booking management', 'Calendar', FALSE, 39.99, 399.99, '["Calendar view", "Booking requests", "Approvals workflow"]'),
  ('spaces', 'Spaces', 'Venue and space management', 'Building2', FALSE, 19.99, 199.99, '["Space inventory", "Availability", "Pricing rules"]'),
  ('programs', 'Programs', 'Educational programs and classes', 'GraduationCap', FALSE, 49.99, 499.99, '["Course catalog", "Registrations", "Scheduling", "Instructor management"]'),
  ('bazaar', 'Bazaar', 'Event marketplace and vendor management', 'Store', FALSE, 59.99, 599.99, '["Vendor applications", "Booth management", "Payment tracking", "Community calendar"]'),
  ('contacts', 'Contacts', 'Contact and relationship management', 'Users', FALSE, 24.99, 249.99, '["Contact database", "Customer tracking", "Volunteer management", "Vendor directory"]'),
  ('hr', 'Human Resources', 'Employee and member management', 'Users', FALSE, 34.99, 349.99, '["Employee records", "Departments", "Member management", "Discount policies"]'),
  ('donations', 'Donations', 'Donation and pledge management', 'Heart', FALSE, 44.99, 449.99, '["Donation tracking", "Donor management", "Pledges", "Reconciliation", "Reports"]'),
  ('billing', 'Billing', 'Invoicing and payment processing', 'CreditCard', FALSE, 29.99, 299.99, '["Invoice generation", "Payment tracking", "Financial reports"]'),
  ('reports', 'Reports', 'Advanced reporting and analytics', 'LayoutGrid', FALSE, 19.99, 199.99, '["Custom reports", "Data exports", "Analytics dashboards"]'),
  ('settings', 'Settings', 'System configuration', 'Settings', TRUE, 0, 0, '["User management", "Permissions", "Templates", "Email settings"]')
ON CONFLICT (name) DO NOTHING;

-- Enable Row Level Security on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations
CREATE POLICY "Users can view their own organization" ON public.organizations
  FOR SELECT USING (
    id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Owners and admins can update their organization" ON public.organizations
  FOR UPDATE USING (
    id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- RLS Policies for profiles
CREATE POLICY "Users can view profiles in their organization" ON public.profiles
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    OR id = auth.uid()
  );

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- RLS Policies for modules (everyone can view modules)
CREATE POLICY "Anyone can view modules" ON public.modules
  FOR SELECT USING (TRUE);

-- RLS Policies for subscriptions
CREATE POLICY "Users can view their organization subscriptions" ON public.subscriptions
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Owners can manage subscriptions" ON public.subscriptions
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND role = 'owner')
  );

-- RLS Policies for organization_invites
CREATE POLICY "Admins can view and manage invites" ON public.organization_invites
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
  );

CREATE POLICY "Anyone can view their own invite by token" ON public.organization_invites
  FOR SELECT USING (TRUE);

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', NULL),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', NULL)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to check if organization has access to a module
CREATE OR REPLACE FUNCTION public.has_module_access(org_id UUID, module_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  module_record RECORD;
  subscription_exists BOOLEAN;
BEGIN
  -- Get the module
  SELECT * INTO module_record FROM public.modules WHERE name = module_name;
  
  -- Core modules are always accessible
  IF module_record.is_core THEN
    RETURN TRUE;
  END IF;
  
  -- Check if organization has an active subscription
  SELECT EXISTS(
    SELECT 1 FROM public.subscriptions s
    WHERE s.organization_id = org_id 
    AND s.module_id = module_record.id
    AND s.status IN ('active', 'trial')
  ) INTO subscription_exists;
  
  RETURN subscription_exists;
END;
$$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply updated_at triggers
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
