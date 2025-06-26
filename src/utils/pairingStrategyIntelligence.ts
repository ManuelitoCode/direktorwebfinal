import { PairingFormat, PairingGoal, PairingSystemAnalysis, DirectorIntent } from '../types/database';

// Define the 10 strategic goals for pairing systems
export const PAIRING_GOALS: Record<string, PairingGoal> = {
  aristomachy: {
    id: 'aristomachy',
    name: 'Aristomachy',
    description: 'Top players meet late in the tournament to maximize suspense',
    importance: 'high'
  },
  divisionSizing: {
    id: 'divisionSizing',
    name: 'Division Sizing',
    description: 'Flexibility with varying player numbers and late registrations',
    importance: 'medium'
  },
  exagony: {
    id: 'exagony',
    name: 'Exagony',
    description: 'Avoid players from same country, team, or club playing each other',
    importance: 'medium'
  },
  fairness: {
    id: 'fairness',
    name: 'Fairness',
    description: 'Rankings accurately reflect actual performance and skill',
    importance: 'critical'
  },
  implementability: {
    id: 'implementability',
    name: 'Implementability',
    description: 'Manual or computational feasibility for tournament directors',
    importance: 'high'
  },
  incentivization: {
    id: 'incentivization',
    name: 'Incentivization',
    description: 'No reward for strategic loss or sandbagging',
    importance: 'critical'
  },
  inclusivity: {
    id: 'inclusivity',
    name: 'Inclusivity',
    description: 'Allow underdogs a realistic shot at winning prizes',
    importance: 'high'
  },
  monagony: {
    id: 'monagony',
    name: 'Monagony',
    description: 'Avoid repeat matchups between the same players',
    importance: 'medium'
  },
  monotony: {
    id: 'monotony',
    name: 'Monotony',
    description: 'Stronger players should generally stay ahead of weaker ones',
    importance: 'high'
  },
  suspense: {
    id: 'suspense',
    name: 'Suspense',
    description: 'Tournament outcome remains unresolved until the final round',
    importance: 'high'
  }
};

