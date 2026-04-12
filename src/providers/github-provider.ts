/**
 * GitHub provider implementation
 */

import { Octokit } from 'octokit';
import type { GitProvider } from '../interfaces/git-provider.interface.js';
import type {
  CreatePRParams,
  UpdatePRParams,
  PullRequest,
  Repository,
  CreateTagParams,
  Tag,
  CreateReleaseParams,
  Release,
  CommitFilesParams,
  Commit,
} from '../types/provider.js';
import { FileOperation } from '../processors/types.js';
import * as logger from '../logger.js';

/**
 * GitHub provider implementation using Octokit
 */
export class GitHubProvider implements GitProvider {
  readonly name = 'github';
  private client: Octokit;
  private token: string;
  private owner: string;
  private repo: string;

  constructor(repositoryUrl: string, token?: string) {
    // Use provided token or fall back to environment variable
    const authToken = token || process.env.GITHUB_TOKEN;
    if (!authToken) {
      throw new Error(
        'GitHub authentication token is required. Set it via:\n' +
        '  - CLI: --token <token>\n' +
        '  - Environment: GITHUB_TOKEN'
      );
    }
    this.token = authToken;

    const { host, owner, repo } = this.parseUrl(repositoryUrl);
    this.owner = owner;
    this.repo = repo;

    // Initialize Octokit client
    this.client = new Octokit({
      auth: this.token,
      baseUrl: host === 'https://api.github.com' ? undefined : `${host}/api/v3`,
      throttle: {
        onRateLimit: (retryAfter: number, _options: any) => {
          logger.warn(`⚠️  Rate limit hit, retrying after ${retryAfter}s`);
          return true; // Retry once
        },
        onSecondaryRateLimit: (_retryAfter: number, _options: any) => {
          logger.warn(`⚠️  Secondary rate limit hit`);
          return false; // Don't retry
        },
      },
    });
  }

