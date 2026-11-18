import type { Commit } from '../types/provider.js';
import * as logger from '../logger.js';
import { CONVENTIONAL_COMMIT_TYPES } from './commit-parser.js';

const CONVENTIONAL_COMMIT_REGEX = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/;

function findLikelyType(type: string): string | undefined {
  const distances = [...CONVENTIONAL_COMMIT_TYPES]
    .map(candidate => ({ candidate, distance: editDistance(type, candidate) }))
    .sort((left, right) => left.distance - right.distance || left.candidate.localeCompare(right.candidate));

  return distances[0]?.distance <= 2 ? distances[0].candidate : undefined;
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let row = 1; row <= left.length; row++) {
    let diagonal = previous[0];
    previous[0] = row;

    for (let column = 1; column <= right.length; column++) {
      const above = previous[column];
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      previous[column] = Math.min(previous[column] + 1, previous[column - 1] + 1, diagonal + cost);
      diagonal = above;
    }
  }

  return previous[right.length];
}

/**
 * Select commits up to the given sha (or all if null) and filter to conventional commits.
 * Preserves the order of the provided commits (newest-first).
 * When targetBranch is provided, only commits whose branch matches targetBranch are included.
 * includeAllCommits retains non-conventional commits and chores, excluding the release anchor itself.
 */
export function reduceCommitsToConventionalSinceLastRelease(commits: Commit[], sha: string | null | undefined, includeChores = false, targetBranch?: string, includeAllCommits = false): Commit[] {
  if (!Array.isArray(commits) || commits.length === 0) return [];

  let selected: Commit[] = commits;

  if (sha) {
    const idx = commits.findIndex(c => c.sha === sha);
    if (idx !== -1) {
      selected = commits.slice(0, includeAllCommits ? idx : idx + 1);
    } else {
      // treat unknown sha as null (include all)
      selected = commits;
    }
  }

  return selected.filter(c => {
    if (!c || typeof c.title !== 'string') return false;

    if (targetBranch !== undefined && c.branch !== undefined && c.branch !== targetBranch) return false;

    if (includeAllCommits) return true;

    const m = CONVENTIONAL_COMMIT_REGEX.exec(c.title.trim());
    if (!m) return false;

    const type = m[1].toLowerCase();
    if (!CONVENTIONAL_COMMIT_TYPES.has(type)) {
      const likelyType = findLikelyType(type);
      const suggestion = likelyType ? ` Did you mean "${likelyType}"?` : '';
      logger.warn(`⚠️  Ignoring commit "${c.title}" with non-conventional type "${type}".${suggestion}`);
      return false;
    }

    if (type === 'chore' && !includeChores) return false;

    return true;
  });
}
