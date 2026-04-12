import type { Commit } from '../types/provider.js';

const CONVENTIONAL_COMMIT_REGEX = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/;

/**
 * Select commits up to the given sha (or all if null) and filter to conventional commits.
 * Preserves the order of the provided commits (newest-first).
 * When targetBranch is provided, only commits whose branch matches targetBranch are included.
 */
export function reduceCommitsToConventionalSinceLastRelease(commits: Commit[], sha: string | null | undefined, includeChores = false, targetBranch?: string): Commit[] {
  if (!Array.isArray(commits) || commits.length === 0) return [];

  let selected: Commit[] = commits;

  if (sha) {
    const idx = commits.findIndex(c => c.sha === sha);
    if (idx !== -1) {
      selected = commits.slice(0, idx + 1);
    } else {
      // treat unknown sha as null (include all)
      selected = commits;
    }
  }

  return selected.filter(c => {
    if (!c || typeof c.title !== 'string') return false;

    if (targetBranch !== undefined && c.branch !== undefined && c.branch !== targetBranch) return false;

    const m = CONVENTIONAL_COMMIT_REGEX.exec(c.title.trim());
    if (!m) return false;

    const type = m[1].toLowerCase();

    if (type === 'chore' && !includeChores) return false;

    return true;
  });
}
