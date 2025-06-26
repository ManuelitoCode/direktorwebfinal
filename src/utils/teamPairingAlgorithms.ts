import { PlayerWithRank, PairingDisplay, Player } from '../types/database';

export interface TeamPairingResult {
  pairings: PairingDisplay[];
  teamMatchups: Array<{
    team1: string;
    team2: string;
    tables: number[];
  }>;
}

export function generateTeamRoundRobinPairings(
  players: PlayerWithRank[],
  currentRound: number,
  previousTeamMatchups: Array<{ team1: string; team2: string }> = []
): TeamPairingResult {
  // Group players by team
  const teams = new Map<string, PlayerWithRank[]>();
  
  players.forEach(player => {
    if (!player.team_name) return;
    
    if (!teams.has(player.team_name)) {
      teams.set(player.team_name, []);
    }
    teams.get(player.team_name)!.push(player);
  });

  const teamNames = Array.from(teams.keys()).sort();
  const pairings: PairingDisplay[] = [];
  const teamMatchups: Array<{ team1: string; team2: string; tables: number[] }> = [];
  let tableNumber = 1;

  // Generate round-robin schedule for teams
  const totalTeams = teamNames.length;
  if (totalTeams < 2) {
    throw new Error('Need at least 2 teams for team round-robin');
  }

  // Create round-robin schedule
  const schedule = generateRoundRobinSchedule(teamNames);
  
  if (currentRound > schedule.length) {
    throw new Error(`Round ${currentRound} exceeds maximum rounds (${schedule.length})`);
  }

  const roundMatchups = schedule[currentRound - 1];

  for (const matchup of roundMatchups) {
    const team1Players = teams.get(matchup.team1) || [];
    const team2Players = teams.get(matchup.team2) || [];
    
    if (team1Players.length === 0 || team2Players.length === 0) {
      continue;
    }

    const matchTables: number[] = [];

    // Create all possible pairings between the two teams
    for (let i = 0; i < team1Players.length; i++) {
      for (let j = 0; j < team2Players.length; j++) {
        const player1 = team1Players[i];
        const player2 = team2Players[j];
        
        const firstMovePlayerId = determineFirstMove(player1, player2, tableNumber);
        
        pairings.push({
          table_number: tableNumber,
          player1,
          player2,
          first_move_player_id: firstMovePlayerId,
          player1_gibsonized: false, // Team mode doesn't use Gibsonization
          player2_gibsonized: false
        });

        matchTables.push(tableNumber);
        tableNumber++;
      }
    }

    teamMatchups.push({
      team1: matchup.team1,
      team2: matchup.team2,
      tables: matchTables
    });
  }

  return { pairings, teamMatchups };
}

function generateRoundRobinSchedule(teams: string[]): Array<Array<{ team1: string; team2: string }>> {
  const schedule: Array<Array<{ team1: string; team2: string }>> = [];
  const teamCount = teams.length;
  
  if (teamCount % 2 === 1) {
    // Add a "bye" team for odd number of teams
    teams.push('BYE');
  }
  
  const totalRounds = teams.length - 1;
  const teamsForScheduling = [...teams]; // Create a copy to manipulate
  
  for (let round = 0; round < totalRounds; round++) {
    const roundMatchups: Array<{ team1: string; team2: string }> = [];
    
    for (let i = 0; i < teamsForScheduling.length / 2; i++) {
      const team1Index = i;
      const team2Index = teamsForScheduling.length - 1 - i;
      
      const team1 = teamsForScheduling[team1Index];
      const team2 = teamsForScheduling[team2Index];
      
      // Skip if one team is "BYE"
      if (team1 !== 'BYE' && team2 !== 'BYE') {
        roundMatchups.push({ team1, team2 });
      }
    }
    
    schedule.push(roundMatchups);
    
    // Rotate teams (keep first team fixed, rotate others)
    if (teamsForScheduling.length > 2) {
      const lastTeam = teamsForScheduling.pop()!;
      teamsForScheduling.splice(1, 0, lastTeam);
    }
  }
  
  return schedule;
}

function determineFirstMove(
  player1: PlayerWithRank,
  player2: PlayerWithRank,
  tableNumber: number
): string {
  // Player with fewer previous starts goes first
  if (player1.previous_starts < player2.previous_starts) {
    return player1.id!;
  } else if (player2.previous_starts < player1.previous_starts) {
    return player2.id!;
  } else {
    // If equal starts, alternate by table number
    return tableNumber % 2 === 1 ? player1.id! : player2.id!;
  }
}

