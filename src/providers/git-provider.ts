/**
 * Git provider interface re-export
 *
 * Note: The GitProvider interface has been moved to src/interfaces/git-provider.interface.ts
 * This file now serves as a compatibility re-export.
 */

import type { GitProvider } from '../interfaces/git-provider.interface.js';
import { GitLabProvider } from './gitlab-provider.js';
import { GitHubProvider } from './github-provider.js';

export type { GitProvider };
export { GitLabProvider, GitHubProvider };

/**
 * Create provider instance based on type
 */
export function createProvider(
  providerType: 'gitlab' | 'github',
  repositoryUrl: string,
  token?: string
): GitProvider {
  if (providerType === 'gitlab') {
    return new GitLabProvider(repositoryUrl, token);
  } else if (providerType === 'github') {
    return new GitHubProvider(repositoryUrl, token);
  } else {
    throw new Error(`Unknown provider type: ${providerType}`);
  }
}

