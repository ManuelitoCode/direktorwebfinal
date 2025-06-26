export interface Player {
  id?: string;
  name: string;
  rating: number;
  tournament_id: string;
  team_name?: string; // Added for team mode
  created_at?: string;
}

export interface Tournament {
  id: string;
  name: string;
  date?: string;
  venue?: string;
  rounds?: number;
  divisions?: number;
  director_id?: string;
  current_round?: number;
  status?: 'setup' | 'registration' | 'active' | 'completed' | 'paused';
  last_activity?: string;
  created_at: string;
  team_mode?: boolean; // Added for team mode
  // Tournament configuration
  pairing_system?: PairingFormat;
  wizard_responses?: WizardResponses;
  tournament_config?: TournamentConfig;
}

export interface Division {
  id?: string;
  tournament_id: string;
  name: string;
  division_number: number;
  created_at?: string;
}

export interface Sponsor {
  id?: string;
  tournament_id: string;
  name?: string;
  logo_url: string;
  website_link?: string;
  display_order: number;
  created_at?: string;
}

// Team Management Types
export interface Team {
  id?: string;
  tournament_id: string;
  name: string;
  logo_url?: string;
  country?: string;
  created_at?: string;
}

export interface ParsedPlayer {
  name: string;
  rating: number;
  team_name?: string; // Added for team mode
  isValid: boolean;
  error?: string;
}

export interface Pairing {
  id?: string;
  round_number: number;
  tournament_id: string;
  table_number: number;
  player1_id: string;
  player2_id: string;
  player1_rank: number;
  player2_rank: number;
  first_move_player_id: string;
  player1_gibsonized?: boolean;
  player2_gibsonized?: boolean;
  created_at?: string;
}

export interface PlayerWithRank extends Player {
  rank: number;
  previous_starts: number;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  spread: number;
  is_gibsonized: boolean;
}

export interface PairingDisplay {
  table_number: number;
  player1: PlayerWithRank;
  player2: PlayerWithRank;
  first_move_player_id: string;
  player1_gibsonized?: boolean;
  player2_gibsonized?: boolean;
}

export interface PairingWithPlayers extends Pairing {
  player1: Player;
  player2: Player;
}

export interface Result {
  id?: string;
  pairing_id: string;
  tournament_id: string; // Added tournament_id for direct relationship
  round_number: number;
  player1_score: number;
  player2_score: number;
  winner_id: string | null;
  submitted_by: string | null;
  created_at?: string;
}

// Team Mode Types
export interface TeamStanding {
  team_name: string;
  matches_won: number;
  matches_lost: number;
  matches_drawn: number;
  total_games_won: number;
  total_games_lost: number;
  total_spread: number;
  players: Player[];
  rank: number;
  team_info?: Team; // Added for logo and flag display
}

export interface TeamMatchResult {
  round_number: number;
  team1_name: string;
  team2_name: string;
  team1_games_won: number;
  team2_games_won: number;
  team1_spread: number;
  team2_spread: number;
  winner_team?: string;
  individual_results: Array<{
    player1_name: string;
    player2_name: string;
    player1_score: number;
    player2_score: number;
    winner_name?: string;
  }>;
}

export type PairingFormat = 'swiss' | 'fonte-swiss' | 'king-of-hill' | 'round-robin' | 'quartile' | 'manual' | 'team-round-robin';

// Pairing Strategy Intelligence Types
export interface PairingGoal {
  id: string;
  name: string;
  description: string;
  importance: 'critical' | 'high' | 'medium' | 'low';
}

export interface PairingSystemAnalysis {
  format: PairingFormat;
  goals: Record<string, {
    score: number; // 0-10 scale
    explanation: string;
    status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  }>;
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  bestFor: string[];
  avoidIf: string[];
}

export interface DirectorIntent {
  primary: string;
  secondary?: string;
  playerCount: number;
  rounds: number;
  competitiveLevel: 'casual' | 'competitive' | 'elite';
  priorityGoals: string[];
}

// Tournament Setup Wizard Types
export interface WizardResponses {
  topPlayersMeeting: 'early' | 'late' | 'mixed';
  avoidRematches: boolean;
  avoidSameTeam: boolean;
  suspenseUntilEnd: boolean;
  manualPairing: boolean;
  competitiveLevel: 'casual' | 'competitive' | 'elite';
  primaryGoal: string;
}

export interface TournamentConfig {
  pairing_system: PairingFormat;
  avoid_rematches: boolean;
  wizard_completed: boolean;
  recommended_system: PairingFormat;
  recommendation_reasoning: string;
}

// Add global types for Speech Recognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}