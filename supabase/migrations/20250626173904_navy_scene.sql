/*
  # Add tournament enhancements for public sharing

  1. Schema Updates
    - Add `password_protected` boolean to tournaments table
    - Add `access_password` text to tournaments table (hashed)
    - Add `social_sharing_enabled` boolean to tournaments table

  2. Comments
    - Document the purpose of each new field
*/

-- Add password protection and sharing features to tournaments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'password_protected'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN password_protected boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'access_password'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN access_password text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'social_sharing_enabled'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN social_sharing_enabled boolean DEFAULT true;
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN tournaments.password_protected IS 'Whether this tournament requires a password for public access';
COMMENT ON COLUMN tournaments.access_password IS 'Hashed password for tournament access (if password protected)';
COMMENT ON COLUMN tournaments.social_sharing_enabled IS 'Whether social sharing buttons are enabled for this tournament';

-- Add index for password protected tournaments
CREATE INDEX IF NOT EXISTS idx_tournaments_password_protected ON tournaments(password_protected);