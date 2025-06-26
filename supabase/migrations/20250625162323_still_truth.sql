/*
  # Add Gibsonization Support to Pairings

  1. Schema Updates
    - Add `player1_gibsonized` boolean column to pairings table
    - Add `player2_gibsonized` boolean column to pairings table
    - These flags indicate if a player was considered "Gibsonized" when the pairing was made

  2. Indexes
    - Add index for efficient querying of Gibsonized pairings

  3. Comments
    - Add helpful comments explaining Gibsonization concept
*/

-- Add Gibsonization flags to pairings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pairings' AND column_name = 'player1_gibsonized'
  ) THEN
    ALTER TABLE pairings ADD COLUMN player1_gibsonized boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pairings' AND column_name = 'player2_gibsonized'
  ) THEN
    ALTER TABLE pairings ADD COLUMN player2_gibsonized boolean DEFAULT false;
  END IF;
END $$;

-- Add index for Gibsonized player queries
CREATE INDEX IF NOT EXISTS idx_pairings_gibsonized 
  ON pairings(tournament_id, round_number, player1_gibsonized, player2_gibsonized);

-- Add comments to explain Gibsonization
COMMENT ON COLUMN pairings.player1_gibsonized IS 'True if player1 was mathematically guaranteed a prize position when this pairing was made';
COMMENT ON COLUMN pairings.player2_gibsonized IS 'True if player2 was mathematically guaranteed a prize position when this pairing was made';