/*
  # Create tournaments and players tables

  1. New Tables
    - `tournaments`
      - `id` (uuid, primary key)
      - `name` (text, tournament name)
      - `created_at` (timestamp)
    - `players`
      - `id` (uuid, primary key)
      - `name` (text, player name)
      - `rating` (integer, player rating)
      - `tournament_id` (uuid, foreign key to tournaments)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their tournament data
*/

-- Create tournaments table
CREATE TABLE IF NOT EXISTS tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create players table
CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rating integer NOT NULL DEFAULT 1500,
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Create policies for tournaments
CREATE POLICY "Users can read tournaments"
  ON tournaments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create tournaments"
  ON tournaments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update tournaments"
  ON tournaments
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete tournaments"
  ON tournaments
  FOR DELETE
  TO authenticated
  USING (true);

-- Create policies for players
CREATE POLICY "Users can read players"
  ON players
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create players"
  ON players
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update players"
  ON players
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete players"
  ON players
  FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_players_tournament_id ON players(tournament_id);
CREATE INDEX IF NOT EXISTS idx_players_rating ON players(rating);
CREATE INDEX IF NOT EXISTS idx_tournaments_created_at ON tournaments(created_at);