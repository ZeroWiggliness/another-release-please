/**
 * Versioner factory and exports
 */

import type { Versioner } from '../interfaces/versioner.interface.js';
import { SemverVersioner } from './semver-versioner.js';

export * from './semver-versioner.js';
export * from './version.js';

/**
 * Versioner type options
 */
export type VersionerType = 'default' | 'semver';

/**
 * Create a versioner instance based on type
 * @param type - Versioner type ('default' or 'semver')
 * @returns Versioner instance
 */
export function createVersioner(type: VersionerType = 'default'): Versioner {
  switch (type) {
    case 'default':
    case 'semver':
      return new SemverVersioner();
    default:
      throw new Error(`Unknown versioner type: ${type}`);
  }
}
