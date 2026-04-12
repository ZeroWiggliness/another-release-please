/**
 * Semantic versioning implementation
 */

import semver from 'semver';
import type { Versioner, VersionBumpLevel } from '../interfaces/versioner.interface.js';
import { Version } from './version.js';

/**
 * Semantic versioning (semver) implementation
 * Handles versions in the format: major.minor.patch (e.g., 1.2.3)
 */
export class SemverVersioner implements Versioner {
  readonly versionPrefix: string;

  constructor(versionPrefix = 'v') {
    this.versionPrefix = versionPrefix;
  }

  /**
   * Check if a string matches the semver format
   * @param version - Version string to validate
   * @returns True if the version is valid semver
   */
  match(version: string): boolean {
    // Remove configured prefix if present for validation
    const cleanVersion = version.startsWith(this.versionPrefix) ? version.slice(this.versionPrefix.length) : version;
    return semver.valid(cleanVersion) !== null;
  }

  /**
   * Increment a semver version string
   * @param version - Current version string
   * @param level - Version bump level (major, minor, or patch)
   * @returns Incremented version string
   * @throws Error if version is invalid
   */
  increment(version: string, level: VersionBumpLevel): string {
    // Preserve configured prefix if present
    const hasPrefix = version.startsWith(this.versionPrefix);
    const cleanVersion = hasPrefix ? version.slice(this.versionPrefix.length) : version;

    // Validate the version
    if (!semver.valid(cleanVersion)) {
      throw new Error(`Invalid semver version: ${version}`);
    }

    // Increment the version
    const incremented = semver.inc(cleanVersion, level);
    if (!incremented) {
      throw new Error(`Failed to increment version ${version} at level ${level}`);
    }

    // Restore configured prefix if it was present
    return hasPrefix ? `${this.versionPrefix}${incremented}` : incremented;
  }

  /**
   * Parse a version string into a Version instance
   * @param version - Version string to parse
   * @returns A Version instance
   * @throws Error if version is invalid
   */
  version(version: string): Version {
    // Strip configured prefix before parsing, preserve it for toString()
    const hasPrefix = version.startsWith(this.versionPrefix) && this.versionPrefix.length > 0;
    const cleanVersion = hasPrefix ? version.slice(this.versionPrefix.length) : version;
    const parsed = semver.parse(cleanVersion);
    if (!parsed) {
      throw new Error(`Invalid semver version: ${version}`);
    }

    return new Version(
      parsed.major,
      parsed.minor,
      parsed.patch,
      parsed.prerelease as (string | number)[] | undefined,
      parsed.build as string[] | undefined,
      hasPrefix ? this.versionPrefix : undefined
    );
  }

  /**
   * Calculate the next version based on an array of commits using Conventional Commit rules
   * @param commits - Array of commits (newest first)
   * @param currentVersion - Current version string
   * @param isPrerelease - Whether to produce a prerelease
   * @returns A Version instance representing the next version
   */
  calculateNextVersion(commits: import('../types/provider.js').Commit[], currentVersion: string, isPrerelease: boolean, includeChores = false, versionPrefix?: string, identifier?: string, identifierBase?: string): Version {
    const effectivePrefix = versionPrefix ?? this.versionPrefix;
    const effectiveIdentifier = identifier ?? 'prerelease';
    const effectiveIdentifierBase = identifierBase as unknown as '0' | '1' | undefined;
    // Use numeric priority to decide bump: 0 = none, 1 = patch, 2 = minor, 3 = major
    let priority = 0;
    let forceVersion: string | undefined = undefined;

    if (commits.length === 0) {
      // No commits, return current version as Version instance
      priority = 1; // Bump patch by default
    }
    else {
      for (const commit of commits) {
        const title = commit.title || '';

        // Breaking changes: any type with ! or BREAKING CHANGE: in message footer
        if (/^\w+(?:\([^)]+\))?!:/.test(title) || /^BREAKING CHANGE:/m.test(commit.message || '')) {
          priority = 3;
          break;
        }

        // Feature -> minor
        if (/^feat(?:\([^)]+\))?:/.test(title)) {
          priority = Math.max(priority, 2);
          continue;
        }

        // Fix -> patch
        if (/^fix(?:\([^)]+\))?:/.test(title)) {
          priority = Math.max(priority, 1);
          continue;
        }

