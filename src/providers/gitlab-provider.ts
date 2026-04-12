/**
 * GitLab provider implementation
 */

import { Gitlab } from '@gitbeaker/node';
import type { Types } from '@gitbeaker/node';
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
 * GitLab provider implementation using @gitbeaker/node
 */
export class GitLabProvider implements GitProvider {
  readonly name = 'gitlab';
  private client: InstanceType<typeof Gitlab>;
  private token: string;
  private host: string;
  private projectPath: string;
  private projectId?: string | number;



  constructor(repositoryUrl: string, token?: string) {
    // Use provided token or fall back to environment variable
    const authToken = token || process.env.GITLAB_TOKEN;
    if (!authToken) {
      throw new Error(
        'GitLab authentication token is required. Set it via:\n' +
        '  - CLI: --token <token>\n' +
        '  - Environment: GITLAB_TOKEN'
      );
    }
    this.token = authToken;

    const { host, projectPath } = this.parseUrl(repositoryUrl);
    this.host = host;
    this.projectPath = projectPath;

    // Initialize client
    this.client = new Gitlab({
      token: this.token,
      host: this.host,
    });
  }

  /**
   * Parse GitLab repository URL to extract host and project path
   */
  private parseUrl(url: string): { host: string; projectPath: string } {
    try {
      const urlObj = new URL(url);
      const host = `${urlObj.protocol}//${urlObj.host}`;
      const pathParts = urlObj.pathname.split('/').filter(p => p);

      if (pathParts.length < 2) {
        throw new Error('Invalid repository URL format');
      }

      // Remove .git suffix if present
      const projectPath = pathParts.join('/').replace(/\.git$/, '');

      return { host, projectPath };
    } catch (error) {
      throw new Error(
        `Invalid GitLab repository URL: ${url}. ` +
        `Expected format: https://gitlab.com/owner/repo`
      );
    }
  }

  async getRepository(): Promise<Repository> {
    // Fetch project ID if not already cached
    if (!this.projectId) {
      const project = await this.client.Projects.show(this.projectPath);
      this.projectId = project.id;
    }

    const project = await this.client.Projects.show(this.projectId);

    return {
      id: project.id,
      name: project.name,
      fullPath: project.path_with_namespace,
      defaultBranch: project.default_branch || 'main',
      webUrl: project.web_url,
    };
  }

  async getDefaultBranch(): Promise<string> {
    const repo = await this.getRepository();
    return repo.defaultBranch;
  }

  async createPullRequest(params: CreatePRParams): Promise<PullRequest> {
    const mr = await this.client!.MergeRequests.create(
      this.projectId!,
      params.sourceBranch,
      params.targetBranch,
      params.title,
      {
        description: params.body,
        labels: params.labels?.join(','),
        // GitLab uses work_in_progress for draft MRs in older versions
        // Newer versions use draft parameter
      }
    );

    // If draft is requested, update the title to mark as draft
    if (params.draft && !mr.title.startsWith('Draft:')) {
      await this.client!.MergeRequests.edit(this.projectId!, mr.iid, {
        title: `Draft: ${mr.title}`,
      });
    }

    return this.mapMergeRequestToPullRequest(mr);
  }

  async updatePullRequest(id: number, params: UpdatePRParams): Promise<PullRequest> {
    const updateParams: any = {};
    if (params.title !== undefined) updateParams.title = params.title;
    if (params.body !== undefined) updateParams.description = params.body;
    if (params.targetBranch !== undefined) updateParams.targetBranch = params.targetBranch;
    if (params.labels !== undefined) updateParams.labels = params.labels.join(',');

    // Handle draft status via title prefix
    if (params.draft !== undefined) {
      const currentMr = await this.client!.MergeRequests.show(this.projectId!, id);
      const currentTitle = params.title || currentMr.title;

      if (params.draft && !currentTitle.startsWith('Draft:')) {
        updateParams.title = `Draft: ${currentTitle.replace(/^Draft:\s*/i, '')}`;
      } else if (!params.draft && currentTitle.startsWith('Draft:')) {
        updateParams.title = currentTitle.replace(/^Draft:\s*/i, '');
      }
    }

    const mr = await this.client!.MergeRequests.edit(this.projectId!, id, updateParams);
    return this.mapMergeRequestToPullRequest(mr);
  }

