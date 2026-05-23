<script module lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  export interface CollapseProps extends HTMLAttributes<HTMLDivElement> {
    title: string;
    id?: string;
    open?: boolean;
    children?: Snippet;
  }
</script>

<script lang="ts">
  const generatedID = `oc-collapse-${Math.random().toString(36).slice(2)}`;

  let {
    title,
    id = generatedID,
    open = $bindable(false),
    children,
    class: className = '',
    ...rest
  }: CollapseProps = $props();

  const toggle = () => {
    open = !open;
  };
</script>

<div {...rest} class={`oc-collapse ${className}`.trim()}>
  <button type="button" class="oc-collapse__button" aria-expanded={open} aria-controls={id} onclick={toggle}>
    <span>{title}</span>
    <span class="oc-collapse__chevron" aria-hidden="true">⌄</span>
  </button>

  {#if open}
    <div id={id} class="oc-collapse__panel">
      {@render children?.()}
    </div>
  {/if}
</div>

<style>
  @import '../styles/tokens.css';

  .oc-collapse {
    border: 1px solid var(--oc-color-border, #dbe3ef);
    border-radius: var(--oc-radius-lg, 16px);
    background: var(--oc-color-surface, #ffffff);
    overflow: hidden;
  }

  .oc-collapse__button {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px;
    border: 0;
    background: transparent;
    color: var(--oc-color-text, #1e293b);
    cursor: pointer;
    font: inherit;
    font-weight: 800;
    text-align: left;
  }

  .oc-collapse__button:hover {
    background: var(--oc-color-surface-muted, #f8fafc);
  }

  .oc-collapse__button:focus-visible {
    outline: 3px solid rgba(14, 165, 233, 0.35);
    outline-offset: -3px;
  }

  .oc-collapse__chevron {
    flex: 0 0 auto;
    transition: transform var(--oc-transition-fast, 150ms ease);
  }

  .oc-collapse__button[aria-expanded='true'] .oc-collapse__chevron {
    transform: rotate(180deg);
  }

  .oc-collapse__panel {
    padding: 0 16px 16px;
    color: var(--oc-color-text-muted, #64748b);
    line-height: 1.65;
  }

  .oc-collapse__panel :global(:first-child) {
    margin-top: 0;
  }

  .oc-collapse__panel :global(:last-child) {
    margin-bottom: 0;
  }
</style>
