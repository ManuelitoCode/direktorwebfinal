/*
  # Add tournament_id to results table for direct relationship

  1. Schema Updates
    - Add `tournament_id` column to results table
    - Create foreign key relationship to tournaments table
    - Populate existing records with tournament_id from pairings
    - Add index for performance

  2. Security
    - Update RLS policies to use tournament_id for access control
    - Allow tournament directors to manage their own results
    - Allow public read access for tournament sharing

  3. Performance
    - Add index on tournament_id for efficient querying
*/

-- Add tournament_id column to results table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'results' AND column_name = 'tournament_id'
  ) THEN
    ALTER TABLE results ADD COLUMN tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Populate tournament_id for existing results
UPDATE results 
SET tournament_id = p.tournament_id
FROM pairings p
WHERE results.pairing_id = p.id
AND results.tournament_id IS NULL;

-- Make tournament_id NOT NULL after populating existing data
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'results' AND column_name = 'tournament_id' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE results ALTER COLUMN tournament_id SET NOT NULL;
  END IF;
END $$;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_results_tournament_id ON results(tournament_id);

-- Update RLS policies to use tournament_id
DROP POLICY IF EXISTS "Allow all authenticated users to read results" ON results;
DROP POLICY IF EXISTS "Allow authenticated users to insert results" ON results;
DROP POLICY IF EXISTS "Allow authenticated users to update results" ON results;
DROP POLICY IF EXISTS "Allow authenticated users to delete results" ON results;

-- Allow tournament directors to manage their own results
CREATE POLICY "Directors can read own tournament results"
  ON results
  FOR SELECT
  TO authenticated
  USING (
    tournament_id IN (
      SELECT id FROM tournaments WHERE director_id = auth.uid()
    )
  );

-- Allow public read access for tournament sharing (public tournament view)
CREATE POLICY "Public can read results for sharing"
  ON results
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Directors can insert results for own tournaments"
  ON results
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tournament_id IN (
      SELECT id FROM tournaments WHERE director_id = auth.uid()
    )
  );

CREATE POLICY "Directors can update results for own tournaments"
  ON results
  FOR UPDATE
  TO authenticated
  USING (
    tournament_id IN (
      SELECT id FROM tournaments WHERE director_id = auth.uid()
    )
  );

CREATE POLICY "Directors can delete results for own tournaments"
  ON results
  FOR DELETE
  TO authenticated
  USING (
    tournament_id IN (
      SELECT id FROM tournaments WHERE director_id = auth.uid()
    )
  );

-- Function to automatically set tournament_id when inserting results
CREATE OR REPLACE FUNCTION set_result_tournament_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Get tournament_id from the pairing
  SELECT tournament_id INTO NEW.tournament_id
  FROM pairings
  WHERE id = NEW.pairing_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically set tournament_id on insert
DROP TRIGGER IF EXISTS set_result_tournament_id_trigger ON results;
CREATE TRIGGER set_result_tournament_id_trigger
  BEFORE INSERT ON results
  FOR EACH ROW
  WHEN (NEW.tournament_id IS NULL)
  EXECUTE FUNCTION set_result_tournament_id();

-- Add comment explaining the relationship
COMMENT ON COLUMN results.tournament_id IS 'Direct reference to tournament for efficient querying and RLS policies';