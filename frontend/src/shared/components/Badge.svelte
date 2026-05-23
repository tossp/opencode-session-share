<script module lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
  export type BadgeSize = 'sm' | 'md';

  export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    tone?: BadgeTone;
    size?: BadgeSize;
    children?: Snippet;
  }
</script>

<script lang="ts">
  let {
    tone = 'neutral',
    size = 'md',
    children,
    class: className = '',
    ...rest
  }: BadgeProps = $props();
</script>

<span {...rest} class={`oc-badge oc-badge--${tone} oc-badge--${size} ${className}`.trim()}>
  {@render children?.()}
</span>

<style>
  @import '../styles/tokens.css';

  .oc-badge {
    display: inline-flex;
    align-items: center;
    width: fit-content;
    border: 1px solid var(--oc-badge-border, var(--oc-color-border, #dbe3ef));
    border-radius: 999px;
    background: var(--oc-badge-bg, var(--oc-color-surface-muted, #f8fafc));
    color: var(--oc-badge-color, var(--oc-color-text, #1e293b));
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
  }

  .oc-badge--sm {
    min-height: 22px;
    padding: 3px 8px;
    font-size: 0.75rem;
  }

  .oc-badge--md {
    min-height: 28px;
    padding: 5px 10px;
    font-size: 0.8125rem;
  }

  .oc-badge--accent {
    --oc-badge-bg: var(--oc-color-accent-soft, #e0f2fe);
    --oc-badge-border: rgba(14, 165, 233, 0.28);
    --oc-badge-color: #075985;
  }

  .oc-badge--success {
    --oc-badge-bg: var(--oc-color-success-soft, #dcfce7);
    --oc-badge-border: rgba(22, 163, 74, 0.28);
    --oc-badge-color: #166534;
  }

  .oc-badge--warning {
    --oc-badge-bg: var(--oc-color-warning-soft, #fef3c7);
    --oc-badge-border: rgba(217, 119, 6, 0.3);
    --oc-badge-color: #92400e;
  }

  .oc-badge--danger {
    --oc-badge-bg: var(--oc-color-danger-soft, #fee2e2);
    --oc-badge-border: rgba(220, 38, 38, 0.28);
    --oc-badge-color: #991b1b;
  }
</style>