// Analyze each pairing system against the strategic goals
export function analyzePairingSystem(format: PairingFormat, playerCount: number = 32, rounds: number = 7): PairingSystemAnalysis {
  const analysis: PairingSystemAnalysis = {
    format,
    goals: {},
    overallScore: 0,
    strengths: [],
    weaknesses: [],
    recommendations: [],
    bestFor: [],
    avoidIf: []
  };

  switch (format) {
    case 'swiss':
      analysis.goals = {
        aristomachy: {
          score: 8,
          explanation: 'Swiss naturally brings top players together in later rounds as they accumulate wins',
          status: 'excellent'
        },
        divisionSizing: {
          score: 9,
          explanation: 'Handles any number of players gracefully, including odd numbers with byes',
          status: 'excellent'
        },
        exagony: {
          score: 6,
          explanation: 'Can be modified to avoid same-club pairings, but not built-in',
          status: 'fair'
        },
        fairness: {
          score: 9,
          explanation: 'Excellent at producing fair rankings based on performance against similar opponents',
          status: 'excellent'
        },
        implementability: {
          score: 8,
          explanation: 'Well-understood system with good software support',
          status: 'excellent'
        },
        incentivization: {
          score: 9,
          explanation: 'No benefit to losing games; always better to win',
          status: 'excellent'
        },
        inclusivity: {
          score: 7,
          explanation: 'Lower-rated players can rise through consistent wins',
          status: 'good'
        },
        monagony: {
          score: 8,
          explanation: 'Built-in rematch avoidance when possible',
          status: 'excellent'
        },
        monotony: {
          score: 8,
          explanation: 'Strong players tend to maintain higher positions',
          status: 'excellent'
        },
        suspense: {
          score: 7,
          explanation: 'Good suspense, though leaders can sometimes be clear early',
          status: 'good'
        }
      };
      analysis.strengths = [
        'Excellent fairness and ranking accuracy',
        'Handles any player count',
        'No incentive for strategic losses',
        'Avoids rematches when possible'
      ];
      analysis.weaknesses = [
        'May lack excitement in early rounds',
        'Leaders can become apparent before final round'
      ];
      analysis.recommendations = [
        'Ideal for most competitive tournaments',
        'Use with Gibsonization for elite events',
        'Consider Fonte-Swiss variant for more excitement'
      ];
      analysis.bestFor = [
        'Competitive tournaments',
        'Large player fields',
        'When fairness is paramount'
      ];
      analysis.avoidIf = [
        'Maximum suspense is required',
        'Very small player fields (under 8)'
      ];
      break;

    case 'fonte-swiss':
      analysis.goals = {
        aristomachy: {
          score: 9,
          explanation: 'Excellent at bringing top performers together while maintaining competitive balance',
          status: 'excellent'
        },
        divisionSizing: {
          score: 8,
          explanation: 'Handles varying player counts well, though works best with even score groups',
          status: 'excellent'
        },
        exagony: {
          score: 6,
          explanation: 'Can incorporate team avoidance but requires additional logic',
          status: 'fair'
        },
        fairness: {
          score: 10,
          explanation: 'Superior fairness by pairing within score groups',
          status: 'excellent'
        },
        implementability: {
          score: 7,
          explanation: 'More complex than standard Swiss but still manageable',
          status: 'good'
        },
        incentivization: {
          score: 10,
          explanation: 'Perfect incentive structure - no benefit to losing',
          status: 'excellent'
        },
        inclusivity: {
          score: 8,
          explanation: 'Excellent for allowing underdogs to compete at their level',
          status: 'excellent'
        },
        monagony: {
          score: 7,
          explanation: 'Good rematch avoidance within score groups',
          status: 'good'
        },
        monotony: {
          score: 9,
          explanation: 'Excellent at maintaining skill-based hierarchy',
          status: 'excellent'
        },
        suspense: {
          score: 8,
          explanation: 'Great suspense as leaders face other leaders',
          status: 'excellent'
        }
      };
      analysis.strengths = [
        'Maximum fairness through score-group pairing',
        'Excellent competitive balance',
        'Strong incentive structure',
        'Good suspense maintenance'
      ];
      analysis.weaknesses = [
        'More complex to implement',
        'May create uneven table counts'
      ];
      analysis.recommendations = [
        'Best for highly competitive events',
        'Ideal when fairness is critical',
        'Use for elite tournaments'
      ];
      analysis.bestFor = [
        'Elite competitive play',
        'When maximum fairness is required',
        'Tournaments with skilled directors'
      ];
      analysis.avoidIf = [
        'Casual tournaments',
        'Directors unfamiliar with the system'
      ];
      break;

    case 'king-of-hill':
      analysis.goals = {
        aristomachy: {
          score: 3,
          explanation: 'Top players meet immediately, reducing late-tournament suspense',
          status: 'poor'
        },
        divisionSizing: {
          score: 7,
          explanation: 'Works with any player count but may create unbalanced pairings',
          status: 'good'
        },
        exagony: {
          score: 5,
          explanation: 'Difficult to avoid same-team pairings due to ranking constraints',
          status: 'fair'
        },
        fairness: {
          score: 6,
          explanation: 'Can be unfair to middle-ranked players who face extremes',
          status: 'fair'
        },
        implementability: {
          score: 9,
          explanation: 'Very simple to implement and understand',
          status: 'excellent'
        },
        incentivization: {
          score: 8,
          explanation: 'Generally good incentives, though some edge cases exist',
          status: 'excellent'
        },
        inclusivity: {
          score: 9,
          explanation: 'Excellent for giving lower-rated players winnable games',
          status: 'excellent'
        },
        monagony: {
          score: 4,
          explanation: 'May force rematches due to ranking constraints',
          status: 'poor'
        },
        monotony: {
          score: 5,
          explanation: 'Can allow weaker players to leapfrog stronger ones',
          status: 'fair'
        },
        suspense: {
          score: 10,
          explanation: 'Maximum suspense as anyone can win until the end',
          status: 'excellent'
        }
      };
      analysis.strengths = [
        'Maximum suspense and excitement',
        'Very simple to implement',
        'Great for underdog stories',
        'Easy to understand'
      ];
      analysis.weaknesses = [
        'Poor aristomachy (top players meet early)',
        'May force unwanted rematches',
        'Can be unfair to middle-tier players'
      ];
      analysis.recommendations = [
        'Best for casual, fun tournaments',
        'Use when maximum excitement is desired',
        'Good for smaller fields'
      ];
      analysis.bestFor = [
        'Casual tournaments',
        'Maximum suspense events',
        'Smaller player fields',
        'Entertainment-focused events'
      ];
      analysis.avoidIf = [
        'Highly competitive tournaments',
        'When fairness is critical',
        'Large player fields'
      ];
      break;

    case 'round-robin':
      analysis.goals = {
        aristomachy: {
          score: 5,
          explanation: 'Top players meet at predetermined times, not necessarily late',
          status: 'fair'
        },
        divisionSizing: {
          score: 3,
          explanation: 'Very poor - only works with small, fixed player counts',
          status: 'poor'
        },
        exagony: {
          score: 2,
          explanation: 'Everyone plays everyone - impossible to avoid same-team matchups',
          status: 'critical'
        },
        fairness: {
          score: 10,
          explanation: 'Perfect fairness - everyone plays identical opponents',
          status: 'excellent'
        },
        implementability: {
          score: 4,
          explanation: 'Simple concept but becomes unwieldy with larger fields',
          status: 'poor'
        },
        incentivization: {
          score: 10,
          explanation: 'Perfect incentives - every game matters equally',
          status: 'excellent'
        },
        inclusivity: {
          score: 6,
          explanation: 'Fair but doesn\'t give underdogs easier paths',
          status: 'fair'
        },
        monagony: {
          score: 1,
          explanation: 'Impossible - everyone plays everyone exactly once',
          status: 'critical'
        },
        monotony: {
          score: 8,
          explanation: 'Strong players generally finish higher',
          status: 'excellent'
        },
        suspense: {
          score: 6,
          explanation: 'Moderate suspense, depends on scheduling',
          status: 'fair'
        }
      };
      analysis.strengths = [
        'Perfect fairness',
        'Excellent incentive structure',
        'Clear, unambiguous results'
      ];
      analysis.weaknesses = [
        'Only works with very small fields',
        'Requires many rounds',
        'No team/club separation possible'
      ];
      analysis.recommendations = [
        'Only use for very small tournaments (8 players or fewer)',
        'Good for qualification rounds',
        'Consider for final playoffs'
      ];
      analysis.bestFor = [
        'Very small tournaments',
        'Qualification rounds',
        'Final championship rounds'
      ];
      analysis.avoidIf = [
        'More than 8-10 players',
        'Limited time/rounds',
        'Team separation needed'
      ];
      break;

    case 'quartile':
      analysis.goals = {
        aristomachy: {
          score: 6,
          explanation: 'Top quartile players meet each other, providing some aristomachy',
          status: 'fair'
        },
        divisionSizing: {
          score: 7,
          explanation: 'Works reasonably well with various player counts',
          status: 'good'
        },
        exagony: {
          score: 5,
          explanation: 'Limited ability to avoid same-team pairings within quartiles',
          status: 'fair'
        },
        fairness: {
          score: 7,
          explanation: 'Good fairness by matching similar skill levels',
          status: 'good'
        },
        implementability: {
          score: 8,
          explanation: 'Relatively simple to implement and understand',
          status: 'excellent'
        },
        incentivization: {
          score: 8,
          explanation: 'Good incentives with some edge cases',
          status: 'excellent'
        },
        inclusivity: {
          score: 8,
          explanation: 'Excellent for giving each quartile competitive games',
          status: 'excellent'
        },
        monagony: {
          score: 6,
          explanation: 'Moderate rematch avoidance within quartiles',
          status: 'fair'
        },
        monotony: {
          score: 7,
          explanation: 'Generally maintains skill-based rankings',
          status: 'good'
        },
        suspense: {
          score: 7,
          explanation: 'Good suspense within each quartile',
          status: 'good'
        }
      };
      analysis.strengths = [
        'Good balance of fairness and excitement',
        'Creates competitive games at all levels',
        'Relatively simple to implement'
      ];
      analysis.weaknesses = [
        'May create artificial barriers between quartiles',
        'Less optimal than Swiss for pure fairness'
      ];
      analysis.recommendations = [
        'Good for mixed-skill tournaments',
        'Use when you want competitive games at all levels',
        'Consider for recreational events'
      ];
      analysis.bestFor = [
        'Mixed-skill tournaments',
        'Recreational events',
        'When you want multiple competitive tiers'
      ];
      analysis.avoidIf = [
        'Elite competitive events',
        'Very small or very large fields'
      ];
      break;

    case 'manual':
      analysis.goals = {
        aristomachy: {
          score: 10,
          explanation: 'Perfect control - can schedule top players to meet whenever desired',
          status: 'excellent'
        },
        divisionSizing: {
          score: 10,
          explanation: 'Complete flexibility with any player count or situation',
          status: 'excellent'
        },
        exagony: {
          score: 10,
          explanation: 'Perfect control over team/club separation',
          status: 'excellent'
        },
        fairness: {
          score: 5,
          explanation: 'Depends entirely on director skill and bias',
          status: 'fair'
        },
        implementability: {
          score: 2,
          explanation: 'Very difficult and time-consuming for directors',
          status: 'critical'
        },
        incentivization: {
          score: 5,
          explanation: 'Depends on director understanding of incentive structures',
          status: 'fair'
        },
        inclusivity: {
          score: 8,
          explanation: 'Can be designed to give underdogs optimal chances',
          status: 'excellent'
        },
        monagony: {
          score: 10,
          explanation: 'Perfect control over rematch avoidance',
          status: 'excellent'
        },
        monotony: {
          score: 7,
          explanation: 'Can maintain or subvert skill hierarchies as desired',
          status: 'good'
        },
        suspense: {
          score: 10,
          explanation: 'Perfect control over suspense and drama',
          status: 'excellent'
        }
      };
      analysis.strengths = [
        'Perfect control over all aspects',
        'Can optimize for any specific goal',
        'Maximum flexibility'
      ];
      analysis.weaknesses = [
        'Extremely difficult to implement well',
        'Prone to director bias',
        'Very time-consuming'
      ];
      analysis.recommendations = [
        'Only for very experienced directors',
        'Use for special exhibition events',
        'Consider for unique tournament formats'
      ];
      analysis.bestFor = [
        'Exhibition tournaments',
        'Special events',
        'Very experienced directors'
      ];
      analysis.avoidIf = [
        'Regular tournaments',
        'Inexperienced directors',
        'Large player fields'
      ];
      break;
  }

  // Calculate overall score
  const scores = Object.values(analysis.goals).map(goal => goal.score);
  analysis.overallScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);

  return analysis;
}

