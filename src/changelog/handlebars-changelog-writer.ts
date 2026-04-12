import Handlebars from 'handlebars';
import type { Commit } from '../types/provider.js';
import { ChangelogWriter, type ChangelogRepoContext } from './changelog-writer.js';

/**
 * Conventional commit types mapped to human-readable section titles,
 * in order of importance (most significant first).
 */
const COMMIT_TYPE_MAP: Record<string, string> = {
  feat: 'Features',
  fix: 'Bug Fixes',
  perf: 'Performance Improvements',
  refactor: 'Refactors',
  docs: 'Documentation',
  test: 'Tests',
  build: 'Build',
  ci: 'CI',
  style: 'Style',
  chore: 'Chores',
};

/** Section order by importance — controls the order sections appear in the changelog. */
const SECTION_ORDER = [
  'Features',
  'Bug Fixes',
  'Performance Improvements',
  'Refactors',
  'Documentation',
  'Tests',
  'Build',
  'CI',
  'Style',
  'Chores',
];

/** Regex to extract issue/ticket references from git trailer-style commit footer lines. */
// (Used locally inside buildViewModel per-commit; declared here for documentation purposes.)

/**
 * Handlebars partial template for rendering a single commit line.
 * - When showScopeHeading is true, a #### heading is emitted before the bullet.
 * - refs renders as "action [displayId](url)" pairs.
 * - commitUrl renders as a short hash link.
 * Subjects are processed through the `linkIssues` helper for inline issue linking.
 */
const COMMIT_PARTIAL =
  `* {{#if scope}}*({{scope}})* {{/if}}{{linkIssues subject}}` +
  `{{#if refs}} — {{#each refs}}{{action}} [{{displayId}}]({{url}}){{#unless @last}}, {{/unless}}{{/each}}{{/if}}` +
  `{{#if commitUrl}} ([{{shortHash}}]({{commitUrl}})){{/if}}\n`;

/**
 * Main Handlebars template for the full changelog section.
 * Structure:
 *   ## version
 *   [### ⚠ BREAKING CHANGES (if any)]
 *   [### Section Title  (repeated per type)]
 *   ---
 *   _Generated on YYYY-MM-DD_
 */
const MAIN_TEMPLATE =
  `## {{{version}}}\n` +
  `{{#if hasBreaking}}` +
  `\n### ⚠ BREAKING CHANGES\n\n` +
  `{{#each breakingChanges}}* {{{text}}}{{#if commitUrl}} ([{{shortHash}}]({{commitUrl}})){{/if}}\n{{/each}}` +
  `{{/if}}` +
  `{{#each sections}}` +
  `\n### {{{title}}}\n` +
  `{{#each commits}}{{> commit}}{{/each}}` +
  `{{/each}}` +
  `\n---\n_Generated on {{date}}_`;

// --------------- View model types ---------------

interface RefView {
  action: string;
  displayId: string;
  url: string;
}

interface CommitView {
  subject: string;
  scope?: string;
  refs?: RefView[];
  shortHash?: string;
  commitUrl?: string;
}

interface SectionView {
  title: string;
  commits: CommitView[];
}

interface ChangelogViewModel {
  version: string;
  date: string;
  hasBreaking: boolean;
  breakingChanges: { text: string; shortHash?: string; commitUrl?: string }[];
  sections: SectionView[];
}

// ------------------------------------------------

/**
 * Handlebars-based implementation of ChangelogWriter.
 *
 * Produces markdown output that follows the Conventional Commits specification:
 * - Breaking changes appear first in a dedicated section.
 * - Sections are ordered by importance (feat > fix > perf > refactor > ...).
 * - Within each section, scoped commits are grouped alphabetically by scope (and sorted
 *   by subject within each scope), followed by unscoped commits sorted by subject.
 * - Inline `#123` / `#PROJ-123` references in commit subjects are hyperlinked using
 *   the issueUrlTemplate from the context (via the `linkIssues` Handlebars helper).
 * - Footer-style refs (e.g. `Refs: #42`, `Fixes: PROJ-123`) are rendered as explicit links.
 * - A date footer is appended at the bottom of each section.
 */
export class HandlebarsChangelogWriter extends ChangelogWriter {
  async generate(
    commits: Commit[],
    version: string,
    date: Date,
    context: ChangelogRepoContext,
  ): Promise<string> {
    const hbs = Handlebars.create();

    // Register the linkIssues helper; the issueUrlTemplate is captured via closure.
    hbs.registerHelper('linkIssues', (text: string): Handlebars.SafeString => {
      if (!context.issueUrlTemplate || typeof text !== 'string') {
        return new Handlebars.SafeString(text ?? '');
      }
      const linked = text.replace(/#(\d+|[A-Z][A-Z0-9]*-\d+)/g, (match, id) => {
        const url = context.issueUrlTemplate!.replace('{id}', id);
        return `[${match}](${url})`;
      });
      return new Handlebars.SafeString(linked);
    });

