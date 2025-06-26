/*
  # Create prompts and logic_blocks tables

  1. New Tables
    - `prompts`
      - `id` (uuid, primary key)
      - `title` (text)
      - `content` (text, long form content)
      - `category` (text, for organizing prompts)
      - `created_at` (timestamp)
    - `logic_blocks`
      - `id` (uuid, primary key)
      - `title` (text)
      - `description` (text)
      - `logic_code` (text, long form logic/code)
      - `feature_name` (text, for feature-specific queries)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Allow public read access for app functionality
    - Restrict write access to authenticated users

  3. Indexes
    - Add indexes for efficient querying by category and feature_name
*/

-- Create prompts table
CREATE TABLE IF NOT EXISTS prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  category text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create logic_blocks table
CREATE TABLE IF NOT EXISTS logic_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  logic_code text NOT NULL,
  feature_name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompts(category);
CREATE INDEX IF NOT EXISTS idx_logic_blocks_feature ON logic_blocks(feature_name);

-- Enable RLS
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE logic_blocks ENABLE ROW LEVEL SECURITY;

-- Allow public read access for app functionality
CREATE POLICY "Public can read prompts"
  ON prompts
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can read logic blocks"
  ON logic_blocks
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Restrict write access to authenticated users
CREATE POLICY "Authenticated users can manage prompts"
  ON prompts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage logic blocks"
  ON logic_blocks
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert initial prompts
INSERT INTO prompts (title, content, category) VALUES
(
  'Tournament Setup Wizard Introduction',
  'Welcome to the Tournament Setup Wizard. This intelligent assistant will help you choose the optimal pairing system for your tournament based on your specific goals and requirements. Answer a few strategic questions to get personalized recommendations.',
  'tournament_setup'
),
(
  'Pairing System Explanation',
  'Different pairing systems serve different tournament goals. Swiss system prioritizes fairness and accurate rankings. King of the Hill maximizes suspense and excitement. Fonte-Swiss provides the highest level of competitive integrity for elite events.',
  'pairing_systems'
),
(
  'Gibsonization Explanation',
  'Gibsonization occurs when a player is mathematically guaranteed a prize position. These players are paired together or with non-contenders to maintain competitive balance while preserving tournament integrity.',
  'gibsonization'
),
(
  'Team Mode Introduction',
  'Team Mode enables team-based competition where players are grouped into teams. Each team plays against every other team in a round-robin format, with all players from one team playing all players from the opposing team.',
  'team_mode'
);

-- Insert initial logic blocks
INSERT INTO logic_blocks (title, description, logic_code, feature_name) VALUES
(
  'Swiss Pairing Algorithm',
  'Core logic for generating Swiss system pairings with Gibsonization support',
  'function generateSwissPairings(players, avoidRematches, previousPairings) {
    // Sort players by current standings
    const sortedPlayers = players.sort((a, b) => {
      if (a.points !== b.points) return b.points - a.points;
      if (a.spread !== b.spread) return b.spread - a.spread;
      return b.rating - a.rating;
    });
    
    // Handle Gibsonized players first
    const gibsonizedPlayers = sortedPlayers.filter(p => p.is_gibsonized);
    const nonGibsonizedPlayers = sortedPlayers.filter(p => !p.is_gibsonized);
    
    // Pair Gibsonized players together
    // Then pair remaining players using standard Swiss logic
    return pairings;
  }',
  'swiss_pairing'
),
(
  'Team Round Robin Logic',
  'Logic for generating team-based round robin schedules',
  'function generateTeamRoundRobin(teams) {
    const totalTeams = teams.length;
    const totalRounds = totalTeams - 1;
    const schedule = [];
    
    for (let round = 0; round < totalRounds; round++) {
      const roundMatchups = [];
      // Generate matchups for this round
      // Each team plays every other team once
      schedule.push(roundMatchups);
    }
    
    return schedule;
  }',
  'team_pairing'
),
(
  'Gibsonization Detection',
  'Algorithm to detect when players are mathematically guaranteed prize positions',
  'function calculateGibsonization(players, currentRound, totalRounds) {
    const remainingRounds = totalRounds - currentRound + 1;
    const prizeThreshold = Math.ceil(players.length * 0.25);
    
    return players.map(player => {
      const maxPossiblePoints = player.points + remainingRounds;
      const competitorPoints = players
        .filter(p => p.rank > prizeThreshold)
        .map(p => p.points + remainingRounds);
      
      const isGibsonized = player.points > Math.max(...competitorPoints, 0);
      return { ...player, is_gibsonized: isGibsonized };
    });
  }',
  'gibsonization'
),
(
  'Standings Impact Analysis',
  'Logic for analyzing how different round outcomes affect final standings',
  'function analyzeStandingsImpact(currentStandings, mockResults) {
    const simulatedStandings = currentStandings.map(standing => ({ ...standing }));
    
    // Apply mock results
    mockResults.forEach(result => {
      // Update player standings based on simulated results
      // Calculate rank changes and impact tags
    });
    
    // Sort and assign new ranks
    simulatedStandings.sort((a, b) => {
      if (a.points !== b.points) return b.points - a.points;
      if (a.spread !== b.spread) return b.spread - a.spread;
      return b.rating - a.rating;
    });
    
    return simulatedStandings;
  }',
  'standings_impact'
);