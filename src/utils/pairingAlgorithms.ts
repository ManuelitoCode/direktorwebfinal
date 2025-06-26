import { PlayerWithRank, PairingDisplay, PairingFormat } from '../types/database';

export function generatePairings(
  players: PlayerWithRank[],
  format: PairingFormat,
  avoidRematches: boolean,
  previousPairings: Array<{ player1_id: string; player2_id: string }> = [],
  currentRound: number = 1,
  totalRounds: number = 7
): PairingDisplay[] {
  // Calculate current standings and Gibsonization status
  const playersWithGibsonization = calculateGibsonization(players, currentRound, totalRounds);
  
  // Sort players by current standings (points, then spread, then rating)
  const sortedPlayers = [...playersWithGibsonization].sort((a, b) => {
    if (a.points !== b.points) return b.points - a.points;
    if (a.spread !== b.spread) return b.spread - a.spread;
    return b.rating - a.rating;
  });
  
  // Assign current ranks based on standings
  sortedPlayers.forEach((player, index) => {
    player.rank = index + 1;
  });

  switch (format) {
    case 'swiss':
      return generateSwissPairings(sortedPlayers, avoidRematches, previousPairings);
    case 'fonte-swiss':
      return generateFonteSwissPairings(sortedPlayers, avoidRematches, previousPairings);
    case 'king-of-hill':
      return generateKingOfHillPairings(sortedPlayers, avoidRematches, previousPairings);
    case 'round-robin':
      return generateRoundRobinPairings(sortedPlayers, avoidRematches, previousPairings);
    case 'quartile':
      return generateQuartilePairings(sortedPlayers, avoidRematches, previousPairings);
    case 'manual':
      return generateManualPairings(sortedPlayers);
    default:
      return generateSwissPairings(sortedPlayers, avoidRematches, previousPairings);
  }
}

function calculateGibsonization(
  players: PlayerWithRank[],
  currentRound: number,
  totalRounds: number
): PlayerWithRank[] {
  const remainingRounds = totalRounds - currentRound + 1;
  const totalPlayers = players.length;
  
  // Calculate prize thresholds (top quarter for first place, top half for podium)
  const firstPlaceThreshold = Math.ceil(totalPlayers * 0.25);
  const podiumThreshold = Math.ceil(totalPlayers * 0.5);
  
  return players.map(player => {
    let isGibsonized = false;
    
    // Sort all players by current standings to determine position
    const sortedByStandings = [...players].sort((a, b) => {
      if (a.points !== b.points) return b.points - a.points;
      if (a.spread !== b.spread) return b.spread - a.spread;
      return b.rating - a.rating;
    });
    
    const currentPosition = sortedByStandings.findIndex(p => p.id === player.id) + 1;
    const maxPossiblePoints = player.points + remainingRounds;
    
    // Check if player is guaranteed first place
    if (currentPosition <= firstPlaceThreshold) {
      // Find the highest points of players outside first place threshold
      const competitorPoints = sortedByStandings
        .slice(firstPlaceThreshold)
        .map(p => p.points + remainingRounds);
      
      const maxCompetitorPoints = Math.max(...competitorPoints, 0);
      
      // If player's minimum possible points exceed max competitor points, they're Gibsonized
      if (player.points > maxCompetitorPoints) {
        isGibsonized = true;
      }
    }
    
    // Check if player is guaranteed podium (alternative Gibsonization)
    if (!isGibsonized && currentPosition <= podiumThreshold) {
      const competitorPoints = sortedByStandings
        .slice(podiumThreshold)
        .map(p => p.points + remainingRounds);
      
      const maxCompetitorPoints = Math.max(...competitorPoints, 0);
      
      if (player.points > maxCompetitorPoints) {
        isGibsonized = true;
      }
    }
    
    return {
      ...player,
      is_gibsonized: isGibsonized
    };
  });
}

