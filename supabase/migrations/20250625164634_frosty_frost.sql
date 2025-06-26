/*
  # Add tournament configuration fields

  1. Schema Updates
    - Add `pairing_system` to tournaments table
    - Add `wizard_responses` JSONB field for storing wizard answers
    - Add `tournament_config` JSONB field for storing pairing configuration

  2. Comments
    - Document the purpose of each new field
*/

-- Add pairing system configuration to tournaments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'pairing_system'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN pairing_system text DEFAULT 'swiss';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'wizard_responses'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN wizard_responses jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'tournament_config'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN tournament_config jsonb;
  END IF;
END $$;

-- Add comments to explain the new fields
COMMENT ON COLUMN tournaments.pairing_system IS 'The pairing system used for this tournament (swiss, fonte-swiss, king-of-hill, etc.)';
COMMENT ON COLUMN tournaments.wizard_responses IS 'JSON object storing responses from the pairing recommendation wizard';
COMMENT ON COLUMN tournaments.tournament_config IS 'JSON object storing tournament configuration including pairing preferences and AI recommendations';

-- Add index for pairing system queries
CREATE INDEX IF NOT EXISTS idx_tournaments_pairing_system ON tournaments(pairing_system);