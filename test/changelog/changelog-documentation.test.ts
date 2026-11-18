import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ArpConfigFile } from '../../src/config/config-types';
import type { Commit } from '../../src/types/provider';
import { expandCommits } from '../../src/helpers/commit-context';
import { HandlebarsChangelogWriter } from '../../src/changelog/handlebars-changelog-writer';
import { SemverVersioner } from '../../src/versioners/semver-versioner';

const guide = readFileSync(join(__dirname, '..', '..', 'docs', 'advanced', 'changelog.md'), 'utf8').replace(/\r\n/g, '\n');
const sections = guide.split(/^### Example /m).slice(1);
const examples = sections.flatMap(section => {
  const title = section.split('\n')[0];
  const blocks = [...section.matchAll(/^(`{3,})(json|text|markdown)\n([\s\S]*?)^\1[ \t]*$/gm)];
  if (!blocks.length || blocks.length % 3 !== 0) {
    throw new Error(`Missing config/message/output in changelog example ${title}`);
  }
  const scenarios: { name: string; config: ArpConfigFile; message: string; expected: string }[] = [];
  for (let i = 0; i < blocks.length; i += 3) {
    if (blocks[i][2] !== 'json' || blocks[i + 1][2] !== 'text' || blocks[i + 2][2] !== 'markdown') {
      throw new Error(`Unexpected code block order in changelog example ${title}`);
    }
    scenarios.push({
      name: `${title} (variant ${i / 3 + 1})`,
      config: JSON.parse(blocks[i][3]),
      message: blocks[i + 1][3].replace(/\n$/, ''),
      expected: blocks[i + 2][3].replace(/\n$/, ''),
    });
  }
  return scenarios;
});

describe('documented changelog examples', () => {
  it('covers at least twelve worked example categories', () => {
    expect(sections.length).toBeGreaterThanOrEqual(12);
  });

  it.each(examples)('$name', async ({ config, message, expected }) => {
    const commit: Commit = {
      title: message.split('\n')[0], message, sha: 'abc1234567890', tags: [],
      date: new Date('2026-04-02T00:00:00Z'),
      author: { name: 'Test', email: 'test@example.com' }, files: [],
    };
    const commits = await expandCommits([commit]);
    const version = new SemverVersioner().calculateNextVersion(commits, '1.0.0', false).toString();
    const provider = config.provider ?? 'github';
    const repoUrl = `https://${provider}.com/owner/repo`;
    const issuePath = provider === 'gitlab' ? '/-/issues/{id}' : '/issues/{id}';
    const actual = await new HandlebarsChangelogWriter().generate(commits, version, commit.date, {
      includeDescription: config.includeDescription,
      repoUrl,
      commitPath: provider === 'gitlab' ? '/-/commit' : '/commit',
      issueUrlTemplate: config.issueUrlTemplate ?? `${repoUrl}${issuePath}`,
      issueUrlIsCustom: !!config.issueUrlTemplate,
    });
    expect(actual).toBe(expected);
  });
});
