import { ParsedPlayer } from '../types/database';

export function parsePlayerInput(input: string): ParsedPlayer[] {
  const lines = input.split('\n').filter(line => line.trim() !== '');
  const players: ParsedPlayer[] = [];
  const seenNames = new Set<string>();

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Try different parsing patterns
    let name = '';
    let ratingStr = '';

    // Pattern 1: "Name, Rating" (comma separated)
    if (trimmedLine.includes(',')) {
      const parts = trimmedLine.split(',');
      if (parts.length >= 2) {
        name = parts[0].trim();
        ratingStr = parts[parts.length - 1].trim();
      }
    } else {
      // Pattern 2: "Name Rating" (space separated, rating is last word)
      const lastSpaceIndex = trimmedLine.lastIndexOf(' ');
      if (lastSpaceIndex !== -1) {
        name = trimmedLine.substring(0, lastSpaceIndex).trim();
        ratingStr = trimmedLine.substring(lastSpaceIndex + 1).trim();
      }
    }

    // If no pattern matched, treat whole line as name with missing rating
    if (!name && !ratingStr) {
      players.push({
        name: trimmedLine,
        rating: 0,
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
        isValid: false,
        error: 'Invalid rating (0-3000)'
      });
      continue;
    }

    seenNames.add(nameLower);
    players.push({
      name,
      rating,
      isValid: true
    });
  }

  return players;
}