export function calculateTeamStandings(
  players: Player[],
  results: any[],
  pairings: any[]
): Array<{
  team_name: string;
  matches_won: number;
  matches_lost: number;
  matches_drawn: number;
  total_games_won: number;
  total_games_lost: number;
  total_spread: number;
  players: Player[];
  rank: number;
}> {
  // Group players by team
  const teams = new Map<string, Player[]>();
  
  players.forEach(player => {
    if (!player.team_name) return;
    
    if (!teams.has(player.team_name)) {
      teams.set(player.team_name, []);
    }
    teams.get(player.team_name)!.push(player);
  });

  const teamStandings = Array.from(teams.entries()).map(([teamName, teamPlayers]) => {
    let totalGamesWon = 0;
    let totalGamesLost = 0;
    let totalSpread = 0;
    
    // Calculate individual game statistics
    teamPlayers.forEach(player => {
      results.forEach(result => {
        const pairing = pairings.find(p => p.id === result.pairing_id);
        if (!pairing) return;

        const isPlayer1 = pairing.player1_id === player.id;
        const isPlayer2 = pairing.player2_id === player.id;

        if (!isPlayer1 && !isPlayer2) return;

        const playerScore = isPlayer1 ? result.player1_score : result.player2_score;
        const opponentScore = isPlayer1 ? result.player2_score : result.player1_score;

        totalSpread += playerScore - opponentScore;

        if (playerScore > opponentScore) {
          totalGamesWon++;
        } else if (playerScore < opponentScore) {
          totalGamesLost++;
        }
      });
    });

    // Calculate team match results
    const teamMatches = calculateTeamMatches(teamName, teamPlayers, results, pairings, teams);
    
    return {
      team_name: teamName,
      matches_won: teamMatches.won,
      matches_lost: teamMatches.lost,
      matches_drawn: teamMatches.drawn,
      total_games_won: totalGamesWon,
      total_games_lost: totalGamesLost,
      total_spread: totalSpread,
      players: teamPlayers,
      rank: 0 // Will be assigned after sorting
    };
  });

  // Sort teams by matches won, then by total spread
  teamStandings.sort((a, b) => {
    if (a.matches_won !== b.matches_won) return b.matches_won - a.matches_won;
    if (a.total_spread !== b.total_spread) return b.total_spread - a.total_spread;
    return b.total_games_won - a.total_games_won;
  });

  // Assign ranks
  teamStandings.forEach((standing, index) => {
    standing.rank = index + 1;
  });

  return teamStandings;
}

function calculateTeamMatches(
  teamName: string,
  teamPlayers: Player[],
  results: any[],
  pairings: any[],
  allTeams: Map<string, Player[]>
): { won: number; lost: number; drawn: number } {
  const teamPlayerIds = new Set(teamPlayers.map(p => p.id));
  const matchResults = new Map<string, { teamGamesWon: number; opponentGamesWon: number }>();

  // Group results by opposing team
  results.forEach(result => {
    const pairing = pairings.find(p => p.id === result.pairing_id);
    if (!pairing) return;

    const player1 = teamPlayers.find(p => p.id === pairing.player1_id);
    const player2 = teamPlayers.find(p => p.id === pairing.player2_id);

    // Skip if both players are from the same team
    if (player1 && player2) return;

    let ourPlayer: Player | undefined;
    let opponentTeam: string | undefined;

    if (player1) {
      ourPlayer = player1;
      // Find opponent's team
      for (const [otherTeamName, otherTeamPlayers] of allTeams.entries()) {
        if (otherTeamName !== teamName && otherTeamPlayers.some(p => p.id === pairing.player2_id)) {
          opponentTeam = otherTeamName;
          break;
        }
      }
    } else if (player2) {
      ourPlayer = player2;
      // Find opponent's team
      for (const [otherTeamName, otherTeamPlayers] of allTeams.entries()) {
        if (otherTeamName !== teamName && otherTeamPlayers.some(p => p.id === pairing.player1_id)) {
          opponentTeam = otherTeamName;
          break;
        }
      }
    }

    if (!ourPlayer || !opponentTeam) return;

    if (!matchResults.has(opponentTeam)) {
      matchResults.set(opponentTeam, { teamGamesWon: 0, opponentGamesWon: 0 });
    }

    const matchData = matchResults.get(opponentTeam)!;
    const isPlayer1 = pairing.player1_id === ourPlayer.id;
    const ourScore = isPlayer1 ? result.player1_score : result.player2_score;
    const opponentScore = isPlayer1 ? result.player2_score : result.player1_score;

    if (ourScore > opponentScore) {
      matchData.teamGamesWon++;
    } else if (ourScore < opponentScore) {
      matchData.opponentGamesWon++;
    }
  });

  // Determine match outcomes
  let matchesWon = 0;
  let matchesLost = 0;
  let matchesDrawn = 0;

  matchResults.forEach(({ teamGamesWon, opponentGamesWon }) => {
    if (teamGamesWon > opponentGamesWon) {
      matchesWon++;
    } else if (teamGamesWon < opponentGamesWon) {
      matchesLost++;
    } else {
      matchesDrawn++;
    }
  });

  return { won: matchesWon, lost: matchesLost, drawn: matchesDrawn };
}