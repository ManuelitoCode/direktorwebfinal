/*
  # Add Team Mode Support

  1. Schema Updates
    - Add `team_name` column to players table
    - Add `team_mode` boolean to tournaments table
    - Add team-related indexes for performance

  2. Comments
    - Document team functionality
*/

-- Add team_name to players table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'team_name'
  ) THEN
    ALTER TABLE players ADD COLUMN team_name text;
  END IF;
END $$;

-- Add team_mode to tournaments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'team_mode'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN team_mode boolean DEFAULT false;
  END IF;
END $$;

-- Add indexes for team queries
CREATE INDEX IF NOT EXISTS idx_players_team_name ON players(tournament_id, team_name);
CREATE INDEX IF NOT EXISTS idx_tournaments_team_mode ON tournaments(team_mode);

-- Add comments
COMMENT ON COLUMN players.team_name IS 'Team name for team-based tournaments (null for individual tournaments)';
COMMENT ON COLUMN tournaments.team_mode IS 'Whether this tournament uses team-based competition';