function generateSwissPairings(
  players: PlayerWithRank[],
  avoidRematches: boolean,
  previousPairings: Array<{ player1_id: string; player2_id: string }>
): PairingDisplay[] {
  const pairings: PairingDisplay[] = [];
  const availablePlayers = [...players];
  let tableNumber = 1;

  // Handle Gibsonized players first
  const gibsonizedPlayers = availablePlayers.filter(p => p.is_gibsonized);
  const nonGibsonizedPlayers = availablePlayers.filter(p => !p.is_gibsonized);

  // Pair Gibsonized players together (KOTH style)
  while (gibsonizedPlayers.length >= 2) {
    const player1 = gibsonizedPlayers.shift()!;
    let player2Index = 0;

    if (avoidRematches) {
      player2Index = gibsonizedPlayers.findIndex(p => 
        !hasPlayedBefore(player1.id!, p.id!, previousPairings)
      );
      if (player2Index === -1) player2Index = 0;
    }

    const player2 = gibsonizedPlayers.splice(player2Index, 1)[0];
    const firstMovePlayerId = determineFirstMove(player1, player2, tableNumber);
    
    pairings.push({
      table_number: tableNumber,
      player1,
      player2,
      first_move_player_id: firstMovePlayerId,
      player1_gibsonized: true,
      player2_gibsonized: true
    });
    
    tableNumber++;
  }

  // If odd Gibsonized player, pair with lowest non-contender
  if (gibsonizedPlayers.length === 1) {
    const gibsonizedPlayer = gibsonizedPlayers[0];
    const lowestRankedAvailable = nonGibsonizedPlayers
      .slice()
      .reverse()
      .find(p => !avoidRematches || !hasPlayedBefore(gibsonizedPlayer.id!, p.id!, previousPairings));

    if (lowestRankedAvailable) {
      const player2Index = nonGibsonizedPlayers.findIndex(p => p.id === lowestRankedAvailable.id);
      const player2 = nonGibsonizedPlayers.splice(player2Index, 1)[0];
      const firstMovePlayerId = determineFirstMove(gibsonizedPlayer, player2, tableNumber);
      
      pairings.push({
        table_number: tableNumber,
        player1: gibsonizedPlayer,
        player2,
        first_move_player_id: firstMovePlayerId,
        player1_gibsonized: true,
        player2_gibsonized: false
      });
      
      tableNumber++;
    }
  }

  // Pair remaining non-Gibsonized players using standard Swiss
  while (nonGibsonizedPlayers.length >= 2) {
    const player1 = nonGibsonizedPlayers.shift()!;
    let player2Index = 0;

    if (avoidRematches) {
      player2Index = nonGibsonizedPlayers.findIndex(p => 
        !hasPlayedBefore(player1.id!, p.id!, previousPairings)
      );
      if (player2Index === -1) player2Index = 0;
    }

    const player2 = nonGibsonizedPlayers.splice(player2Index, 1)[0];
    const firstMovePlayerId = determineFirstMove(player1, player2, tableNumber);
    
    pairings.push({
      table_number: tableNumber,
      player1,
      player2,
      first_move_player_id: firstMovePlayerId,
      player1_gibsonized: false,
      player2_gibsonized: false
    });
    
    tableNumber++;
  }

  // Handle bye if odd number of players
  const remainingPlayers = [...gibsonizedPlayers, ...nonGibsonizedPlayers];
  if (remainingPlayers.length === 1) {
    const byePlayer = remainingPlayers[0];
    pairings.push({
      table_number: tableNumber,
      player1: byePlayer,
      player2: { ...byePlayer, name: 'BYE', id: 'bye' } as PlayerWithRank,
      first_move_player_id: byePlayer.id!,
      player1_gibsonized: byePlayer.is_gibsonized,
      player2_gibsonized: false
    });
  }

  return pairings;
}

