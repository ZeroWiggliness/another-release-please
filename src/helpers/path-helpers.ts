/**
 * Path helper utilities
 */

/**
 * Normalize a path to use forward slashes and handle special cases
 * @param path - Path to normalize
 * @returns Normalized path
 */
export function normalizePath(path: string): string {
  // Convert backslashes to forward slashes
  let normalized = path.replace(/\\/g, '/');

  // Convert "." to empty string for root path
  if (normalized === '.') {
    normalized = '';
  }

  // Remove leading "./" if present
  if (normalized.startsWith('./')) {
    normalized = normalized.substring(2);
  }

  // Remove trailing slash
  if (normalized.endsWith('/') && normalized.length > 0) {
    normalized = normalized.substring(0, normalized.length - 1);
  }

  return normalized;
}

/**
 * Build the release source branch name from a prefix and target branch.
 * Any `/` or `\` in the target branch are converted to `-`.
 */
export function buildSourceBranch(branchPrefix: string, targetBranch: string, prBranch: string): string {
  const safeBranch = targetBranch.replace(/[\/\\]/g, '-');
  const safePrBranch = prBranch.replace(/[\/\\]/g, '-');
  return `${branchPrefix}arp--${safeBranch}--${safePrBranch}`;
}

/**
 * Check if a file is under the manifest's path
 * @param file - Normalized file path
 * @param manifestPath - Normalized manifest path
 * @returns True if file is under manifest path
 */
export function isFileInManifestPath(file: string, manifestPath: string): boolean {
  // If manifest path is empty (root), all files match
  if (manifestPath === '') {
    return true;
  }

  // Check if file starts with manifest path
  return file.startsWith(manifestPath + '/') || file === manifestPath;
}
