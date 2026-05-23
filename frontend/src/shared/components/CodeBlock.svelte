<script module lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';

  export interface CodeBlockProps extends HTMLAttributes<HTMLElement> {
    code: string;
    language?: string;
    wrap?: boolean;
    maxHeight?: string;
    showCopy?: boolean;
    copyLabel?: string;
    copiedLabel?: string;
    unavailableLabel?: string;
  }
</script>

<script lang="ts">
  import { onDestroy } from 'svelte';

  type CopyState = 'idle' | 'copied' | 'unavailable';

  let {
    code,
    language = '',
    wrap = false,
    maxHeight = '420px',
    showCopy = true,
    copyLabel = '复制',
    copiedLabel = '已复制',
    unavailableLabel = '不可复制',
    class: className = '',
    ...rest
  }: CodeBlockProps = $props();

  let copyState = $state<CopyState>('idle');
  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  const languageLabel = () => language.trim() || '代码';
  const buttonLabel = () => {
    if (copyState === 'copied') {
      return copiedLabel;
    }
    if (copyState === 'unavailable') {
      return unavailableLabel;
    }
    return copyLabel;
  };

  const resetCopiedState = () => {
    if (copyTimer) {
      clearTimeout(copyTimer);
    }
    copyTimer = setTimeout(() => {
      copyState = 'idle';
    }, 1400);
  };

  const copyCode = async () => {
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;

    if (!clipboard?.writeText) {
      copyState = 'unavailable';
      resetCopiedState();
      return;
    }

    try {
      await clipboard.writeText(code);
      copyState = 'copied';
    } catch {
      copyState = 'unavailable';
    }

    resetCopiedState();
  };

  onDestroy(() => {
    if (copyTimer) {
      clearTimeout(copyTimer);
    }
  });
</script>

<figure {...rest} class={`oc-code-block ${wrap ? 'oc-code-block--wrap' : ''} ${className}`.trim()}>
  <figcaption class="oc-code-block__header">
    <span class="oc-code-block__language">{languageLabel()}</span>
    {#if showCopy}
      <button type="button" class="oc-code-block__copy" onclick={copyCode}>{buttonLabel()}</button>
    {/if}
  </figcaption>
  <pre class="oc-code-block__pre" style={`max-height: ${maxHeight};`}><code>{code}</code></pre>
</figure>

<style>
  @import '../styles/tokens.css';

  .oc-code-block {
    margin: 0;
    border: 1px solid var(--oc-color-border, #dbe3ef);
    border-radius: var(--oc-radius-lg, 16px);
    background: var(--oc-color-surface-strong, #0f172a);
    color: var(--oc-color-text-inverse, #e2e8f0);
    overflow: hidden;
  }

  .oc-code-block__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.22);
    background: rgba(15, 23, 42, 0.9);
  }

  .oc-code-block__language {
    min-width: 0;
    color: #bae6fd;
    font-family: var(--oc-font-mono, 'SFMono-Regular', Consolas, monospace);
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    overflow: hidden;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .oc-code-block__copy {
    flex: 0 0 auto;
    padding: 5px 9px;
    border: 1px solid rgba(186, 230, 253, 0.25);
    border-radius: var(--oc-radius-sm, 6px);
    background: rgba(14, 165, 233, 0.14);
    color: #e0f2fe;
    cursor: pointer;
    font: inherit;
    font-size: 0.75rem;
    font-weight: 800;
  }

  .oc-code-block__copy:hover {
    background: rgba(14, 165, 233, 0.24);
  }

  .oc-code-block__copy:focus-visible {
    outline: 3px solid rgba(14, 165, 233, 0.45);
    outline-offset: 2px;
  }

  .oc-code-block__pre {
    max-width: 100%;
    margin: 0;
    padding: 14px;
    overflow: auto;
    color: inherit;
    font-family: var(--oc-font-mono, 'SFMono-Regular', Consolas, monospace);
    font-size: 0.875rem;
    line-height: 1.65;
  }

  .oc-code-block__pre code {
    font: inherit;
  }

  .oc-code-block--wrap .oc-code-block__pre {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .oc-code-block:not(.oc-code-block--wrap) .oc-code-block__pre {
    white-space: pre;
  }
</style>
