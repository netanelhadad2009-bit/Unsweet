-- Meals Table Migration
-- This migration adds the meals table for user food logging with proper RLS
--
-- SECURITY: Row Level Security ensures users can only access their own meals
-- This prevents data leakage between users

-- Create meals table
CREATE TABLE IF NOT EXISTS meals (
  id TEXT PRIMARY KEY,  -- Client-generated ID (timestamp-based)
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  sugar_level TEXT CHECK (sugar_level IN ('safe', 'natural', 'avoid', 'none', 'low', 'moderate', 'high')) NOT NULL,
  meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  scanned_from TEXT,  -- 'camera', 'gallery', 'barcode', 'ocr', 'manual'
  image_uri TEXT,
  verdict TEXT,
  sugar_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own meals

-- SELECT: Users can view their own meals
CREATE POLICY "Users can view their own meals"
  ON meals FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: Users can insert their own meals
CREATE POLICY "Users can insert their own meals"
  ON meals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can update their own meals
CREATE POLICY "Users can update their own meals"
  ON meals FOR UPDATE
  USING (auth.uid() = user_id);

-- DELETE: Users can delete their own meals
CREATE POLICY "Users can delete their own meals"
  ON meals FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_meals_user_id ON meals(user_id);
CREATE INDEX IF NOT EXISTS idx_meals_timestamp ON meals(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_meals_user_timestamp ON meals(user_id, timestamp DESC);

-- Create trigger for updated_at timestamp (reuse existing function if available)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $func$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $func$ language 'plpgsql';
  END IF;
END
$$;

-- Create trigger for meals updated_at
DROP TRIGGER IF EXISTS update_meals_updated_at ON meals;
CREATE TRIGGER update_meals_updated_at
  BEFORE UPDATE ON meals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update delete_user function to include meals cleanup
-- This ensures meals are deleted when a user deletes their account
CREATE OR REPLACE FUNCTION delete_user()
RETURNS void AS $$
BEGIN
  -- Delete user's meals (also handled by CASCADE, but explicit for clarity)
  DELETE FROM meals WHERE user_id = auth.uid();

  -- Delete user's cravings log
  DELETE FROM cravings_log WHERE user_id = auth.uid();

  -- Delete user's profile
  DELETE FROM profiles WHERE id = auth.uid();

  -- Note: The actual auth.users deletion should be handled separately
  -- via Supabase admin API or RPC with service role
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on delete_user function
GRANT EXECUTE ON FUNCTION delete_user() TO authenticated;
