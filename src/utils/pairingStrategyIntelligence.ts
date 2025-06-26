import { useState, useEffect } from 'react';
import { PairingFormat, PairingGoal, PairingSystemAnalysis, DirectorIntent } from '../types/database';
import { useLogicBlock } from '../hooks/useLogicBlocks';

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

// Hook to use dynamic pairing system analysis
export function usePairingSystemAnalysis(format: PairingFormat, playerCount: number = 32, rounds: number = 7) {
  const [analysis, setAnalysis] = useState<PairingSystemAnalysis | null>(null);
  const { logicCode, isLoading, error } = useLogicBlock('pairing_analysis');
  
  useEffect(() => {
    if (!isLoading && !error && logicCode) {
      try {
        // Create a safe function from the logic code
        const analyzeFunction = new Function('format', 'playerCount', 'rounds', 'PAIRING_GOALS', logicCode);
        
        // Execute the function with our parameters
        const result = analyzeFunction(format, playerCount, rounds, PAIRING_GOALS);
        setAnalysis(result);
      } catch (err) {
        console.error('Error executing pairing analysis logic:', err);
        // Fallback to static analysis
        setAnalysis(staticAnalyzePairingSystem(format, playerCount, rounds));
      }
    } else if (!isLoading && (error || !logicCode)) {
      // Fallback to static analysis if there was an error or no logic code
      setAnalysis(staticAnalyzePairingSystem(format, playerCount, rounds));
    }
  }, [format, playerCount, rounds, logicCode, isLoading, error]);
  
  return { analysis, isLoading };
}

// Analyze each pairing system against the strategic goals (static fallback)
export function staticAnalyzePairingSystem(format: PairingFormat, playerCount: number = 32, rounds: number = 7): PairingSystemAnalysis {
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

    // Add other pairing systems here...
    default:
      // Default analysis for unknown formats
      analysis.goals = {
        fairness: {
          score: 5,
          explanation: 'Unknown pairing system, fairness cannot be determined',
          status: 'fair'
        }
      };
      analysis.strengths = ['Unknown pairing system'];
      analysis.weaknesses = ['Unknown pairing system'];
      analysis.recommendations = ['Consider using a known pairing system'];
      analysis.bestFor = ['Unknown'];
      analysis.avoidIf = ['Unknown'];
  }

  // Calculate overall score
  const scores = Object.values(analysis.goals).map(goal => goal.score);
  analysis.overallScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);

  return analysis;
}

// Hook to use dynamic pairing system recommendations
export function usePairingRecommendation(intent: DirectorIntent) {
  const [recommendation, setRecommendation] = useState<{
    primary: PairingFormat;
    alternatives: PairingFormat[];
    reasoning: string;
    warnings: string[];
  } | null>(null);
  
  const { logicCode, isLoading, error } = useLogicBlock('pairing_recommendation');
  
  useEffect(() => {
    if (!isLoading && !error && logicCode) {
      try {
        // Create a safe function from the logic code
        const recommendFunction = new Function('intent', 'PAIRING_GOALS', logicCode);
        
        // Execute the function with our parameters
        const result = recommendFunction(intent, PAIRING_GOALS);
        setRecommendation(result);
      } catch (err) {
        console.error('Error executing pairing recommendation logic:', err);
        // Fallback to static recommendation
        setRecommendation(staticRecommendPairingSystem(intent));
      }
    } else if (!isLoading && (error || !logicCode)) {
      // Fallback to static recommendation
      setRecommendation(staticRecommendPairingSystem(intent));
    }
  }, [intent, logicCode, isLoading, error]);
  
  return { recommendation, isLoading };
}

// Recommend optimal pairing systems based on director intent (static fallback)
export function staticRecommendPairingSystem(intent: DirectorIntent): {
  primary: PairingFormat;
  alternatives: PairingFormat[];
  reasoning: string;
  warnings: string[];
} {
  // Default recommendation
  return {
    primary: 'swiss',
    alternatives: ['fonte-swiss', 'king-of-hill'],
    reasoning: 'Swiss system is recommended as a balanced approach for most tournaments.',
    warnings: []
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

// Analyze each pairing system against the strategic goals
export function analyzePairingSystem(format: PairingFormat, playerCount: number = 32, rounds: number = 7): PairingSystemAnalysis {
  // This is now just a wrapper for the static function for backward compatibility
  return staticAnalyzePairingSystem(format, playerCount, rounds);
}

// Recommend optimal pairing systems based on director intent
export function recommendPairingSystem(intent: DirectorIntent): {
  primary: PairingFormat;
  alternatives: PairingFormat[];
  reasoning: string;
  warnings: string[];
} {
  // This is now just a wrapper for the static function for backward compatibility
  return staticRecommendPairingSystem(intent);
}