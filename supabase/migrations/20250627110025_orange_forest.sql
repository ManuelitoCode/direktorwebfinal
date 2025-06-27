/*
  # Add slug column to tournaments table

  1. Schema Updates
    - Add `slug` text column to tournaments table
    - Create unique index on slug column
    - Add comment explaining slug purpose

  2. Indexes
    - Add unique index for slug lookups
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
    WHERE indexname = 'tournaments_slug_key'
  ) THEN
    CREATE UNIQUE INDEX tournaments_slug_key ON tournaments(slug);
  END IF;
END $$;

-- Add comment explaining slug purpose
COMMENT ON COLUMN tournaments.slug IS 'Human-readable URL slug for public tournament links';

-- Generate slugs for existing tournaments
UPDATE tournaments
SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || SUBSTRING(id::text, 1, 8)
WHERE slug IS NULL;