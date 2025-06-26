/*
  # Create pairings table for tournament rounds

  1. New Tables
    - `pairings`
      - `id` (uuid, primary key)
      - `round_number` (integer)
      - `tournament_id` (uuid, foreign key)
      - `table_number` (integer)
      - `player1_id` (uuid, foreign key)
      - `player2_id` (uuid, foreign key)
      - `player1_rank` (integer)
      - `player2_rank` (integer)
      - `first_move_player_id` (uuid, foreign key)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `pairings` table
    - Add policies for authenticated users to manage pairings

  3. Indexes
    - Add indexes for efficient querying by tournament and round
*/

CREATE TABLE IF NOT EXISTS pairings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_number integer NOT NULL,
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  table_number integer NOT NULL,
  player1_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  player2_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  player1_rank integer NOT NULL,
  player2_rank integer NOT NULL,
  first_move_player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pairings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage pairings"
  ON pairings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pairings_tournament_round 
  ON pairings(tournament_id, round_number);

CREATE INDEX IF NOT EXISTS idx_pairings_players 
  ON pairings(player1_id, player2_id);

CREATE INDEX IF NOT EXISTS idx_pairings_first_move 
  ON pairings(first_move_player_id);