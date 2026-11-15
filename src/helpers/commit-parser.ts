import type { Commit } from '../types/provider.js';

const HEADER = /^(\w+)(?:\(([^)]+)\))?(!)?:[ \t]*(\S.*)$/;
const ENTRY_TYPES = new Set(['feat', 'fix', 'perf', 'refactor', 'docs', 'test', 'build', 'ci', 'style', 'chore', 'revert']);
const TRAILER = /^ {0,3}(BREAKING[ -]CHANGE|[A-Za-z][A-Za-z0-9-]*)(?::[ \t]*| #)(.*)$/;
const REFERENCE = /^(refs?|fixes?|closes?|resolves?)$/i;

export interface ParsedCommitEntry {
  title: string;
  message: string;
  type: string;
  scope?: string;
  subject: string;
  breaking: boolean;
  description: string;
  breakingNotes: string[];
  references: { action: string; id: string }[];
  releaseAs?: string;
}

function trimBlankLines(text: string): string {
  return text.replace(/^(?:[ \t]*\n)+|(?:\n[ \t]*)+$/g, '');
}

function fenceTracker(): (line: string) => boolean {
  let fence: string | undefined;
  return line => {
    if (fence) {
      const closing = /^ {0,3}(`+|~+)[ \t]*$/.exec(line);
      if (closing && closing[1][0] === fence[0] && closing[1].length >= fence.length) {
        fence = undefined;
      }
      return true;
    }
    const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (!opening || (opening[1][0] === '`' && opening[2].includes('`'))) return false;
    fence = opening[1];
    return true;
  };
}

function parseEntry(lines: string[]): ParsedCommitEntry {
  const title = lines[0];
  const header = HEADER.exec(title)!;
  const body: string[] = [];
  const notes: string[][] = [];
  const references: ParsedCommitEntry['references'] = [];
  let releaseAs: string | undefined;
  let inFooters = false;
  let note: string[] | undefined;
  const inFence = fenceTracker();

  for (const line of lines.slice(1)) {
    const fenced = inFence(line);
    const candidate = fenced ? null : TRAILER.exec(line);
    const trailer = candidate && (candidate[2].trim() || /^BREAKING[ -]CHANGE$/.test(candidate[1]))
      ? candidate
      : null;
    if (trailer) {
      inFooters = true;
      note = undefined;
      const [, token, value] = trailer;
      if (/^BREAKING[ -]CHANGE$/.test(token)) {
        note = [value];
        notes.push(note);
      } else if (REFERENCE.test(token)) {
        const id = /^#?(\S+)/.exec(value)?.[1];
        if (id) references.push({ action: token.toLowerCase(), id });
      } else if (token.toLowerCase() === 'release-as') {
        releaseAs = value.trim();
      }
    } else if (note) {
      note.push(line);
    } else if (!inFooters) {
      body.push(line);
    }
  }

  const breakingNotes = notes.map(lines => trimBlankLines(lines.join('\n'))).filter(Boolean);
  return {
    title,
    message: trimBlankLines(lines.join('\n')),
    type: header[1],
    scope: header[2],
    subject: header[4],
    breaking: !!header[3] || breakingNotes.length > 0,
    description: trimBlankLines(body.join('\n')),
    breakingNotes,
    references,
    releaseAs,
  };
}

/**
 * Split a conventional message into entries, preserving each entry's Markdown and trailers.
 * Only unindented standard conventional headers outside fences start additional entries.
 */
export function parseCommitMessage(message: string): ParsedCommitEntry[] {
  const lines = message.replace(/\r\n/g, '\n').split('\n');
  if (!HEADER.test(lines[0])) return [];

  const entries: ParsedCommitEntry[] = [];
  let current = [lines[0]];
  const inFence = fenceTracker();
  for (const line of lines.slice(1)) {
    const fenced = inFence(line);
    const header = fenced ? null : HEADER.exec(line);
    if (header && ENTRY_TYPES.has(header[1])) {
      entries.push(parseEntry(current));
      current = [line];
    } else {
      current.push(line);
    }
  }
  entries.push(parseEntry(current));
  return entries;
}

/** Read one already-expanded commit, also accepting body-only messages from API consumers. */
export function parseCommit(commit: Pick<Commit, 'title' | 'message'>): ParsedCommitEntry | undefined {
  const message = (commit.message || '').replace(/\r\n/g, '\n');
  const fullMessage = message.split('\n')[0] === commit.title
    ? message
    : `${commit.title}\n\n${message}`;
  return parseCommitMessage(fullMessage)[0];
}
