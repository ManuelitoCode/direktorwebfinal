/*
  # Add tournament slugs for human-readable URLs

  1. Schema Updates
    - Add `slug` column to tournaments table
    - Add unique constraint to ensure slugs are unique
    - Add index for efficient slug lookups

  2. Comments
    - Document the purpose of the slug field
*/

-- Add slug field to tournaments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'slug'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN slug text;
  END IF;
END $$;

-- Add unique constraint to slug field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'tournaments' AND column_name = 'slug'
  ) THEN
    ALTER TABLE tournaments ADD CONSTRAINT tournaments_slug_key UNIQUE (slug);
  END IF;
END $$;

-- Add index for slug lookups
CREATE INDEX IF NOT EXISTS idx_tournaments_slug ON tournaments(slug);

-- Add comment
COMMENT ON COLUMN tournaments.slug IS 'Human-readable unique identifier for tournament URLs';