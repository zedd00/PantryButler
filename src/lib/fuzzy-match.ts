/**
 * Fuzzy string matching utilities for ingredient and equipment matching
 */

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits needed to change one string into the other
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[len1][len2];
}

/**
 * Normalize a string for comparison
 * - Convert to lowercase
 * - Remove extra whitespace
 * - Remove common plurals
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/s$/, ''); // Remove trailing 's' for simple plural handling
}

/**
 * Tokenize a normalized string into words
 */
function tokenize(str: string): string[] {
  return normalizeString(str).split(' ').filter(w => w.length > 0);
}

/**
 * Check if two words count as a match:
 * - exact equality
 * - containment for longer words (e.g. "tomato" matching "tomatoes")
 * - close Levenshtein similarity for typos
 */
function wordsMatch(word1: string, word2: string): boolean {
  if (word1 === word2) return true;
  if (word1.length >= 4 && word2.length >= 4 &&
      (word1.includes(word2) || word2.includes(word1))) return true;
  const maxLen = Math.max(word1.length, word2.length);
  return maxLen > 0 && (1 - levenshteinDistance(word1, word2) / maxLen) >= 0.8;
}

/**
 * Calculate word-overlap score (0-1): the fraction of str1's words that also
 * appear in str2. Handles cases like "Kosher Salt" matching pantry items
 * "Salt" and "Kosher Pickles" that share a single word.
 */
function wordOverlapScore(str1: string, str2: string): number {
  const words1 = tokenize(str1);
  const words2 = tokenize(str2);
  if (words1.length === 0 || words2.length === 0) return 0;

  const matched = words1.filter(w1 => words2.some(w2 => wordsMatch(w1, w2))).length;
  return matched / words1.length;
}

/**
 * Calculate similarity score between two strings (0-1, where 1 is identical).
 * Combines Levenshtein distance with word-overlap so multi-word ingredients
 * can match pantry items that share one of their words.
 */
function calculateSimilarity(str1: string, str2: string): number {
  const norm1 = normalizeString(str1);
  const norm2 = normalizeString(str2);

  // Exact match after normalization
  if (norm1 === norm2) return 1.0;

  // Calculate Levenshtein distance
  const distance = levenshteinDistance(norm1, norm2);
  const maxLength = Math.max(norm1.length, norm2.length);
  
  // Convert distance to similarity score (0-1)
  const levenshteinSim = 1 - (distance / maxLength);

  // A multi-word query that shares any word with the item is a meaningful match
  return Math.max(levenshteinSim, wordOverlapScore(norm1, norm2));
}

/**
 * Check if one string contains the other (after normalization)
 */
function containsMatch(str1: string, str2: string): boolean {
  const norm1 = normalizeString(str1);
  const norm2 = normalizeString(str2);
  return norm1.includes(norm2) || norm2.includes(norm1);
}

export interface FuzzyMatch<T> {
  item: T;
  score: number;
  isExactMatch: boolean;
  isContainsMatch: boolean;
}

/**
 * Find fuzzy matches for a search string in a list of items
 * @param searchStr The string to search for
 * @param items Array of items to search in
 * @param getItemString Function to extract the string to compare from each item
 * @param threshold Minimum similarity score to include (0-1, default 0.6)
 * @returns Array of matches sorted by score (highest first)
 */
export function findFuzzyMatches<T>(
  searchStr: string,
  items: T[],
  getItemString: (item: T) => string,
  threshold: number = 0.6
): FuzzyMatch<T>[] {
  const matches: FuzzyMatch<T>[] = [];

  for (const item of items) {
    const itemStr = getItemString(item);
    const score = calculateSimilarity(searchStr, itemStr);
    
    if (score >= threshold) {
      matches.push({
        item,
        score,
        isExactMatch: normalizeString(searchStr) === normalizeString(itemStr),
        isContainsMatch: containsMatch(searchStr, itemStr),
      });
    }
  }

  // Sort by score (highest first)
  matches.sort((a, b) => b.score - a.score);

  return matches;
}

/**
 * Check if a string has an exact match in a list (after normalization)
 * @param searchStr The string to search for
 * @param items Array of items to search in
 * @param getItemString Function to extract the string to compare from each item
 * @returns True if an exact match exists
 */
export function hasExactMatch<T>(
  searchStr: string,
  items: T[],
  getItemString: (item: T) => string
): boolean {
  const normalized = normalizeString(searchStr);
  return items.some(item => normalizeString(getItemString(item)) === normalized);
}