function generateFonteSwissPairings(
  players: PlayerWithRank[],
  avoidRematches: boolean,
  previousPairings: Array<{ player1_id: string; player2_id: string }>
): PairingDisplay[] {
  const pairings: PairingDisplay[] = [];
  let tableNumber = 1;

  // Group players by current wins (points)
  const scoreGroups = new Map<number, PlayerWithRank[]>();
  
  players.forEach(player => {
    const points = Math.floor(player.points); // Use integer points for grouping
    if (!scoreGroups.has(points)) {
      scoreGroups.set(points, []);
    }
    scoreGroups.get(points)!.push(player);
  });

  // Sort score groups from highest to lowest
  const sortedScores = Array.from(scoreGroups.keys()).sort((a, b) => b - a);

  // Process each score group
  for (const score of sortedScores) {
    const group = scoreGroups.get(score)!;
    
    // Sort within group by spread, then rating
    group.sort((a, b) => {
      if (a.spread !== b.spread) return b.spread - a.spread;
      return b.rating - a.rating;
    });

    // Split group in half and pair top half vs bottom half
    const halfSize = Math.ceil(group.length / 2);
    const topHalf = group.slice(0, halfSize);
    const bottomHalf = group.slice(halfSize);

    // Handle Gibsonized players within the group
    const gibsonizedTop = topHalf.filter(p => p.is_gibsonized);
    const nonGibsonizedTop = topHalf.filter(p => !p.is_gibsonized);
    const gibsonizedBottom = bottomHalf.filter(p => p.is_gibsonized);
    const nonGibsonizedBottom = bottomHalf.filter(p => !p.is_gibsonized);

    // Pair Gibsonized players together first
    while (gibsonizedTop.length > 0 && gibsonizedBottom.length > 0) {
      const player1 = gibsonizedTop.shift()!;
      let player2Index = 0;

      if (avoidRematches) {
        player2Index = gibsonizedBottom.findIndex(p => 
          !hasPlayedBefore(player1.id!, p.id!, previousPairings)
        );
        if (player2Index === -1) player2Index = 0;
      }

      const player2 = gibsonizedBottom.splice(player2Index, 1)[0];
      const firstMovePlayerId = determineFirstMove(player1, player2, tableNumber);
      
      pairings.push({
        table_number: tableNumber,
        player1,
        player2,
        first_move_player_id: firstMovePlayerId,
        player1_gibsonized: true,
        player2_gibsonized: true
      });
      
      tableNumber++;
    }

    // Pair remaining players (top half vs bottom half)
    const remainingTop = [...gibsonizedTop, ...nonGibsonizedTop];
    const remainingBottom = [...gibsonizedBottom, ...nonGibsonizedBottom];

    while (remainingTop.length > 0 && remainingBottom.length > 0) {
      const player1 = remainingTop.shift()!;
      let player2Index = 0;

      if (avoidRematches) {
        player2Index = remainingBottom.findIndex(p => 
          !hasPlayedBefore(player1.id!, p.id!, previousPairings)
        );
        if (player2Index === -1) player2Index = 0;
      }

      const player2 = remainingBottom.splice(player2Index, 1)[0];
      const firstMovePlayerId = determineFirstMove(player1, player2, tableNumber);
      
      pairings.push({
        table_number: tableNumber,
        player1,
        player2,
        first_move_player_id: firstMovePlayerId,
        player1_gibsonized: player1.is_gibsonized,
        player2_gibsonized: player2.is_gibsonized
      });
      
      tableNumber++;
    }

    // Handle any remaining unpaired players in this group
    const unpaired = [...remainingTop, ...remainingBottom];
    while (unpaired.length >= 2) {
      const player1 = unpaired.shift()!;
      const player2 = unpaired.shift()!;
      const firstMovePlayerId = determineFirstMove(player1, player2, tableNumber);
      
      pairings.push({
        table_number: tableNumber,
        player1,
        player2,
        first_move_player_id: firstMovePlayerId,
        player1_gibsonized: player1.is_gibsonized,
        player2_gibsonized: player2.is_gibsonized
      });
      
      tableNumber++;
    }
  }

  return pairings;
}