  async updatePullRequestLabels?(id: number | string, toAdd: string[], toRemove: string[], dryRun?: boolean): Promise<void> {
    if (dryRun) {
      (this as any).logger?.info?.(`[dry-run] Would update labels for MR ${id}: add [${toAdd.join(', ')}], remove [${toRemove.join(', ')}]`);
      return;
    }
    // Fetch current labels
    const mr = await this.client.MergeRequests.show(this.projectId!, Number(id));
    const currentLabels: string[] = mr.labels || [];
    // Compute new label set
    const newLabels = Array.from(new Set([
      ...currentLabels.filter(l => !toRemove.includes(l)),
      ...toAdd
    ]));
    // Only update if changed
    if (JSON.stringify(newLabels.sort()) !== JSON.stringify(currentLabels.slice().sort())) {
      await this.client.MergeRequests.edit(this.projectId!, Number(id), { labels: newLabels });
      (this as any).logger?.info?.(`Updated labels for MR ${id}: [${newLabels.join(', ')}]`);
    } else {
      (this as any).logger?.info?.(`No label changes needed for MR ${id}`);
    }
  }

  async getPullRequest(id: number): Promise<PullRequest | null> {
    try {
      const mr = await this.client!.MergeRequests.show(this.projectId!, id);
      return this.mapMergeRequestToPullRequest(mr);
    } catch (error) {
      // If not found, return null
      if ((error as any).response?.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async findPullRequestByBranch(sourceBranch: string, targetBranch: string, label: string, state: 'open' | 'closed' | 'merged'): Promise<PullRequest[]> {
    const apiState = state === 'open' ? 'opened' : state;
    const params: any = {
      projectId: this.projectPath,
      sourceBranch,
      targetBranch,
      state: apiState,
      labels: label,
      orderBy: state === 'merged' ? 'merged_at' : 'updated_at',
      sort: 'desc',
      perPage: 5,
    };

    const mrs = await this.client!.MergeRequests.all(params);

    if (!mrs || mrs.length === 0) {
      return [];
    }

    return mrs.map((mr: any) => this.mapMergeRequestToPullRequest(mr));
  }

  // NOTE: Removed `findPullRequestByLabel` in favor of a single `findPullRequestByBranch` that accepts optional source/target branches.
  // Use: findPullRequestByBranch(undefined, undefined, label, state) to search across branches by label.

  async mergePullRequest(id: number): Promise<void> {
    await this.client!.MergeRequests.accept(this.projectId!, id, {
      shouldRemoveSourceBranch: false,
      mergeWhenPipelineSucceeds: false,
    });
  }

  async createRelease(params: CreateReleaseParams): Promise<Release> {
    try {
      const release = await this.client!.Releases.create(this.projectId!, {
        name: params.name,
        tagName: params.tagName,
        description: params.description,
        ref: params.ref,
      });
      return {
        name: release.name,
        tagName: release.tag_name,
        description: release.description || '',
        prerelease: params.prerelease || false,
        webUrl: (release as any)._links?.self,
        created: true,
        commitSha: release.commit?.id,
      };
    } catch (error) {
      logger.warn(`⚠️  Error creating release ${params.name}: ${(error as any).description}`);
      // Try to find the existing release by tag name
      try {
        const releases = await this.client!.Releases.all(this.projectId!, {
          perPage: 3,
          orderBy: 'released_at',
          sort: 'desc',
        });
        const existing = releases.find((r: any) => r.tag_name === params.tagName);
        if (existing) {
          return {
            name: existing.name,
            tagName: existing.tag_name,
            description: existing.description || '',
            prerelease: false,
            webUrl: (existing as any)._links?.self,
            created: false,
            commitSha: existing.commit?.id,
          };
        }
      } catch (findError) {
        logger.warn(`⚠️  Error finding existing release for tag ${params.tagName}: ${(findError as any).message}`);
      }
      throw new Error('Release creation failed and no existing release found');
    }
  }

  async getLatestRelease(): Promise<Release | null> {
    try {
      const releases = await this.client!.Releases.all(this.projectId!, {
        perPage: 1,
        orderBy: 'released_at',
        sort: 'desc',
      });

      if (releases.length === 0) {
        return null;
      }

      const release = releases[0];
      return {
        name: release.name,
        tagName: release.tag_name,
        description: release.description || '',
        prerelease: false, // GitLab doesn't have a built-in prerelease flag
        webUrl: (release as any)._links?.self,
        created: true,
        commitSha: release.commit?.id,
      };
    } catch (error) {
      return null;
    }
  }

  async createTags(params: CreateTagParams[]): Promise<Tag[]> {
    const tags: Tag[] = [];

    for (const tagParam of params) {
      try {
        const tag = await this.client.Tags.create(this.projectPath, tagParam.name, tagParam.ref, {
          message: tagParam.message,
        });

        tags.push({
          name: tag.name,
          commit: tag.commit.id,
          message: tag.message || undefined,
          createdAt: tag.commit.created_at ? new Date(tag.commit.created_at) : undefined,
        });
      } catch (error) {
        logger.warn(`⚠️  Error creating tag ${tagParam.name}: ${(error as any).description}`);
      }
    }

    return tags;
  }

  async getTags(maxCount: number = 100): Promise<Tag[]> {
    const tags: Tag[] = [];
    const perPage = 100;
    let page = 1;
    let hasMore = true;

    try {
      while (hasMore && tags.length < maxCount) {
        const batch = await this.client!.Tags.all(this.projectId!, {
          perPage,
          page,
          orderBy: 'updated',
          sort: 'desc',
        });

        if (batch.length === 0) {
          hasMore = false;
          break;
        }

        for (const tag of batch) {
          if (tags.length >= maxCount) {
            hasMore = false;
            break;
          }

          tags.push({
            name: tag.name,
            commit: tag.commit.id,
            message: tag.message || undefined,
            createdAt: tag.commit.created_at ? new Date(tag.commit.created_at) : undefined,
          });
        }

        if (batch.length < perPage) {
          hasMore = false;
        }

        page++;
      }

      if (tags.length >= maxCount) {
        logger.warn(`⚠️  Reached maximum tag limit (${maxCount}). Some tags may not be included.`);
      }

      return tags;
    } catch (error) {
      logger.warn(`⚠️  Error fetching tags: ${(error as Error).message}. Continuing with ${tags.length} tags.`);
      return tags;
    }
  }

  async getTag(name: string): Promise<Tag | null> {
    try {
      const tag = await this.client!.Tags.show(this.projectId!, name);
      return {
        name: tag.name,
        commit: tag.commit.id,
        message: tag.message || undefined,
        createdAt: tag.commit.created_at ? new Date(tag.commit.created_at) : undefined,
      };
    } catch {
      return null;
    }
  }

  async commitFiles(params: CommitFilesParams): Promise<void> {
    const actions = params.files.map(file => ({
      action: 'update' as const,
      filePath: file.path,
      content: file.content,
    }));

    await this.client!.Commits.create(this.projectId!, params.branch, params.message, actions, {
      startBranch: params.startBranch,
    });
  }

  async getReleases(maxCount: number = 100): Promise<Release[]> {
    const releases: Release[] = [];
    const perPage = 100;
    let page = 1;
    let hasMore = true;

    try {
      while (hasMore && releases.length < maxCount) {
        const batch = await this.client!.Releases.all(this.projectId!, {
          perPage,
          page,
          orderBy: 'released_at',
          sort: 'desc',
        });

        if (batch.length === 0) {
          hasMore = false;
          break;
        }

        for (const release of batch) {
          if (releases.length >= maxCount) {
            hasMore = false;
            break;
          }

          releases.push({
            name: release.name,
            tagName: release.tag_name,
            description: release.description || '',
            prerelease: false, // GitLab doesn't have a built-in prerelease flag
            webUrl: (release as any)._links?.self,
            created: true,
            commitSha: release.commit?.id,
          });
        }

        if (batch.length < perPage) {
          hasMore = false;
        }

        page++;
      }

      if (releases.length >= maxCount) {
        logger.warn(`⚠️  Reached maximum release limit (${maxCount}). Some releases may not be included.`);
      }

      return releases;
    } catch (error) {
      logger.warn(`⚠️  Error fetching releases: ${(error as Error).message}. Continuing with ${releases.length} releases.`);
      return releases;
    }
  }

  async getCommits(maxCount: number = 100, tags?: Tag[] | null, untilSha?: string, branch?: string): Promise<Commit[]> {
    const commits: Commit[] = [];
    const perPage = 100;
    let page = 1;
    let hasMore = true;

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
      while (hasMore && commits.length < maxCount) {
        const batch = await this.client.Commits.all(this.projectId!, {
          perPage,
          page,
          refName: branch, // Restrict commits to the specified branch
        });

        if (batch.length === 0) {
          hasMore = false;
          break;
        }

        for (const commit of batch) {
          // Stop if we've reached the until commit (exclusive)
          if (untilSha && commit.id === untilSha) {
            hasMore = false;
            break;
          }

          if (commits.length >= maxCount) {
            hasMore = false;
            break;
          }

          // Split message into title (first line) and full message
          const message = commit.message || '';
          const title = message.split('\n')[0] || '';

          // Fetch files changed in this commit
          const files = await this.getCommitFiles(commit.id);

          commits.push({
            sha: commit.id,
            tags: tagsMap.get(commit.id) || [],
            message,
            title,
            author: {
              name: commit.author_name || '',
              email: commit.author_email || '',
            },
            date: new Date(commit.created_at || commit.committed_date),
            files,
            branch,
          });
        }

        if (batch.length < perPage) {
          hasMore = false;
        }

        page++;
      }

      if (commits.length >= maxCount) {
        logger.warn(`⚠️  Reached maximum commit limit (${maxCount}). Some commits may not be included.`);
      }
      // log how many commits were fetched and how many had tags
      const taggedCommits = commits.filter(c => c.tags && c.tags.length > 0).length;
      logger.debug(`   Found ${commits.length} commit(s), of which ${taggedCommits} had tags.`);

      return commits;
    } catch (error) {
      logger.warn(`⚠️  Error fetching commits: ${(error as Error).message}. Continuing with ${commits.length} commits.`);
      return commits;
    }
  }

  /**
   * Get list of files changed in a specific commit
   */
  private async getCommitFiles(commitSha: string): Promise<string[]> {
    try {
      const diff = await this.client!.Commits.diff(this.projectId!, commitSha);
      return diff.map((file: any) => file.new_path || file.old_path).filter(Boolean);
    } catch (error) {
      logger.warn(`⚠️  Error fetching files for commit ${commitSha}: ${(error as Error).message}`);
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
   * Map GitLab MergeRequest to our PullRequest interface
  */
  private mapMergeRequestToPullRequest(mr: any): PullRequest {
    const isDraft = mr.title.startsWith('Draft:') || mr.work_in_progress || mr.draft;

    return {
      id: mr.iid,
      number: mr.iid,
      title: mr.title,
      body: mr.description || '',
      sourceBranch: mr.source_branch,
      targetBranch: mr.target_branch,
      state: mr.state === 'merged' ? 'merged' : (mr.state === 'opened' ? 'open' : 'closed'),
      draft: isDraft,
      webUrl: mr.web_url,
      labels: mr.labels || [],
      createdAt: new Date(mr.created_at),
      updatedAt: new Date(mr.updated_at),
      mergeSha: mr.merge_commit_sha,
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
    logger.debug('GitLabProvider.createReleasePR called with:', {
      title,
      targetBranch,
      filesCount: files?.length ?? 0,
      nextVersion,
      sourceBranch,
      tagsCount: tags.length,
    });

    const actions = files.map(file => {
      return {
        action: file.status === 'created' ? 'create' : 'update',
        content: file.content,
        file_path: file.path,
        encoding: 'text',
      } as unknown as Types.CommitAction;
    });

    await this.client.Commits.create(
      this.projectPath,
      sourceBranch,
      title,
      actions,
      {
        startBranch: targetBranch,
        force: true,
      }
    );

    // Create the merge request
    const mergeRequest = await this.client.MergeRequests.create(
      this.projectPath,
      sourceBranch,
      targetBranch,
      title,
      {
        description: body,
        labels: tags,
        squash: true,
        removeSourceBranch: true,
      }
    );

    logger.info('Created Merge Request:', mergeRequest.web_url);

    if (prDestBranch !== targetBranch) {
      await this.client.MergeRequests.edit(this.projectId!, mergeRequest.iid, { targetBranch: prDestBranch } as any);
      logger.debug(`Changed MR target branch from ${targetBranch} to ${prDestBranch}`);
    }

    return mergeRequest.iid;
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
    logger.debug('GitLabProvider.updateReleasePR called with:', {
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

    const actions = files.map(file => {
      return {
        action: file.status === 'created' ? 'create' : 'update',
        content: file.content,
        file_path: file.path,
        encoding: 'text',
      } as unknown as Types.CommitAction;
    });

    await this.client.Commits.create(
      this.projectPath,
      sourceBranch,
      title,
      actions,
      {
        startBranch: targetBranch,
        force: true,
      }
    );

    // Update the merge request
    const mr = await this.client.MergeRequests.edit(this.projectId!, id,
      {
        title,
        description: body,
        labels: tags,
      }
    );
    logger.info('Updated Merge Request:', mr.web_url);

    if (prDestBranch !== targetBranch) {
      await this.client.MergeRequests.edit(this.projectId!, id, { targetBranch: prDestBranch } as any);
      logger.debug(`Changed MR target branch from ${targetBranch} to ${prDestBranch}`);
    }

    return Promise.resolve();
  }

  /**
   * Get file contents from the repository
   */
  async getFileContents(path: string, ref?: string): Promise<string | null> {
    if (!ref) return null;
    try {
      const file = await this.client!.RepositoryFiles.show(
        this.projectId!,
        path,
        ref
      );

      // The content is base64 encoded
      if (file.content) {
        return Buffer.from(file.content, 'base64').toString('utf-8');
      }

      return null;
    } catch (error: any) {
      // Return null if file doesn't exist (404)
      if (error.response?.status === 404 || error.cause?.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async listAllFiles(branchName: string): Promise<string[]> {
    try {
      const tree = await this.client!.Repositories.tree(this.projectId!, {
        recursive: true,
        ref: branchName,
        perPage: 100,
      });
      return tree
        .filter((item: any) => item.type === 'blob')
        .map((item: any) => item.path as string);
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

}