        // Chore does nothing
        if (/^chore(?:\([^)]+\))?:/.test(title)) {   // TODO : should chores really not bump at all? or only in prerelease?
          priority = Math.max(priority, 0);

          // Set forceVersion if we have a chore with a version in the message body like Release-As: v1.2.3 (similar to how we do it for PR labels) - this allows us to support chore-only releases and manually forcing versions when needed
          const releaseAsMatch = /Release-As:\s*(\S+)/i.exec(commit.message || '');
          if (releaseAsMatch) {
            forceVersion = releaseAsMatch[1].trim();
          }

          continue;
        }
      }
    }

    // If we have a forceVersion from a chore commit, use that directly (after validating it's a valid semver)
    if (forceVersion) {
      const parsedNext = semver.parse(forceVersion)!;
      return new Version(parsedNext.major, parsedNext.minor, parsedNext.patch, parsedNext.prerelease as (string | number)[] | undefined, parsedNext.build as string[] | undefined, effectivePrefix || undefined);
    }

    // Validate current version (strip prefix if present)
    const cleanCurrent = currentVersion.startsWith(effectivePrefix) ? currentVersion.slice(effectivePrefix.length) : currentVersion;
    const parsedCurrent = semver.parse(cleanCurrent);
    if (!parsedCurrent)
      throw new Error(`Invalid semver version: ${currentVersion}`);

    if (priority === 0 && includeChores === true) {
      priority = 1; // If we have no conventional commits but we do have chores, we want to at least bump the patch version
    }

    // https://www.npmjs.com/package/semver
    // Map priority to bump level, default patch
    let bump: VersionBumpLevel = priority === 3 ? 'major' : priority === 2 ? 'minor' : priority === 1 ? 'patch' : 'prerelease';

    // If current is not prerelease and we want a prerelease, bump normally first and add prerelease
    let nextVersion = semver.inc(cleanCurrent, bump) as string;
    if (isPrerelease && bump !== "prerelease") {

      let nextPreVersion = ""
      // Are we already in a prerelease? If so we only want to bump the prerelease part
      if (parsedCurrent.prerelease.length > 0)
        nextVersion = semver.inc(cleanCurrent, "prerelease", undefined, effectiveIdentifier, effectiveIdentifierBase) as string;
      else {
        nextPreVersion = semver.inc(nextVersion, "prerelease", undefined, effectiveIdentifier, effectiveIdentifierBase) as string;
        // Set the next version to the non-prerelease part plus the new prerelease part
        nextVersion = semver.parse(nextVersion)!.major + '.' + semver.parse(nextVersion)!.minor + '.' + semver.parse(nextVersion)!.patch + '-' + semver.parse(nextPreVersion)!.prerelease.join('.');
      }

      // Remove the -prerelease.x part if effectiveIdentifierBase is set to undefined its not quite semver compliant but it allows for cleaner prerelease versions like 1.2.3-alpha instead of 1.2.3-alpha.0 or 1.2.3-alpha.x
      if (effectiveIdentifierBase === undefined) {
        nextVersion = nextVersion.replace(/-([^.]+)\.\d+$/, '-$1');
      }

    } else if (isPrerelease && bump === "prerelease") {
      // If we are currently in a prerelease we only have chores then do nothing
      nextVersion = cleanCurrent;
    }

    const parsedNext = semver.parse(nextVersion)!;
    return new Version(parsedNext.major, parsedNext.minor, parsedNext.patch, parsedNext.prerelease as (string | number)[] | undefined, parsedNext.build as string[] | undefined, effectivePrefix || undefined);
  }
}
