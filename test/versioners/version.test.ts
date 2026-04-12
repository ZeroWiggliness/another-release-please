import { Version } from '../../src/versioners/version';

describe('Version', () => {
  test('toString with prerelease and build', () => {
    const v = new Version(1, 2, 3, ['alpha', 1], ['build', '1']);
    expect(v.major).toBe(1);
    expect(v.minor).toBe(2);
    expect(v.patch).toBe(3);
    expect(v.prerelease).toEqual(['alpha', 1]);
    expect(v.build).toEqual(['build', '1']);
    expect(v.toString()).toBe('1.2.3-alpha.1+build.1');
  });

  test('toString without prerelease/build', () => {
    const v = new Version(1, 2, 3);
    expect(v.toString()).toBe('1.2.3');
  });

  test('toString with prefix', () => {
    const v = new Version(1, 2, 3, undefined, undefined, 'v');
    expect(v.toString()).toBe('v1.2.3');
  });

  test('toString with custom prefix and prerelease', () => {
    const v = new Version(1, 2, 3, ['alpha', 1], undefined, 'release-');
    expect(v.toString()).toBe('release-1.2.3-alpha.1');
  });
});
