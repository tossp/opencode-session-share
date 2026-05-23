<script module lang="ts">
  export interface DiffViewerProps {
    patch: string;
    file?: string;
  }
</script>

<script lang="ts">
  import { Badge, CodeBlock } from '../../../shared/components';
  import { parseUnifiedDiff } from './diff';

  let { patch, file = '变更内容' }: DiffViewerProps = $props();

  const parsed = $derived(parseUnifiedDiff(patch));
</script>

{#if parsed.ok}
  <article class="diff-viewer">
    <header class="diff-viewer__header">
      <strong>{file}</strong>
      <span class="diff-viewer__stats">
        <Badge tone="success" size="sm">+{parsed.additions}</Badge>
        <Badge tone="danger" size="sm">-{parsed.deletions}</Badge>
      </span>
    </header>

    <div class="diff-viewer__table" role="table" aria-label="统一 diff">
      {#each parsed.lines as line}
        <div class={`diff-viewer__row diff-viewer__row--${line.kind}`} role="row">
          <span class="diff-viewer__num" role="cell">{line.oldLine ?? ''}</span>
          <span class="diff-viewer__num" role="cell">{line.newLine ?? ''}</span>
          <span class="diff-viewer__code" role="cell">{line.text}</span>
        </div>
      {/each}
    </div>
  </article>
{:else}
  <CodeBlock code={patch} language="diff" wrap maxHeight="520px" />
{/if}

<style>
  @import '../../../shared/styles/tokens.css';

  .diff-viewer {
    border: 1px solid var(--oc-color-border, #dbe3ef);
    border-radius: var(--oc-radius-lg, 16px);
    background: var(--oc-color-surface, #ffffff);
    overflow: hidden;
  }

  .diff-viewer__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--oc-color-border, #dbe3ef);
    background: #f8fafc;
  }

  .diff-viewer__stats {
    display: inline-flex;
    gap: 6px;
  }

  .diff-viewer__table {
    max-height: 560px;
    overflow: auto;
    font-family: var(--oc-font-mono, 'SFMono-Regular', Consolas, monospace);
    font-size: 0.82rem;
  }

  .diff-viewer__row {
    display: grid;
    grid-template-columns: 54px 54px minmax(0, 1fr);
    min-width: 620px;
  }

  .diff-viewer__code,
  .diff-viewer__num {
    padding: 4px 8px;
    white-space: pre;
  }

  .diff-viewer__num {
    border-right: 1px solid rgba(148, 163, 184, 0.22);
    color: #94a3b8;
    text-align: right;
    user-select: none;
  }

  .diff-viewer__row--add {
    background: #ecfdf5;
  }

  .diff-viewer__row--remove {
    background: #fef2f2;
  }

  .diff-viewer__row--hunk {
    background: #eff6ff;
    color: #1d4ed8;
    font-weight: 800;
  }

  .diff-viewer__row--meta {
    background: #f8fafc;
    color: #64748b;
  }
</style>
