<script module lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  export type CalloutTone = 'info' | 'success' | 'warning' | 'danger';

  export interface CalloutProps extends HTMLAttributes<HTMLElement> {
    tone?: CalloutTone;
    title?: string;
    compact?: boolean;
    children?: Snippet;
  }
</script>

<script lang="ts">
  const toneLabels: Record<CalloutTone, string> = {
    info: '提示',
    success: '完成',
    warning: '注意',
    danger: '错误',
  };

  let {
    tone = 'info',
    title,
    compact = false,
    children,
    class: className = '',
    ...rest
  }: CalloutProps = $props();
</script>

<section
  {...rest}
  class={`oc-callout oc-callout--${tone} ${compact ? 'oc-callout--compact' : ''} ${className}`.trim()}
  role={tone === 'danger' ? 'alert' : 'note'}
>
  <div class="oc-callout__mark" aria-hidden="true"></div>
  <div class="oc-callout__body">
    <p class="oc-callout__title">{title ?? toneLabels[tone]}</p>
    <div class="oc-callout__content">
      {@render children?.()}
    </div>
  </div>
</section>

<style>
  @import '../styles/tokens.css';

  .oc-callout {
    display: grid;
    grid-template-columns: 4px minmax(0, 1fr);
    gap: 14px;
    padding: 16px;
    border: 1px solid var(--oc-callout-border, var(--oc-color-border, #dbe3ef));
    border-radius: var(--oc-radius-lg, 16px);
    background: var(--oc-callout-bg, var(--oc-color-surface, #ffffff));
    color: var(--oc-color-text, #1e293b);
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
  }

  .oc-callout--compact {
    gap: 10px;
    padding: 12px;
    border-radius: var(--oc-radius-md, 10px);
  }

  .oc-callout__mark {
    border-radius: 999px;
    background: var(--oc-callout-accent, var(--oc-color-accent, #0ea5e9));
  }

  .oc-callout__body {
    min-width: 0;
  }

  .oc-callout__title {
    margin: 0 0 6px;
    color: var(--oc-callout-title, var(--oc-color-text, #1e293b));
    font-size: 0.875rem;
    font-weight: 800;
  }

  .oc-callout__content {
    color: var(--oc-color-text-muted, #64748b);
    font-size: 0.9375rem;
    line-height: 1.65;
  }

  .oc-callout__content :global(:first-child) {
    margin-top: 0;
  }

  .oc-callout__content :global(:last-child) {
    margin-bottom: 0;
  }

  .oc-callout--info {
    --oc-callout-bg: #f0f9ff;
    --oc-callout-border: rgba(14, 165, 233, 0.24);
    --oc-callout-accent: var(--oc-color-accent, #0ea5e9);
    --oc-callout-title: #075985;
  }

  .oc-callout--success {
    --oc-callout-bg: var(--oc-color-success-soft, #dcfce7);
    --oc-callout-border: rgba(22, 163, 74, 0.24);
    --oc-callout-accent: var(--oc-color-success, #16a34a);
    --oc-callout-title: #166534;
  }

  .oc-callout--warning {
    --oc-callout-bg: var(--oc-color-warning-soft, #fef3c7);
    --oc-callout-border: rgba(217, 119, 6, 0.28);
    --oc-callout-accent: var(--oc-color-warning, #d97706);
    --oc-callout-title: #92400e;
  }

  .oc-callout--danger {
    --oc-callout-bg: var(--oc-color-danger-soft, #fee2e2);
    --oc-callout-border: rgba(220, 38, 38, 0.24);
    --oc-callout-accent: var(--oc-color-danger, #dc2626);
    --oc-callout-title: #991b1b;
  }
</style>