// Recommend optimal pairing systems based on director intent
export function recommendPairingSystem(intent: DirectorIntent): {
  primary: PairingFormat;
  alternatives: PairingFormat[];
  reasoning: string;
  warnings: string[];
} {
  const { primary, playerCount, rounds, competitiveLevel, priorityGoals } = intent;

  // Analyze all systems for this context
  const analyses = {
    swiss: analyzePairingSystem('swiss', playerCount, rounds),
    'fonte-swiss': analyzePairingSystem('fonte-swiss', playerCount, rounds),
    'king-of-hill': analyzePairingSystem('king-of-hill', playerCount, rounds),
    'round-robin': analyzePairingSystem('round-robin', playerCount, rounds),
    quartile: analyzePairingSystem('quartile', playerCount, rounds),
    manual: analyzePairingSystem('manual', playerCount, rounds)
  };

  // Score systems based on priority goals
  const systemScores: Record<PairingFormat, number> = {
    swiss: 0,
    'fonte-swiss': 0,
    'king-of-hill': 0,
    'round-robin': 0,
    quartile: 0,
    manual: 0
  };

  // Weight scores based on priority goals
  Object.entries(analyses).forEach(([format, analysis]) => {
    priorityGoals.forEach(goalId => {
      if (analysis.goals[goalId]) {
        systemScores[format as PairingFormat] += analysis.goals[goalId].score;
      }
    });
  });

  // Apply contextual bonuses/penalties
  if (competitiveLevel === 'elite') {
    systemScores['fonte-swiss'] += 20;
    systemScores.swiss += 15;
    systemScores['king-of-hill'] -= 10;
  } else if (competitiveLevel === 'casual') {
    systemScores['king-of-hill'] += 15;
    systemScores.quartile += 10;
    systemScores['fonte-swiss'] -= 5;
  }

  if (playerCount < 8) {
    systemScores['round-robin'] += 15;
    systemScores.swiss -= 5;
  } else if (playerCount > 50) {
    systemScores.swiss += 10;
    systemScores['fonte-swiss'] += 5;
    systemScores['round-robin'] -= 30;
  }

  // Handle specific intents
  if (primary === 'Max suspense') {
    systemScores['king-of-hill'] += 25;
    systemScores.manual += 15;
  } else if (primary === 'Max fairness') {
    systemScores['fonte-swiss'] += 25;
    systemScores.swiss += 20;
    systemScores['round-robin'] += 15;
  } else if (primary === 'No repeats') {
    systemScores.swiss += 20;
    systemScores['fonte-swiss'] += 15;
    systemScores['round-robin'] -= 50; // Impossible
  }

  // Sort by score
  const sortedSystems = Object.entries(systemScores)
    .sort(([, a], [, b]) => b - a)
    .map(([format]) => format as PairingFormat);

  const primaryRecommendation = sortedSystems[0];
  const alternatives = sortedSystems.slice(1, 4);

  // Generate reasoning
  const primaryAnalysis = analyses[primaryRecommendation];
  const reasoning = `${primaryRecommendation.charAt(0).toUpperCase() + primaryRecommendation.slice(1)} is recommended because it scores highest on your priority goals: ${priorityGoals.map(goal => PAIRING_GOALS[goal]?.name).join(', ')}. ${primaryAnalysis.strengths.slice(0, 2).join(' and ')}.`;

  // Generate warnings
  const warnings: string[] = [];
  if (primaryAnalysis.weaknesses.length > 0) {
    warnings.push(`Note: ${primaryAnalysis.weaknesses[0]}`);
  }
  if (primaryAnalysis.avoidIf.some(condition => 
    (condition.includes('small') && playerCount < 8) ||
    (condition.includes('large') && playerCount > 50) ||
    (condition.includes('casual') && competitiveLevel === 'casual') ||
    (condition.includes('competitive') && competitiveLevel === 'elite')
  )) {
    warnings.push('This system may not be ideal for your tournament context');
  }

  return {
    primary: primaryRecommendation,
    alternatives,
    reasoning,
    warnings
  };
}

