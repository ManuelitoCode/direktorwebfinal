/*
  # Add Tournament Fields

  1. New Columns
    - Add `date` field to tournaments table
    - Add `venue` field to tournaments table  
    - Add `rounds` field to tournaments table
    - Add `divisions` field to tournaments table

  2. New Tables
    - `divisions` table for multi-division tournaments
      - `id` (uuid, primary key)
      - `tournament_id` (uuid, foreign key)
      - `name` (text)
      - `division_number` (integer)
      - `created_at` (timestamp)

  3. Security
    - Enable RLS on `divisions` table
    - Add policies for authenticated users
*/

-- Add new fields to tournaments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'date'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN date date;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'venue'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN venue text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'rounds'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN rounds integer DEFAULT 6;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'divisions'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN divisions integer DEFAULT 1;
  END IF;
END $$;

-- Create divisions table
CREATE TABLE IF NOT EXISTS divisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name text NOT NULL,
  division_number integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for divisions
CREATE INDEX IF NOT EXISTS idx_divisions_tournament_id ON divisions(tournament_id);
CREATE INDEX IF NOT EXISTS idx_divisions_number ON divisions(tournament_id, division_number);

-- Enable RLS on divisions table
ALTER TABLE divisions ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for divisions
CREATE POLICY "Users can create divisions"
  ON divisions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can read divisions"
  ON divisions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update divisions"
  ON divisions
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete divisions"
  ON divisions
  FOR DELETE
  TO authenticated
  USING (true);