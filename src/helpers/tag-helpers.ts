/**
 * Tag helper utilities
 */

import type { Tag, Commit } from '../types/provider.js';
import type { Versioner } from '../interfaces/versioner.interface.js';

/**
 * Reduces an array of tags to the latest (first) tag that matches the versioner's format
 * @param tags - Array of tags to search through
 * @param versioner - Versioner to validate tag names against
 * @returns The first tag matching the versioner format, or null if no match found
 */
export function reduceTagsToLatest(tags: Tag[], versioner: Versioner): Tag | null {
  for (const tag of tags) {
    if (versioner.match(tag.name)) {
      return tag;
    }
  }
  return null;
}

/**
 * Reduces commits to the latest (first) tag found on the branch that matches the versioner's format
 * @param commits - Array of commits to search through (in chronological order, newest first)
 * @param versioner - Versioner to validate tag names against
 * @returns The first tag matching the versioner format found in commits, or null if no match found
 */
export function reduceTagsOnBranchToLatest(commits: Commit[], versioner: Versioner): Tag | null {
  for (const commit of commits) {
    if (commit.tags && commit.tags.length > 0) {
      // Check each tag on this commit
      for (const tag of commit.tags) {
        if (versioner.match(tag.name)) {
          return tag;
        }
      }
    }
  }
  return null;
}