  /**
   * Parse GitHub repository URL to extract host, owner and repo
   */
  private parseUrl(url: string): { host: string; owner: string; repo: string } {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(p => p);

      if (pathParts.length < 2) {
        throw new Error('Invalid repository URL format');
      }

      // Extract owner and repo (remove .git suffix if present)
      const owner = pathParts[0];
      const repo = pathParts[1].replace(/\.git$/, '');

      // Determine API host based on domain
      let host: string;
      if (urlObj.host === 'github.com') {
        host = 'https://api.github.com';
      } else {
        // GitHub Enterprise
        host = `${urlObj.protocol}//${urlObj.host}`;
      }

      return { host, owner, repo };
    } catch (error) {
      throw new Error(
        `Invalid GitHub repository URL: ${url}. ` +
        `Expected format: https://github.com/owner/repo`
      );
    }
  }

  async getRepository(): Promise<Repository> {
    const { data: repo } = await this.client.rest.repos.get({
      owner: this.owner,
      repo: this.repo,
    });

    return {
      id: repo.id,
      name: repo.name,
      fullPath: repo.full_name,
      defaultBranch: repo.default_branch,
      webUrl: repo.html_url,
    };
  }

  async getDefaultBranch(): Promise<string> {
    const repo = await this.getRepository();
    return repo.defaultBranch;
  }

  async createPullRequest(params: CreatePRParams): Promise<PullRequest> {
    const { data: pr } = await this.client.rest.pulls.create({
      owner: this.owner,
      repo: this.repo,
      title: params.title,
      body: params.body,
      head: params.sourceBranch,
      base: params.targetBranch,
      draft: params.draft,
    });

    // Add labels if provided
    if (params.labels && params.labels.length > 0) {
      await this.client.rest.issues.addLabels({
        owner: this.owner,
        repo: this.repo,
        issue_number: pr.number,
        labels: params.labels,
      });
    }

    // Fetch the updated PR with labels
    const { data: updatedPr } = await this.client.rest.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: pr.number,
    });

    return this.mapPullRequestToPullRequest(updatedPr);
  }

  async updatePullRequest(id: number, params: UpdatePRParams): Promise<PullRequest> {
    const updateParams: any = {
      owner: this.owner,
      repo: this.repo,
      pull_number: id,
    };

    if (params.title !== undefined) updateParams.title = params.title;
    if (params.body !== undefined) updateParams.body = params.body;
    if (params.targetBranch !== undefined) updateParams.base = params.targetBranch;
    if (params.draft !== undefined) updateParams.draft = params.draft;

    await this.client.rest.pulls.update(updateParams);

    // Update labels if provided (replaces all labels)
    if (params.labels !== undefined) {
      await this.client.rest.issues.setLabels({
        owner: this.owner,
        repo: this.repo,
        issue_number: id,
        labels: params.labels,
      });
    }

    // Fetch the updated PR with labels
    const { data: updatedPr } = await this.client.rest.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: id,
    });

    return this.mapPullRequestToPullRequest(updatedPr);
  }

  async updatePullRequestLabels?(id: number | string, toAdd: string[], toRemove: string[], dryRun?: boolean): Promise<void> {
    if (dryRun) {
      logger.info(`[dry-run] Would update labels for PR ${id}: add [${toAdd.join(', ')}], remove [${toRemove.join(', ')}]`);
      return;
    }

    const prNumber = Number(id);

    // Fetch current labels
    const { data: pr } = await this.client.rest.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
    });
    const currentLabels = pr.labels.map((l: any) => typeof l === 'string' ? l : l.name || '').filter(Boolean);

    // Compute new label set
    const newLabels = Array.from(new Set([
      ...currentLabels.filter((l: string) => !toRemove.includes(l)),
      ...toAdd
    ]));

    // Only update if changed
    if (JSON.stringify(newLabels.sort()) !== JSON.stringify(currentLabels.slice().sort())) {
      await this.client.rest.issues.setLabels({
        owner: this.owner,
        repo: this.repo,
        issue_number: prNumber,
        labels: newLabels,
      });
      logger.info(`Updated labels for PR ${id}: [${newLabels.join(', ')}]`);
    } else {
      logger.info(`No label changes needed for PR ${id}`);
    }
  }

  async getPullRequest(id: number): Promise<PullRequest | null> {
    try {
      const { data: pr } = await this.client.rest.pulls.get({
        owner: this.owner,
        repo: this.repo,
        pull_number: id,
      });
      return this.mapPullRequestToPullRequest(pr);
    } catch (error: any) {
      // If not found, return null
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async findPullRequestByBranch(sourceBranch: string, targetBranch: string, label: string, state: 'open' | 'closed' | 'merged'): Promise<PullRequest[]> {
    // GitHub API state: 'open', 'closed', or 'all'
    const apiState = state === 'merged' ? 'closed' : state;

    const { data: prs } = await this.client.rest.pulls.list({
      owner: this.owner,
      repo: this.repo,
      state: apiState === 'open' || apiState === 'closed' ? apiState : 'all',
      head: sourceBranch ? `${this.owner}:${sourceBranch}` : undefined,
      base: targetBranch || undefined,
      sort: 'updated',
      direction: 'desc',
      per_page: 100,
    });

    // Filter by label and merged state
    const filtered = prs.filter((pr: any) => {
      // Check label
      const hasLabel = pr.labels.some((l: any) => (typeof l === 'string' ? l : l.name) === label);
      if (!hasLabel) return false;

      // Check merged state if required
      if (state === 'merged' && !pr.merged_at) return false;
      if (state === 'closed' && pr.merged_at) return false; // Exclude merged PRs from closed state

      return true;
    });

    if (filtered.length === 0) {
      return [];
    }

    return filtered.map((pr: any) => this.mapPullRequestToPullRequest(pr));
  }

  async mergePullRequest(id: number): Promise<void> {
    await this.client.rest.pulls.merge({
      owner: this.owner,
      repo: this.repo,
      pull_number: id,
      merge_method: 'merge',
    });
  }

  async createRelease(params: CreateReleaseParams): Promise<Release> {
    try {
      const { data: release } = await this.client.rest.repos.createRelease({
        owner: this.owner,
        repo: this.repo,
        tag_name: params.tagName,
        name: params.name,
        body: params.description,
        target_commitish: params.ref,
        prerelease: params.prerelease || false,
      });

      return {
        name: release.name || '',
        tagName: release.tag_name,
        description: release.body || '',
        prerelease: release.prerelease,
        webUrl: release.html_url,
        created: true,
        commitSha: release.target_commitish,
      };
    } catch (error: any) {
      logger.warn(`⚠️  Error creating release ${params.name}: ${error.message}`);

      // Try to find the existing release by tag name
      try {
        const { data: release } = await this.client.rest.repos.getReleaseByTag({
          owner: this.owner,
          repo: this.repo,
          tag: params.tagName,
        });

        return {
          name: release.name || '',
          tagName: release.tag_name,
          description: release.body || '',
          prerelease: release.prerelease,
          webUrl: release.html_url,
          created: false,
          commitSha: release.target_commitish,
        };
      } catch (findError: any) {
        logger.warn(`⚠️  Error finding existing release for tag ${params.tagName}: ${findError.message}`);
      }
      throw new Error('Release creation failed and no existing release found');
    }
  }

  async getLatestRelease(): Promise<Release | null> {
    try {
      const { data: release } = await this.client.rest.repos.getLatestRelease({
        owner: this.owner,
        repo: this.repo,
      });

      return {
        name: release.name || '',
        tagName: release.tag_name,
        description: release.body || '',
        prerelease: release.prerelease,
        webUrl: release.html_url,
        created: true,
        commitSha: release.target_commitish,
      };
    } catch (error: any) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async createTags(params: CreateTagParams[]): Promise<Tag[]> {
    const tags: Tag[] = [];

    for (const tagParam of params) {
      try {
        // Create a tag reference
        await this.client.rest.git.createRef({
          owner: this.owner,
          repo: this.repo,
          ref: `refs/tags/${tagParam.name}`,
          sha: tagParam.ref,
        });

        // Optionally create an annotated tag with a message
        if (tagParam.message) {
          try {
            await this.client.rest.git.createTag({
              owner: this.owner,
              repo: this.repo,
              tag: tagParam.name,
              message: tagParam.message,
              object: tagParam.ref,
              type: 'commit',
            });
          } catch (tagError) {
            logger.warn(`⚠️  Created lightweight tag ${tagParam.name}, could not create annotated tag: ${(tagError as Error).message}`);
          }
        }

        tags.push({
          name: tagParam.name,
          commit: tagParam.ref,
          message: tagParam.message,
          createdAt: new Date(),
        });
      } catch (error: any) {
        logger.warn(`⚠️  Error creating tag ${tagParam.name}: ${error.message}`);
      }
    }

    return tags;
  }

  async getTags(maxCount: number = 100): Promise<Tag[]> {
    const tags: Tag[] = [];

    try {
      const iterator = this.client.paginate.iterator(this.client.rest.repos.listTags, {
        owner: this.owner,
        repo: this.repo,
        per_page: 100,
      });

      for await (const { data: batch } of iterator) {
        for (const tag of batch) {
          if (tags.length >= maxCount) {
            logger.warn(`⚠️  Reached maximum tag limit (${maxCount}). Some tags may not be included.`);
            return tags;
          }

          tags.push({
            name: tag.name,
            commit: tag.commit.sha,
            message: undefined, // GitHub list tags API doesn't include message
            createdAt: undefined, // Not available in list tags API
          });
        }
      }

      return tags;
    } catch (error: any) {
      logger.warn(`⚠️  Error fetching tags: ${error.message}. Continuing with ${tags.length} tags.`);
      return tags;
    }
  }

  async getTag(name: string): Promise<Tag | null> {
    try {
      const { data: ref } = await this.client.rest.git.getRef({
        owner: this.owner,
        repo: this.repo,
        ref: `tags/${name}`,
      });
      return {
        name,
        commit: ref.object.sha,
        message: undefined,
        createdAt: undefined,
      };
    } catch {
      return null;
    }
  }

  async commitFiles(params: CommitFilesParams): Promise<void> {
    // Step 1: Get the current commit SHA from the start branch
    const { data: refData } = await this.client.rest.git.getRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${params.startBranch || params.branch}`,
    });
    const currentCommitSha = refData.object.sha;

    // Step 2: Get the current commit to get the tree SHA
    const { data: currentCommit } = await this.client.rest.git.getCommit({
      owner: this.owner,
      repo: this.repo,
      commit_sha: currentCommitSha,
    });
    const currentTreeSha = currentCommit.tree.sha;

    // Step 3: Create blobs for each file
    const blobPromises = params.files.map(async (file) => {
      const { data: blob } = await this.client.rest.git.createBlob({
        owner: this.owner,
        repo: this.repo,
        content: Buffer.from(file.content).toString('base64'),
        encoding: 'base64',
      });
      return {
        path: file.path,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blob.sha,
      };
    });
    const blobs = await Promise.all(blobPromises);

    // Step 4: Create a new tree with the blobs
    const { data: newTree } = await this.client.rest.git.createTree({
      owner: this.owner,
      repo: this.repo,
      base_tree: currentTreeSha,
      tree: blobs,
    });

    // Step 5: Create a new commit
    const { data: newCommit } = await this.client.rest.git.createCommit({
      owner: this.owner,
      repo: this.repo,
      message: params.message,
      tree: newTree.sha,
      parents: [currentCommitSha],
    });

    // Step 6: Update the branch reference
    await this.client.rest.git.updateRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${params.branch}`,
      sha: newCommit.sha,
      force: params.force ?? false,
    });
  }

  async getReleases(maxCount: number = 100): Promise<Release[]> {
    const releases: Release[] = [];

    try {
      const iterator = this.client.paginate.iterator(this.client.rest.repos.listReleases, {
        owner: this.owner,
        repo: this.repo,
        per_page: 100,
      });

      for await (const { data: batch } of iterator) {
        for (const release of batch) {
          if (releases.length >= maxCount) {
            logger.warn(`⚠️  Reached maximum release limit (${maxCount}). Some releases may not be included.`);
            return releases;
          }

          releases.push({
            name: release.name || '',
            tagName: release.tag_name,
            description: release.body || '',
            prerelease: release.prerelease,
            webUrl: release.html_url,
            created: true,
            commitSha: release.target_commitish,
          });
        }
      }

      return releases;
    } catch (error: any) {
      logger.warn(`⚠️  Error fetching releases: ${error.message}. Continuing with ${releases.length} releases.`);
      return releases;
    }
  }

  async getCommits(maxCount: number = 100, tags?: Tag[] | null, untilSha?: string, branch?: string): Promise<Commit[]> {
    const commits: Commit[] = [];

    // Build commit-to-tags map based on input
    let tagsMap: Map<string, Tag[]>;
    if (tags === null) {
      // Explicit null means skip tag mapping entirely
      tagsMap = new Map();
    } else {
      // Use provided tags array
      tagsMap = this.buildTagsMapFromArray(tags || []);
    }

    try {
      const iterator = this.client.paginate.iterator(this.client.rest.repos.listCommits, {
        owner: this.owner,
        repo: this.repo,
        per_page: 100,
        ...(branch ? { sha: branch } : {}),
      });

      for await (const { data: batch } of iterator) {
        for (const commit of batch) {
          // Stop if we've reached the until commit (exclusive)
          if (untilSha && commit.sha === untilSha) {
            return commits;
          }

          if (commits.length >= maxCount) {
            logger.warn(`⚠️  Reached maximum commit limit (${maxCount}). Some commits may not be included.`);
            return commits;
          }

          // Split message into title (first line) and full message
          const message = commit.commit.message || '';
          const title = message.split('\n')[0] || '';

          // Fetch files changed in this commit
          const files = await this.getCommitFiles(commit.sha);

          commits.push({
            sha: commit.sha,
            tags: tagsMap.get(commit.sha) || [],
            message,
            title,
            author: {
              name: commit.commit.author?.name || '',
              email: commit.commit.author?.email || '',
            },
            date: new Date(commit.commit.author?.date || Date.now()),
            files,
            branch,
          });
        }
      }

      return commits;
    } catch (error: any) {
      logger.warn(`⚠️  Error fetching commits: ${error.message}. Continuing with ${commits.length} commits.`);
      return commits;
    }
  }

  /**
   * Get list of files changed in a specific commit
   */
  private async getCommitFiles(commitSha: string): Promise<string[]> {
    try {
      const { data: commit } = await this.client.rest.repos.getCommit({
        owner: this.owner,
        repo: this.repo,
        ref: commitSha,
      });
      return commit.files?.map((file: any) => file.filename).filter(Boolean) || [];
    } catch (error: any) {
      logger.warn(`⚠️  Error fetching files for commit ${commitSha}: ${error.message}`);
      return [];
    }
  }

  /**
   * Build a map of commit SHA to tags from a provided array
   */
  private buildTagsMapFromArray(tags: Tag[]): Map<string, Tag[]> {
    const tagsMap = new Map<string, Tag[]>();

    for (const tag of tags) {
      const commitSha = tag.commit;
      const existingTags = tagsMap.get(commitSha) || [];
      existingTags.push(tag);
      tagsMap.set(commitSha, existingTags);
    }

    return tagsMap;
  }

  /**
   * Map GitHub Pull Request to our PullRequest interface
   */
  private mapPullRequestToPullRequest(pr: any): PullRequest {
    return {
      id: pr.number,
      number: pr.number,
      title: pr.title,
      body: pr.body || '',
      sourceBranch: pr.head.ref,
      targetBranch: pr.base.ref,
      state: pr.merged_at ? 'merged' : (pr.state === 'open' ? 'open' : 'closed'),
      draft: pr.draft || false,
      webUrl: pr.html_url,
      labels: pr.labels.map((l: any) => typeof l === 'string' ? l : l.name).filter(Boolean),
      createdAt: new Date(pr.created_at),
      updatedAt: new Date(pr.updated_at),
      mergeSha: pr.merge_commit_sha,
    };
  }

  async createReleasePR(
    title: string,
    body: string,
    sourceBranch: string,
    targetBranch: string,
    prDestBranch: string,
    files: Array<FileOperation>,
    tags: string[],
    nextVersion: string
  ): Promise<number> {
    logger.debug('GitHubProvider.createReleasePR called with:', {
      title,
      targetBranch,
      filesCount: files?.length ?? 0,
      nextVersion,
      sourceBranch,
      tagsCount: tags.length,
    });

    // Step 1: Get the target branch ref
    const { data: targetRef } = await this.client.rest.git.getRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${targetBranch}`,
    });

    // Step 2: Create the source branch from target branch
    try {
      await this.client.rest.git.createRef({
        owner: this.owner,
        repo: this.repo,
        ref: `refs/heads/${sourceBranch}`,
        sha: targetRef.object.sha,
      });
    } catch (error: any) {
      // If branch already exists, ignore the error
      if (error.status !== 422) {
        throw error;
      }
    }

    // Step 3: Commit files to the source branch
    await this.commitFiles({
      branch: sourceBranch,
      startBranch: targetBranch,
      message: title,
      files: files.map(f => ({ path: f.path, content: f.content })),
    });

    // Step 4: Create the pull request
    const { data: pr } = await this.client.rest.pulls.create({
      owner: this.owner,
      repo: this.repo,
      title,
      body,
      head: sourceBranch,
      base: targetBranch,
    });

    // Step 5: Add labels
    if (tags && tags.length > 0) {
      await this.client.rest.issues.addLabels({
        owner: this.owner,
        repo: this.repo,
        issue_number: pr.number,
        labels: tags,
      });
    }

    logger.info('Created Pull Request:', pr.html_url);

    if (prDestBranch !== targetBranch) {
      await this.client.rest.pulls.update({
        owner: this.owner,
        repo: this.repo,
        pull_number: pr.number,
        base: prDestBranch,
      });
      logger.debug(`Changed PR base branch from ${targetBranch} to ${prDestBranch}`);
    }

    return pr.number;
  }

  async updateReleasePR(
    title: string,
    body: string,
    prId: string,
    sourceBranch: string,
    targetBranch: string,
    prDestBranch: string,
    files: Array<FileOperation>,
    tags: string[],
    nextVersion: string
  ): Promise<void> {
    logger.debug('GitHubProvider.updateReleasePR called with:', {
      title,
      prId,
      targetBranch,
      filesCount: files?.length ?? 0,
      nextVersion,
      sourceBranch,
      tagsCount: tags.length,
    });

    const id = parseInt(prId, 10);
    if (isNaN(id)) {
      throw new Error(`Invalid PR id: ${prId}`);
    }

    // Step 1: Commit files to the source branch (force update to fast-forward the branch)
    await this.commitFiles({
      branch: sourceBranch,
      startBranch: targetBranch,
      message: title,
      files: files.map(f => ({ path: f.path, content: f.content })),
      force: true,
    });

    // Step 2: Update the pull request
    const { data: pr } = await this.client.rest.pulls.update({
      owner: this.owner,
      repo: this.repo,
      pull_number: id,
      title,
      body,
      state: 'open'
    });

    // Step 3: Update labels
    if (tags && tags.length > 0) {
      await this.client.rest.issues.setLabels({
        owner: this.owner,
        repo: this.repo,
        issue_number: id,
        labels: tags,
      });
    }

    logger.info('Updated Pull Request:', pr.html_url);

    if (prDestBranch !== targetBranch) {
      await this.client.rest.pulls.update({
        owner: this.owner,
        repo: this.repo,
        pull_number: id,
        base: prDestBranch,
      });
      logger.debug(`Changed PR base branch from ${targetBranch} to ${prDestBranch}`);
    }
  }

  /**
   * Get file contents from the repository
   */
  async getFileContents(path: string, ref?: string): Promise<string | null> {
    try {
      const { data } = await this.client.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ...(ref !== undefined && { ref }),
      });

      // Check if it's a file (not a directory)
      if (Array.isArray(data)) {
        throw new Error(`Path ${path} is a directory, not a file`);
      }

      if ('content' in data && data.content) {
        // The content is base64 encoded
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }

      return null;
    } catch (error: any) {
      // Return null if file doesn't exist (404)
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async listAllFiles(branchName: string): Promise<string[]> {
    try {
      const { data: tree } = await this.client.rest.git.getTree({
        owner: this.owner,
        repo: this.repo,
        tree_sha: branchName,
        recursive: 'true',
      });
      if (tree.truncated) {
        logger.warn('⚠️  Repository tree is truncated. Some files may be missing.');
      }
      return tree.tree
        .filter((item: any) => item.type === 'blob' && item.path)
        .map((item: any) => item.path as string);
    } catch (error: any) {
      if (error.status === 404) {
        return [];
      }
      throw error;
    }
  }

}
