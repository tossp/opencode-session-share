export type DiffLineKind = 'meta' | 'hunk' | 'add' | 'remove' | 'context';

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
  oldLine?: number;
  newLine?: number;
}

export interface ParsedDiff {
  ok: boolean;
  lines: DiffLine[];
  additions: number;
  deletions: number;
}

const hunkPattern = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

export const parseUnifiedDiff = (patch: string): ParsedDiff => {
  if (!patch.trim()) {
    return { ok: false, lines: [], additions: 0, deletions: 0 };
  }

  const lines: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;
  let sawHunk = false;
  let additions = 0;
  let deletions = 0;

  for (const text of patch.split('\n')) {
    const hunk = hunkPattern.exec(text);
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      sawHunk = true;
      lines.push({ kind: 'hunk', text });
      continue;
    }

    if (!sawHunk || text.startsWith('diff ') || text.startsWith('index ') || text.startsWith('---') || text.startsWith('+++')) {
      lines.push({ kind: 'meta', text });
      continue;
    }

    if (text.startsWith('+')) {
      lines.push({ kind: 'add', text, newLine });
      additions += 1;
      newLine += 1;
      continue;
    }

    if (text.startsWith('-')) {
      lines.push({ kind: 'remove', text, oldLine });
      deletions += 1;
      oldLine += 1;
      continue;
    }

    lines.push({ kind: 'context', text, oldLine, newLine });
    oldLine += 1;
    newLine += 1;
  }

  return { ok: sawHunk, lines, additions, deletions };
};
