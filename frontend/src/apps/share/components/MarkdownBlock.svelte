<script module lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';

  export interface MarkdownBlockProps extends HTMLAttributes<HTMLElement> {
    content: string;
  }
</script>

<script lang="ts">
  import { CodeBlock } from '../../../shared/components';
  import { renderMarkdown, splitMarkdownSegments } from './markdown';

  let { content, class: className = '', ...rest }: MarkdownBlockProps = $props();
  const segments = $derived(splitMarkdownSegments(renderMarkdown(content)));
</script>

<article {...rest} class={`share-markdown ${className}`.trim()}>
  {#each segments as segment}
    {#if segment.kind === 'code'}
      <div class="share-markdown__code" data-language={segment.block.language} data-highlighted={segment.block.highlightedHtml}>
        <CodeBlock code={segment.block.code} language={segment.block.language} />
      </div>
    {:else}
      <div class="share-markdown__body">{@html segment.html}</div>
    {/if}
  {/each}
</article>

<style>
  @import '../../../shared/styles/tokens.css';

  .share-markdown {
    display: grid;
    gap: 14px;
    color: var(--oc-color-text, #1e293b);
    line-height: 1.72;
  }

  .share-markdown__body :global(:first-child) {
    margin-top: 0;
  }

  .share-markdown__body :global(:last-child) {
    margin-bottom: 0;
  }

  .share-markdown__body :global(a) {
    color: var(--oc-color-accent, #0284c7);
    font-weight: 800;
  }

  .share-markdown__body :global(blockquote) {
    margin-inline: 0;
    padding: 10px 14px;
    border-left: 4px solid var(--oc-color-accent, #0284c7);
    border-radius: var(--oc-radius-sm, 6px);
    background: var(--oc-color-surface-muted, #f8fafc);
  }

  .share-markdown__body :global(code) {
    padding: 0.1rem 0.35rem;
    border-radius: var(--oc-radius-sm, 6px);
    background: #e2e8f0;
    font-family: var(--oc-font-mono, 'SFMono-Regular', Consolas, monospace);
    font-size: 0.9em;
  }

  .share-markdown__code {
    min-width: 0;
  }
</style>
