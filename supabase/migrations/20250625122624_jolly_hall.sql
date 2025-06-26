/*
  # Create results table for tournament scores

  1. New Tables
    - `results`
      - `id` (uuid, primary key)
      - `pairing_id` (uuid, foreign key to pairings)
      - `round_number` (integer)
      - `player1_score` (integer)
      - `player2_score` (integer)
      - `winner_id` (uuid, foreign key to players, nullable for ties)
      - `submitted_by` (uuid, foreign key to auth.users, nullable)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `results` table
    - Add policies for authenticated users to manage results
    - Allow reading all results for authenticated users
    - Allow inserting/updating/deleting results for authenticated users

  3. Indexes
    - Index on pairing_id for efficient lookups
    - Index on round_number for round-based queries
    - Composite index on pairing_id and round_number for optimal performance
*/

CREATE TABLE IF NOT EXISTS public.results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pairing_id uuid REFERENCES public.pairings(id) ON DELETE CASCADE NOT NULL,
    round_number integer NOT NULL,
    player1_score integer NOT NULL DEFAULT 0,
    player2_score integer NOT NULL DEFAULT 0,
    winner_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
    submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_results_pairing_id ON public.results USING btree (pairing_id);
CREATE INDEX IF NOT EXISTS idx_results_round_number ON public.results USING btree (round_number);
CREATE INDEX IF NOT EXISTS idx_results_pairing_round ON public.results USING btree (pairing_id, round_number);
CREATE INDEX IF NOT EXISTS idx_results_winner_id ON public.results USING btree (winner_id);

-- RLS Policies
CREATE POLICY "Allow all authenticated users to read results"
ON public.results FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert results"
ON public.results FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update results"
ON public.results FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to delete results"
ON public.results FOR DELETE
TO authenticated
USING (true);