    hbs.registerPartial('commit', COMMIT_PARTIAL);

    const viewModel = this.buildViewModel(commits, version, date, context);
    const compiledTemplate = hbs.compile(MAIN_TEMPLATE);
    return compiledTemplate(viewModel);
  }

  private buildViewModel(
    commits: Commit[],
    version: string,
    date: Date,
    context: ChangelogRepoContext,
  ): ChangelogViewModel {
    const dateStr = date.toISOString().slice(0, 10);
    const breakingChanges: { text: string; shortHash?: string; commitUrl?: string }[] = [];

    // Bucket by section title → scope (null = unscoped) → CommitView[]
    const typeBuckets = new Map<string, Map<string | null, CommitView[]>>();

    for (const commit of commits) {
      const match = commit.title.match(/^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/);
      if (!match) continue;

      const type = match[1];
      const scope = match[2] ?? null;
      const breaking = !!match[3];
      const subject = match[4];
      const bcFooterMatch = /^BREAKING CHANGE:\s*(.+)$/m.exec(commit.message || '');

      if (breaking || bcFooterMatch) {
        const bcText = bcFooterMatch ? bcFooterMatch[1] : subject;
        const bcEntry: { text: string; shortHash?: string; commitUrl?: string } = { text: bcText };
        if (context.repoUrl && context.commitPath && commit.sha) {
          bcEntry.commitUrl = `${context.repoUrl}${context.commitPath}/${commit.sha}`;
          bcEntry.shortHash = commit.sha.substring(0, 7);
        }
        breakingChanges.push(bcEntry);
      }

      const sectionTitle = COMMIT_TYPE_MAP[type];
      if (!sectionTitle) continue;

      // Extract git-trailer style refs from the commit body
      const rawRefs: { action: string; id: string }[] = [];
      const fullMessage = commit.message || commit.title;
      const refRe = /^(refs?|fixes?|closes?|resolves?):\s*#?(\S+)/gim;
      let refMatch: RegExpExecArray | null;
      while ((refMatch = refRe.exec(fullMessage)) !== null) {
        rawRefs.push({ action: refMatch[1].toLowerCase(), id: refMatch[2] });
      }

      // Render footer refs as hyperlinks
      let refs: RefView[] | undefined;
      if (rawRefs.length > 0 && context.issueUrlTemplate) {
        refs = rawRefs.map(ref => ({
          action: ref.action,
          displayId: context.issueUrlIsCustom ? ref.id : `#${ref.id}`,
          url: context.issueUrlTemplate!.replace('{id}', ref.id),
        }));
      }

      // Build commit hash hyperlink
      let commitUrl: string | undefined;
      let shortHash: string | undefined;
      if (context.repoUrl && context.commitPath && commit.sha) {
        commitUrl = `${context.repoUrl}${context.commitPath}/${commit.sha}`;
        shortHash = commit.sha.substring(0, 7);
      }

      const commitView: CommitView = {
        subject,
        scope: scope ?? undefined,
        refs,
        shortHash,
        commitUrl,
      };

      if (!typeBuckets.has(sectionTitle)) {
        typeBuckets.set(sectionTitle, new Map());
      }
      const scopeBucket = typeBuckets.get(sectionTitle)!;
      if (!scopeBucket.has(scope)) scopeBucket.set(scope, []);
      scopeBucket.get(scope)!.push(commitView);
    }

    // Build sections in SECTION_ORDER
    const sections: SectionView[] = [];

    for (const title of SECTION_ORDER) {
      const scopeBucket = typeBuckets.get(title);
      if (!scopeBucket) continue;

      const scopedKeys = [...scopeBucket.keys()]
        .filter((k): k is string => k !== null)
        .sort();
      const hasUnscoped = scopeBucket.has(null);

      const commits: CommitView[] = [];

      // Scoped commits first: sorted alphabetically by scope, then by subject within scope
      for (const scope of scopedKeys) {
        const group = scopeBucket.get(scope)!;
        group.sort((a, b) => (a.subject ?? '').localeCompare(b.subject ?? ''));
        commits.push(...group);
      }

      // Unscoped commits after: sorted by subject
      if (hasUnscoped) {
        const unscopedGroup = scopeBucket.get(null)!;
        unscopedGroup.sort((a, b) => (a.subject ?? '').localeCompare(b.subject ?? ''));
        commits.push(...unscopedGroup);
      }

      if (commits.length > 0) {
        sections.push({ title, commits });
      }
    }

    return {
      version,
      date: dateStr,
      hasBreaking: breakingChanges.length > 0,
      breakingChanges,
      sections,
    };
  }
}
