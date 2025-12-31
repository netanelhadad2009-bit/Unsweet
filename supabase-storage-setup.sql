-- Supabase Storage Setup for Meal Images
-- Run this in your Supabase SQL Editor to create the storage bucket

-- Step 1: Create the storage bucket for meal images
-- This needs to be done via the Supabase Dashboard or API:
-- 1. Go to Storage in your Supabase Dashboard
-- 2. Click "New bucket"
-- 3. Name it "meal-images"
-- 4. Set it to PUBLIC (so images can be viewed without authentication)
-- 5. Click Create

-- Step 2: Set up storage policies to allow authenticated users to upload
-- Run these SQL commands in the SQL Editor:

-- Allow authenticated users to upload images to their own folder
CREATE POLICY "Users can upload their own meal images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'meal-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update their own images
CREATE POLICY "Users can update their own meal images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'meal-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own images
CREATE POLICY "Users can delete their own meal images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'meal-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow anyone to view images (public bucket)
CREATE POLICY "Anyone can view meal images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'meal-images');
