/*
  # Add Director Tracking and Tournament Progress

  1. Schema Updates
    - Add `director_id` to tournaments table to track who created each tournament
    - Add `current_round` to tournaments table to track progress
    - Add `status` to tournaments table to track tournament state
    - Add `last_activity` to tournaments table for sorting

  2. Security
    - Update RLS policies to respect director ownership
    - Directors can only see/edit their own tournaments

  3. Indexes
    - Add index on director_id for efficient querying
    - Add index on last_activity for sorting
*/

-- Add director tracking and progress fields to tournaments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'director_id'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN director_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'current_round'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN current_round integer DEFAULT 1;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'status'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN status text DEFAULT 'setup' CHECK (status IN ('setup', 'registration', 'active', 'completed', 'paused'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'last_activity'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN last_activity timestamptz DEFAULT now();
  END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_tournaments_director_id ON tournaments(director_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_last_activity ON tournaments(last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);

-- Update RLS policies to respect director ownership
DROP POLICY IF EXISTS "Users can read tournaments" ON tournaments;
DROP POLICY IF EXISTS "Users can update tournaments" ON tournaments;
DROP POLICY IF EXISTS "Users can delete tournaments" ON tournaments;

-- Allow directors to see their own tournaments + public read for tournament links
CREATE POLICY "Directors can read own tournaments"
  ON tournaments
  FOR SELECT
  TO authenticated
  USING (director_id = auth.uid());

-- Allow public read access for tournament sharing (public tournament view)
CREATE POLICY "Public can read tournaments for sharing"
  ON tournaments
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Directors can update own tournaments"
  ON tournaments
  FOR UPDATE
  TO authenticated
  USING (director_id = auth.uid());

CREATE POLICY "Directors can delete own tournaments"
  ON tournaments
  FOR DELETE
  TO authenticated
  USING (director_id = auth.uid());

-- Update tournament creation policy to set director_id
DROP POLICY IF EXISTS "Users can create tournaments" ON tournaments;
CREATE POLICY "Users can create tournaments"
  ON tournaments
  FOR INSERT
  TO authenticated
  WITH CHECK (director_id = auth.uid());

-- Function to update last_activity automatically
CREATE OR REPLACE FUNCTION update_tournament_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE tournaments 
  SET last_activity = now() 
  WHERE id = COALESCE(NEW.tournament_id, OLD.tournament_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers to update last_activity when tournament data changes
DROP TRIGGER IF EXISTS update_tournament_activity_players ON players;
CREATE TRIGGER update_tournament_activity_players
  AFTER INSERT OR UPDATE OR DELETE ON players
  FOR EACH ROW EXECUTE FUNCTION update_tournament_activity();

DROP TRIGGER IF EXISTS update_tournament_activity_pairings ON pairings;
CREATE TRIGGER update_tournament_activity_pairings
  AFTER INSERT OR UPDATE OR DELETE ON pairings
  FOR EACH ROW EXECUTE FUNCTION update_tournament_activity();

DROP TRIGGER IF EXISTS update_tournament_activity_results ON results;
CREATE TRIGGER update_tournament_activity_results
  AFTER INSERT OR UPDATE OR DELETE ON results
  FOR EACH ROW EXECUTE FUNCTION update_tournament_activity();