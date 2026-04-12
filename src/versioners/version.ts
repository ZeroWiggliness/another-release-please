/**
 * Version class to represent Semantic Versioning components
 */
export class Version {
  constructor(
    public major: number,
    public minor: number,
    public patch: number,
    public prerelease?: (string | number)[],
    public build?: string[],
    public prefix?: string
  ) { }

  toString(): string {
    const base = `${this.major}.${this.minor}.${this.patch}`;
    const pre = this.prerelease && this.prerelease.length > 0 ? `-${this.prerelease.join('.')}` : '';
    const build = this.build && this.build.length > 0 ? `+${this.build.join('.')}` : '';
    return `${this.prefix ?? ''}${base}${pre}${build}`;
  }
}