// Get quick recommendations for common scenarios
export function getQuickRecommendations(): Record<string, { format: PairingFormat; description: string }> {
  return {
    'max-suspense': {
      format: 'king-of-hill',
      description: 'Maximum excitement and unpredictability until the final round'
    },
    'max-fairness': {
      format: 'fonte-swiss',
      description: 'Most accurate rankings through score-group pairing'
    },
    'no-repeats': {
      format: 'swiss',
      description: 'Best rematch avoidance while maintaining competitive balance'
    },
    'casual-fun': {
      format: 'quartile',
      description: 'Competitive games at all skill levels'
    },
    'elite-competition': {
      format: 'fonte-swiss',
      description: 'Professional-grade fairness and competitive integrity'
    },
    'small-tournament': {
      format: 'round-robin',
      description: 'Perfect fairness for small fields (8 players or fewer)'
    }
  };
}

// Format goal scores for display
export function formatGoalScore(score: number): { color: string; label: string } {
  if (score >= 9) return { color: 'text-green-400', label: 'Excellent' };
  if (score >= 7) return { color: 'text-blue-400', label: 'Good' };
  if (score >= 5) return { color: 'text-yellow-400', label: 'Fair' };
  if (score >= 3) return { color: 'text-orange-400', label: 'Poor' };
  return { color: 'text-red-400', label: 'Critical' };
}