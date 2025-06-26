/*
  # Add password protection for tournaments

  1. Schema Updates
    - Add `password` column to tournaments table for optional protection
    - Add `is_password_protected` boolean for quick filtering

  2. Comments
    - Document password protection feature
*/

-- Add password protection to tournaments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'password'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN password text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'is_password_protected'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN is_password_protected boolean DEFAULT false;
  END IF;
END $$;

-- Add index for password-protected tournaments
CREATE INDEX IF NOT EXISTS idx_tournaments_password_protected ON tournaments(is_password_protected);

-- Add comments
COMMENT ON COLUMN tournaments.password IS 'Optional password for protecting tournament access';
COMMENT ON COLUMN tournaments.is_password_protected IS 'Quick flag to check if tournament requires password';