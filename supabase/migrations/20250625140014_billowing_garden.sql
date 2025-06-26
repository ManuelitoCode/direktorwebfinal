/*
  # Create sponsors table for tournament sponsor management

  1. New Tables
    - `sponsors`
      - `id` (uuid, primary key)
      - `tournament_id` (uuid, foreign key)
      - `name` (text, optional sponsor name)
      - `logo_url` (text, Supabase Storage URL)
      - `website_link` (text, optional website URL)
      - `display_order` (integer, for ordering sponsors)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `sponsors` table
    - Add policies for authenticated users to manage sponsors

  3. Storage
    - Create storage bucket for sponsor logos
    - Set up RLS policies for logo access
*/

-- Create sponsors table
CREATE TABLE IF NOT EXISTS sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name text,
  logo_url text NOT NULL,
  website_link text,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_sponsors_tournament_id ON sponsors(tournament_id);
CREATE INDEX IF NOT EXISTS idx_sponsors_display_order ON sponsors(tournament_id, display_order);

-- Enable RLS on sponsors table
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for sponsors
CREATE POLICY "Users can create sponsors"
  ON sponsors
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can read sponsors"
  ON sponsors
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Users can update sponsors"
  ON sponsors
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete sponsors"
  ON sponsors
  FOR DELETE
  TO authenticated
  USING (true);

-- Create storage bucket for sponsor logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('sponsor-logos', 'sponsor-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for sponsor logos
CREATE POLICY "Anyone can view sponsor logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'sponsor-logos');

CREATE POLICY "Authenticated users can upload sponsor logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'sponsor-logos');

CREATE POLICY "Authenticated users can update sponsor logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'sponsor-logos');

CREATE POLICY "Authenticated users can delete sponsor logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'sponsor-logos');