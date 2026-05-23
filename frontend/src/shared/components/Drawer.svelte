<script module lang="ts">
  import type { Snippet } from 'svelte';

  export type DrawerSide = 'left' | 'right';

  export interface DrawerProps {
    open?: boolean;
    side?: DrawerSide;
    title?: string;
    label?: string;
    closeLabel?: string;
    closeOnBackdrop?: boolean;
    closeOnEscape?: boolean;
    onClose?: () => void;
    children?: Snippet;
  }
</script>

<script lang="ts">
  let {
    open = $bindable(false),
    side = 'right',
    title,
    label = '侧边面板',
    closeLabel = '关闭侧边面板',
    closeOnBackdrop = true,
    closeOnEscape = true,
    onClose,
    children,
  }: DrawerProps = $props();

  const requestClose = () => {
    open = false;
    onClose?.();
  };

  const closeFromBackdrop = () => {
    if (closeOnBackdrop) {
      requestClose();
    }
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (open && closeOnEscape && event.key === 'Escape') {
      requestClose();
    }
  };
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div class={`oc-drawer oc-drawer--${side}`}>
    <button type="button" class="oc-drawer__backdrop" aria-label="关闭遮罩" onclick={closeFromBackdrop}></button>
    <div class="oc-drawer__panel" role="dialog" aria-modal="true" aria-label={label} tabindex="-1">
      <header class="oc-drawer__header">
        {#if title}
          <h2>{title}</h2>
        {/if}
        <button type="button" class="oc-drawer__close" aria-label={closeLabel} onclick={requestClose}>×</button>
      </header>
      <div class="oc-drawer__content">
        {@render children?.()}
      </div>
    </div>
  </div>
{/if}

<style>
  @import '../styles/tokens.css';

  .oc-drawer {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: grid;
  }

  .oc-drawer__backdrop {
    position: absolute;
    inset: 0;
    border: 0;
    background: rgba(15, 23, 42, 0.48);
    cursor: pointer;
  }

  .oc-drawer__backdrop:focus-visible,
  .oc-drawer__close:focus-visible {
    outline: 3px solid rgba(14, 165, 233, 0.45);
    outline-offset: 2px;
  }

  .oc-drawer__panel {
    position: relative;
    z-index: 1;
    width: min(420px, 92vw);
    height: 100%;
    background: var(--oc-color-surface, #ffffff);
    color: var(--oc-color-text, #1e293b);
    box-shadow: var(--oc-shadow-drawer, -24px 0 60px rgba(15, 23, 42, 0.22));
    overflow: auto;
  }

  .oc-drawer--left .oc-drawer__panel {
    justify-self: start;
    box-shadow: 24px 0 60px rgba(15, 23, 42, 0.22);
  }

  .oc-drawer--right .oc-drawer__panel {
    justify-self: end;
  }

  .oc-drawer__header {
    position: sticky;
    top: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 18px 20px;
    border-bottom: 1px solid var(--oc-color-border, #dbe3ef);
    background: color-mix(in srgb, var(--oc-color-surface, #ffffff) 92%, transparent);
    backdrop-filter: blur(12px);
  }

  .oc-drawer__header h2 {
    margin: 0;
    font-size: 1rem;
  }

  .oc-drawer__close {
    display: inline-grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border: 1px solid var(--oc-color-border, #dbe3ef);
    border-radius: 999px;
    background: var(--oc-color-surface-muted, #f8fafc);
    color: var(--oc-color-text, #1e293b);
    cursor: pointer;
    font-size: 1.25rem;
    line-height: 1;
  }

  .oc-drawer__close:hover {
    border-color: var(--oc-color-border-strong, #94a3b8);
  }

  .oc-drawer__content {
    padding: 20px;
  }
</style>
