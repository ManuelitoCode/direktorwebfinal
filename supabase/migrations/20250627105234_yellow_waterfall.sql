/*
  # Add slug column to tournaments table

  1. Changes
    - Add `slug` column to `tournaments` table
    - Add unique index on `slug` column for URL uniqueness
    - Set default value for existing tournaments based on their names

  2. Security
    - No RLS changes needed as existing policies will apply to new column
*/

-- Add slug column to tournaments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'slug'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN slug text;
  END IF;
END $$;

-- Create unique index on slug column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'tournaments' AND indexname = 'tournaments_slug_key'
  ) THEN
    CREATE UNIQUE INDEX tournaments_slug_key ON tournaments (slug);
  END IF;
END $$;

-- Update existing tournaments with slugs based on their names
UPDATE tournaments 
SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'))
WHERE slug IS NULL;

-- Add index for better query performance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'tournaments' AND indexname = 'idx_tournaments_slug'
  ) THEN
    CREATE INDEX idx_tournaments_slug ON tournaments (slug);
  END IF;
END $$;