function generateKingOfHillPairings(
  players: PlayerWithRank[],
  avoidRematches: boolean,
  previousPairings: Array<{ player1_id: string; player2_id: string }>
): PairingDisplay[] {
  const pairings: PairingDisplay[] = [];
  let tableNumber = 1;

  // Separate Gibsonized and non-Gibsonized players
  const gibsonizedPlayers = players.filter(p => p.is_gibsonized);
  const nonGibsonizedPlayers = players.filter(p => !p.is_gibsonized);

  // Pair Gibsonized players together first (KOTH style)
  while (gibsonizedPlayers.length >= 2) {
    const player1 = gibsonizedPlayers.shift()!;
    let player2Index = 0;

    if (avoidRematches) {
      player2Index = gibsonizedPlayers.findIndex(p => 
        !hasPlayedBefore(player1.id!, p.id!, previousPairings)
      );
      if (player2Index === -1) player2Index = 0;
    }

    const player2 = gibsonizedPlayers.splice(player2Index, 1)[0];
    const firstMovePlayerId = determineFirstMove(player1, player2, tableNumber);
    
    pairings.push({
      table_number: tableNumber,
      player1,
      player2,
      first_move_player_id: firstMovePlayerId,
      player1_gibsonized: true,
      player2_gibsonized: true
    });
    
    tableNumber++;
  }

  // Apply KOTH to non-Gibsonized players: pair highest with lowest
  const firstHalf = nonGibsonizedPlayers.slice(0, Math.ceil(nonGibsonizedPlayers.length / 2));
  const secondHalf = nonGibsonizedPlayers.slice(Math.ceil(nonGibsonizedPlayers.length / 2)).reverse();

  for (let i = 0; i < firstHalf.length; i++) {
    const player1 = firstHalf[i];
    const player2 = secondHalf[i];

    if (player2) {
      // Check for rematches if enabled
      if (avoidRematches && hasPlayedBefore(player1.id!, player2.id!, previousPairings)) {
        // Try to find alternative pairing
        const alternativeIndex = secondHalf.findIndex((p, idx) => 
          idx !== i && p && !hasPlayedBefore(player1.id!, p.id!, previousPairings)
        );
        
        if (alternativeIndex !== -1) {
          // Swap players
          [secondHalf[i], secondHalf[alternativeIndex]] = [secondHalf[alternativeIndex], secondHalf[i]];
        }
      }

      const finalPlayer2 = secondHalf[i];
      const firstMovePlayerId = determineFirstMove(player1, finalPlayer2, tableNumber);
      
      pairings.push({
        table_number: tableNumber,
        player1,
        player2: finalPlayer2,
        first_move_player_id: firstMovePlayerId,
        player1_gibsonized: false,
        player2_gibsonized: false
      });
      
      tableNumber++;
    }
  }

  // Handle any remaining Gibsonized player
  if (gibsonizedPlayers.length === 1) {
    const gibsonizedPlayer = gibsonizedPlayers[0];
    pairings.push({
      table_number: tableNumber,
      player1: gibsonizedPlayer,
      player2: { ...gibsonizedPlayer, name: 'BYE', id: 'bye' } as PlayerWithRank,
      first_move_player_id: gibsonizedPlayer.id!,
      player1_gibsonized: true,
      player2_gibsonized: false
    });
  }

  return pairings;
}

function generateRoundRobinPairings(
  players: PlayerWithRank[],
  avoidRematches: boolean,
  previousPairings: Array<{ player1_id: string; player2_id: string }>
): PairingDisplay[] {
  // For round robin, use Swiss with strict rematch avoidance
  return generateSwissPairings(players, true, previousPairings);
}

