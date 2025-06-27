/**
 * Utility functions for generating and validating slugs
 */

/**
 * Converts a string to a URL-friendly slug
 * @param text The text to convert to a slug
 * @returns A URL-friendly slug
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/&/g, '-and-')          // Replace & with 'and'
    .replace(/[^\w\-]+/g, '')       // Remove all non-word characters
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}

/**
 * Generates a unique slug for a tournament
 * @param name The tournament name
 * @param id Optional ID to append for uniqueness
 * @returns A unique slug
 */
export function generateTournamentSlug(name: string, id?: string): string {
  const baseSlug = slugify(name);
  
  // If ID is provided, append a short version to ensure uniqueness
  if (id) {
    const shortId = id.substring(0, 6);
    return `${baseSlug}-${shortId}`;
  }
  
  return baseSlug;
}

/**
 * Validates if a string is a valid slug
 * @param slug The slug to validate
 * @returns True if valid, false otherwise
 */
export function isValidSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return slugRegex.test(slug);
}