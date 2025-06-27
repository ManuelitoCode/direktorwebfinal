/*
  # Add tournament enhancements for public sharing

  1. Schema Updates
    - Add `password` field to tournaments table for optional protection
    - Add `public_sharing_enabled` boolean field
    - Add `share_settings` jsonb field for sharing configuration

  2. Indexes
    - Add index for public sharing queries
*/

-- Add password protection and sharing settings to tournaments
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
    WHERE table_name = 'tournaments' AND column_name = 'public_sharing_enabled'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN public_sharing_enabled boolean DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'share_settings'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN share_settings jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add index for public sharing
CREATE INDEX IF NOT EXISTS idx_tournaments_public_sharing ON tournaments(public_sharing_enabled);

-- Add comments
COMMENT ON COLUMN tournaments.password IS 'Optional password for tournament access protection';
COMMENT ON COLUMN tournaments.public_sharing_enabled IS 'Whether this tournament can be viewed publicly';
COMMENT ON COLUMN tournaments.share_settings IS 'JSON object storing sharing preferences and social media settings';