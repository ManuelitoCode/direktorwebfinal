import { ParsedPlayer } from '../types/database';

export function parsePlayerInput(input: string, teamMode: boolean = false): ParsedPlayer[] {
  const lines = input.split('\n').filter(line => line.trim() !== '');
  const players: ParsedPlayer[] = [];
  const seenNames = new Set<string>();

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    let name = '';
    let ratingStr = '';
    let teamName = '';

    if (teamMode) {
      // Team mode parsing: "Name, Rating ; ; team TeamName"
      const teamMatch = trimmedLine.match(/^(.+?)\s*;\s*;\s*team\s+(.+)$/i);
      if (teamMatch) {
        const playerPart = teamMatch[1].trim();
        teamName = teamMatch[2].trim();
        
        // Parse player part for name and rating
        if (playerPart.includes(',')) {
          const parts = playerPart.split(',');
          if (parts.length >= 2) {
            name = parts[0].trim();
            ratingStr = parts[parts.length - 1].trim();
          }
        } else {
          const lastSpaceIndex = playerPart.lastIndexOf(' ');
          if (lastSpaceIndex !== -1) {
            name = playerPart.substring(0, lastSpaceIndex).trim();
            ratingStr = playerPart.substring(lastSpaceIndex + 1).trim();
          }
        }
      } else {
        // Try regular parsing without team
        if (trimmedLine.includes(',')) {
          const parts = trimmedLine.split(',');
          if (parts.length >= 2) {
            name = parts[0].trim();
            ratingStr = parts[parts.length - 1].trim();
          }
        } else {
          const lastSpaceIndex = trimmedLine.lastIndexOf(' ');
          if (lastSpaceIndex !== -1) {
            name = trimmedLine.substring(0, lastSpaceIndex).trim();
            ratingStr = trimmedLine.substring(lastSpaceIndex + 1).trim();
          }
        }
      }
    } else {
      // Regular parsing for individual mode
      if (trimmedLine.includes(',')) {
        const parts = trimmedLine.split(',');
        if (parts.length >= 2) {
          name = parts[0].trim();
          ratingStr = parts[parts.length - 1].trim();
        }
      } else {
        const lastSpaceIndex = trimmedLine.lastIndexOf(' ');
        if (lastSpaceIndex !== -1) {
          name = trimmedLine.substring(0, lastSpaceIndex).trim();
          ratingStr = trimmedLine.substring(lastSpaceIndex + 1).trim();
        }
      }
    }

    // If no pattern matched, treat whole line as name with missing rating
    if (!name && !ratingStr) {
      players.push({
        name: trimmedLine,
        rating: 0,
        team_name: teamMode ? teamName || undefined : undefined,
        isValid: false,
        error: 'Missing rating'
      });
      continue;
    }

    // Validate name
    if (!name) {
      players.push({
        name: '',
        rating: 0,
        team_name: teamMode ? teamName || undefined : undefined,
        isValid: false,
        error: 'Missing name'
      });
      continue;
    }

    // Check for duplicate names
    const nameLower = name.toLowerCase();
    if (seenNames.has(nameLower)) {
      players.push({
        name,
        rating: 0,
        team_name: teamMode ? teamName || undefined : undefined,
        isValid: false,
        error: 'Duplicate name'
      });
      continue;
    }

    // Validate rating
    const rating = parseInt(ratingStr, 10);
    if (isNaN(rating) || rating < 0 || rating > 3000) {
      players.push({
        name,
        rating: 0,
        team_name: teamMode ? teamName || undefined : undefined,
        isValid: false,
        error: 'Invalid rating (0-3000)'
      });
      continue;
    }

    // Validate team name in team mode
    if (teamMode && !teamName) {
      players.push({
        name,
        rating,
        team_name: undefined,
        isValid: false,
        error: 'Missing team name'
      });
      continue;
    }

    seenNames.add(nameLower);
    players.push({
      name,
      rating,
      team_name: teamMode ? teamName : undefined,
      isValid: true
    });
  }

  return players;
}