function generateQuartilePairings(
  players: PlayerWithRank[],
  avoidRematches: boolean,
  previousPairings: Array<{ player1_id: string; player2_id: string }>
): PairingDisplay[] {
  const pairings: PairingDisplay[] = [];
  let tableNumber = 1;

  // Split players into quartiles based on current ranking
  const quartileSize = Math.ceil(players.length / 4);
  const quartiles = [
    players.slice(0, quartileSize),                    // 1st quartile (top players)
    players.slice(quartileSize, quartileSize * 2),     // 2nd quartile
    players.slice(quartileSize * 2, quartileSize * 3), // 3rd quartile
    players.slice(quartileSize * 3)                    // 4th quartile (bottom players)
  ];

  // Handle Gibsonized players first - pair them together regardless of quartile
  const allGibsonized = players.filter(p => p.is_gibsonized);
  const gibsonizedPairs: Array<[PlayerWithRank, PlayerWithRank]> = [];
  
  while (allGibsonized.length >= 2) {
    const player1 = allGibsonized.shift()!;
    let player2Index = 0;

    if (avoidRematches) {
      player2Index = allGibsonized.findIndex(p => 
        !hasPlayedBefore(player1.id!, p.id!, previousPairings)
      );
      if (player2Index === -1) player2Index = 0;
    }

    const player2 = allGibsonized.splice(player2Index, 1)[0];
    gibsonizedPairs.push([player1, player2]);
    
    // Remove from quartiles
    quartiles.forEach(quartile => {
      const index1 = quartile.findIndex(p => p.id === player1.id);
      const index2 = quartile.findIndex(p => p.id === player2.id);
      if (index1 !== -1) quartile.splice(index1, 1);
      if (index2 !== -1) quartile.splice(index2, 1);
    });
  }

  // Add Gibsonized pairings
  gibsonizedPairs.forEach(([player1, player2]) => {
    const firstMovePlayerId = determineFirstMove(player1, player2, tableNumber);
    
    pairings.push({
      table_number: tableNumber,
      player1,
      player2,
      first_move_player_id: firstMovePlayerId,
      player1_gibsonized: true,
      player2_gibsonized: true
    });
    
    tableNumber++;
  });

  // Pair 1st quartile vs 2nd quartile
  const firstQuartile = quartiles[0];
  const secondQuartile = quartiles[1];
  
  while (firstQuartile.length > 0 && secondQuartile.length > 0) {
    const player1 = firstQuartile.shift()!;
    let player2Index = 0;

    if (avoidRematches) {
      player2Index = secondQuartile.findIndex(p => 
        !hasPlayedBefore(player1.id!, p.id!, previousPairings)
      );
      if (player2Index === -1) player2Index = 0;
    }

    const player2 = secondQuartile.splice(player2Index, 1)[0];
    const firstMovePlayerId = determineFirstMove(player1, player2, tableNumber);
    
    pairings.push({
      table_number: tableNumber,
      player1,
      player2,
      first_move_player_id: firstMovePlayerId,
      player1_gibsonized: player1.is_gibsonized,
      player2_gibsonized: player2.is_gibsonized
    });
    
    tableNumber++;
  }

  // Pair 3rd quartile vs 4th quartile
  const thirdQuartile = quartiles[2];
  const fourthQuartile = quartiles[3];
  
  while (thirdQuartile.length > 0 && fourthQuartile.length > 0) {
    const player1 = thirdQuartile.shift()!;
    let player2Index = 0;

    if (avoidRematches) {
      player2Index = fourthQuartile.findIndex(p => 
        !hasPlayedBefore(player1.id!, p.id!, previousPairings)
      );
      if (player2Index === -1) player2Index = 0;
    }

    const player2 = fourthQuartile.splice(player2Index, 1)[0];
    const firstMovePlayerId = determineFirstMove(player1, player2, tableNumber);
    
    pairings.push({
      table_number: tableNumber,
      player1,
      player2,
      first_move_player_id: firstMovePlayerId,
      player1_gibsonized: player1.is_gibsonized,
      player2_gibsonized: player2.is_gibsonized
    });
    
    tableNumber++;
  }

  // Handle any remaining unpaired players
  const remainingPlayers = [
    ...allGibsonized,
    ...firstQuartile,
    ...secondQuartile,
    ...thirdQuartile,
    ...fourthQuartile
  ];

  while (remainingPlayers.length >= 2) {
    const player1 = remainingPlayers.shift()!;
    const player2 = remainingPlayers.shift()!;
    const firstMovePlayerId = determineFirstMove(player1, player2, tableNumber);
    
    pairings.push({
      table_number: tableNumber,
      player1,
      player2,
      first_move_player_id: firstMovePlayerId,
      player1_gibsonized: player1.is_gibsonized,
      player2_gibsonized: player2.is_gibsonized
    });
    
    tableNumber++;
  }

  // Handle bye if odd number of players
  if (remainingPlayers.length === 1) {
    const byePlayer = remainingPlayers[0];
    pairings.push({
      table_number: tableNumber,
      player1: byePlayer,
      player2: { ...byePlayer, name: 'BYE', id: 'bye' } as PlayerWithRank,
      first_move_player_id: byePlayer.id!,
      player1_gibsonized: byePlayer.is_gibsonized,
      player2_gibsonized: false
    });
  }

  return pairings;
}

function generateManualPairings(players: PlayerWithRank[]): PairingDisplay[] {
  // For manual pairing, return empty array - user will set up manually
  return [];
}

function hasPlayedBefore(
  player1Id: string,
  player2Id: string,
  previousPairings: Array<{ player1_id: string; player2_id: string }>
): boolean {
  return previousPairings.some(pairing =>
    (pairing.player1_id === player1Id && pairing.player2_id === player2Id) ||
    (pairing.player1_id === player2Id && pairing.player2_id === player1Id)
  );
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