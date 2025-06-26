/*
  # Add Team Management with Logos and Flags

  1. New Tables
    - `teams`
      - `id` (uuid, primary key)
      - `tournament_id` (uuid, foreign key)
      - `name` (text, team name)
      - `logo_url` (text, optional team logo URL)
      - `country` (text, optional country code for flag)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `teams` table
    - Add policies for authenticated users to manage teams

  3. Storage
    - Create storage bucket for team logos
    - Set up RLS policies for logo access

  4. Indexes
    - Add indexes for efficient team queries
*/

-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name text NOT NULL,
  logo_url text,
  country text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tournament_id, name)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_teams_tournament_id ON teams(tournament_id);
CREATE INDEX IF NOT EXISTS idx_teams_name ON teams(tournament_id, name);

-- Enable RLS on teams table
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for teams
CREATE POLICY "Users can create teams"
  ON teams
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can read teams"
  ON teams
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Users can update teams"
  ON teams
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete teams"
  ON teams
  FOR DELETE
  TO authenticated
  USING (true);

-- Create storage bucket for team logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-logos', 'team-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for team logos
CREATE POLICY "Anyone can view team logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'team-logos');

CREATE POLICY "Authenticated users can upload team logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'team-logos');

CREATE POLICY "Authenticated users can update team logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'team-logos');

CREATE POLICY "Authenticated users can delete team logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'team-logos');

-- Add comments
COMMENT ON TABLE teams IS 'Team information including logos and country flags for team tournaments';
COMMENT ON COLUMN teams.logo_url IS 'URL to team logo image stored in Supabase storage';
COMMENT ON COLUMN teams.country IS 'Country code (ISO 3166-1 alpha-2) for flag display';