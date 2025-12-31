-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table with onboarding fields
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,

  -- Onboarding data (JSONB stores all questionnaire answers)
  onboarding_data JSONB,

  -- Legacy fields (kept for backwards compatibility)
  craving_strength INTEGER CHECK (craving_strength >= 1 AND craving_strength <= 10),
  main_goal TEXT CHECK (main_goal IN ('weight_loss', 'better_energy', 'health_detox')),

  -- Progress tracking
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  money_saved_weekly DECIMAL(10, 2) DEFAULT 0,
  cravings_count INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create cravings_log table
CREATE TABLE IF NOT EXISTS cravings_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  craving_intensity INTEGER CHECK (craving_intensity >= 1 AND craving_intensity <= 10),
  trigger_type TEXT,
  notes TEXT,
  successfully_resisted BOOLEAN DEFAULT false,
  logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cravings_log ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Cravings log policies
CREATE POLICY "Users can view their own cravings"
  ON cravings_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cravings"
  ON cravings_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cravings"
  ON cravings_log FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cravings"
  ON cravings_log FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cravings_user_id ON cravings_log(user_id);
CREATE INDEX IF NOT EXISTS idx_cravings_logged_at ON cravings_log(logged_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to auto-create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that calls this function when a new user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
