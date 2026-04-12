export interface CommandError {
  error: true;
  message: string;
  code?: number;
  details?: Record<string, unknown>;
}

import type { ManifestItemSchema } from '../types/manifest.js';
import type { ReleaseConfig } from '../config/config-types.js';

export interface InitManifestReturn {
  provider?: 'gitlab' | 'github';
  release?: ReleaseConfig;
  version?: string;
  type?: string;
  dryRun?: boolean;
  manifests: ManifestItemSchema[];
}

import type { FileOperation } from '../processors/types.js';

export interface ReleasePrReturn {
  sourceBranch: string;
  targetBranch: string;
  created: boolean;
  updated: boolean;
  prNumber?: number;
  prUrl?: string;
  manifestFiles?: FileOperation[];
  prTags?: string[];
  currentVersion?: string;
  manifestCurrentVersions?: string[];
  nextVersion?: string;
  manifestNextVersions?: string[];
  dryRun?: boolean;
}

export interface CalculateNextReturn {
  targetBranch: string;
  nextVersion: string;
  manifestNextVersions?: string[];
  currentVersion?: string;
  manifestFiles?: FileOperation[];
  manifestCurrentVersions?: string[];
  committed?: boolean;
  writtenLocal?: boolean;
  dryRun?: boolean;
}

import type { Release } from '../types/provider.js';

export interface ReleaseReturn {
  tagName: string;
  created: boolean;
  releaseUrl?: string;
  release?: Release;
  currentVersion?: string;
  manifestVersions?: string[];
}
