import type { StepFinishPart, ToolPart } from '../../shared/domain/types';

export type DemoBlock =
  | { kind: 'markdown'; content: string }
  | { kind: 'reasoning'; text: string }
  | { kind: 'tool'; part: ToolPart }
  | { kind: 'patch'; files: string[]; patch: string }
  | { kind: 'finish'; part: StepFinishPart };

export interface DemoTurn {
  id: string;
  title: string;
  actor: string;
  time: string;
  category: string;
  summary: string;
  blocks: DemoBlock[];
}

export interface NavSection {
  id: string;
  label: string;
  meta: string;
  tone: string;
}

export interface ShareMetaSummary {
  title: string;
  model: string;
  cost: string;
  tokens: string;
  duration: string;
  counts: Array<{ label: string; value: string }>;
  activity: string[];
  filesChanged: string[];
  toolCounts: Array<{ label: string; value: number }>;
  errorCounts: Array<{ label: string; value: number }>;
}

export const demoTurns: DemoTurn[] = [
  {
    id: 'turn-kickoff',
    title: 'Share explorer shell',
    actor: 'User → Assistant',
    time: '09:12',
    category: 'planning',
    summary: 'Establish the session question, constraints, and initial rendering plan.',
    blocks: [
      {
        kind: 'markdown',
        content:
          '### Goal\nBuild a readable share explorer that keeps the conversation first, while navigation and metadata stay close at hand.',
      },
      {
        kind: 'reasoning',
        text: 'Prefer a stable timeline with local anchors so future normalized data can replace this demo payload without reshaping the view.',
      },
    ],
  },
  {
    id: 'turn-renderers',
    title: 'Renderer pass',
    actor: 'Assistant tools',
    time: '09:18',
    category: 'codebase-read',
    summary: 'Exercise text, reasoning, tool, patch, and completion blocks inside the real layout.',
    blocks: [
      {
        kind: 'tool',
        part: {
          type: 'tool',
          tool: 'read',
          callID: 'demo-read-components',
          state: {
            status: 'completed',
            title: 'Inspect renderer component exports',
            input: { filePath: 'frontend/src/apps/share/components/index.ts' },
            output: 'MarkdownBlock, ReasoningPart, ToolCallCard, StepFinishBlock, DiffViewer, PatchPart, UnknownPart, RawJsonDrawer',
            time: { start: 120, end: 163 },
          },
        },
      },
      {
        kind: 'patch',
        files: ['frontend/src/apps/share/ShareApp.svelte'],
        patch: '@@ -1,3 +1,4 @@\n <main class="share-shell">\n-  <section>Placeholder</section>\n+  <section id="turn-kickoff">Timeline</section>\n+  <nav aria-label="分节导航">Anchors</nav>',
      },
    ],
  },
  {
    id: 'turn-verification',
    title: 'Verification runway',
    actor: 'Assistant',
    time: '09:27',
    category: 'verification',
    summary: 'Keep acceptance criteria visible: anchors line up and the sidebar remains summary-only.',
    blocks: [
      {
        kind: 'markdown',
        content:
          'Checklist preview:\n\n- Anchor rail targets every timeline turn.\n- Meta sidebar avoids raw JSON dumps.\n- `pnpm --dir frontend check && pnpm --dir frontend build` stays green.',
      },
      {
        kind: 'finish',
        part: {
          type: 'step-finish',
          reason: 'demo-ready',
          cost: 0.004218,
          tokens: { input: 8120, output: 2048, reasoning: 512, total: 10680 },
        },
      },
    ],
  },
];

export const demoMeta: ShareMetaSummary = {
  title: 'OpenCode session share · layout preview',
  model: 'gpt-5.5 / aio',
  cost: '$0.004218',
  tokens: '10,680',
  duration: '15m 42s',
  counts: [
    { label: 'Turns', value: '3' },
    { label: 'Messages', value: '7' },
    { label: 'Blocks', value: '7' },
    { label: 'Artifacts', value: '2' },
  ],
  activity: ['Plan captured', 'Renderers exercised', 'Verification queued'],
  filesChanged: ['frontend/src/apps/share/ShareApp.svelte', 'frontend/src/apps/share/layout.ts'],
  toolCounts: [
    { label: 'Read', value: 3 },
    { label: 'Change', value: 2 },
    { label: 'Verification', value: 2 },
  ],
  errorCounts: [
    { label: 'Runtime', value: 0 },
    { label: 'Renderer fallback', value: 0 },
  ],
};

export function sectionID(turnID: string): string {
  return `turn-${slugify(turnID)}`;
}

export function buildNavSections(turns: readonly DemoTurn[]): NavSection[] {
  return turns.map((turn, index) => ({
    id: sectionID(turn.id),
    label: `${index + 1}. ${turn.title}`,
    meta: turn.category,
    tone: turn.category,
  }));
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'section';
}
