/*
  # Add slug column to tournaments table

  1. New Columns
    - `slug` (text, unique, nullable initially for existing records)
      - URL-friendly identifier for tournaments
      - Used for public sharing and SEO-friendly URLs

  2. Indexes
    - Add unique index on slug column for fast lookups
    - Add index for public sharing queries

  3. Security
    - Update RLS policies to include slug-based access
    - Ensure public can read tournaments by slug when sharing is enabled

  4. Data Migration
    - Generate slugs for existing tournaments based on their names
    - Handle duplicate slug scenarios
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
CREATE UNIQUE INDEX IF NOT EXISTS tournaments_slug_key ON tournaments(slug);

-- Create index for public sharing queries
CREATE INDEX IF NOT EXISTS idx_tournaments_slug_public ON tournaments(slug, public_sharing_enabled);

-- Update existing tournaments with generated slugs
DO $$
DECLARE
  tournament_record RECORD;
  base_slug text;
  final_slug text;
  counter integer;
BEGIN
  -- Loop through tournaments that don't have slugs
  FOR tournament_record IN 
    SELECT id, name FROM tournaments WHERE slug IS NULL
  LOOP
    -- Generate base slug from tournament name
    base_slug := lower(regexp_replace(
      regexp_replace(tournament_record.name, '[^a-zA-Z0-9\s-]', '', 'g'),
      '\s+', '-', 'g'
    ));
    
    -- Ensure slug is not empty
    IF base_slug = '' OR base_slug IS NULL THEN
      base_slug := 'tournament';
    END IF;
    
    -- Check if base slug exists, if so add counter
    final_slug := base_slug;
    counter := 1;
    
    WHILE EXISTS (SELECT 1 FROM tournaments WHERE slug = final_slug AND id != tournament_record.id) LOOP
      final_slug := base_slug || '-' || counter;
      counter := counter + 1;
    END LOOP;
    
    -- Update the tournament with the final slug
    UPDATE tournaments 
    SET slug = final_slug 
    WHERE id = tournament_record.id;
  END LOOP;
END $$;

-- Make slug column NOT NULL after populating existing records
ALTER TABLE tournaments ALTER COLUMN slug SET NOT NULL;

-- Update RLS policies to support slug-based access
DROP POLICY IF EXISTS "Public can read tournaments for sharing" ON tournaments;

CREATE POLICY "Public can read tournaments for sharing"
  ON tournaments
  FOR SELECT
  TO anon, authenticated
  USING (public_sharing_enabled = true);

-- Add policy for slug-based access
CREATE POLICY "Public can read tournaments by slug"
  ON tournaments
  FOR SELECT
  TO anon, authenticated
  USING (slug IS NOT NULL AND public_sharing_enabled = true);