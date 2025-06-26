/*
  # Add password protection for tournaments

  1. Schema Updates
    - Add `password_hash` column to tournaments table
    - Add `is_password_protected` boolean column

  2. Comments
    - Document password protection functionality
*/

-- Add password protection fields to tournaments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN password_hash text;
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
COMMENT ON COLUMN tournaments.password_hash IS 'Hashed password for tournament access (optional)';
COMMENT ON COLUMN tournaments.is_password_protected IS 'Whether this tournament requires a password to view';