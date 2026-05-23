<script module lang="ts">
  import type { SVGAttributes } from 'svelte/elements';

  export type IconName =
    | 'agent'
    | 'check'
    | 'chevron'
    | 'code'
    | 'file'
    | 'git'
    | 'terminal'
    | 'thinking'
    | 'tool'
    | 'user'
    | 'warning';

  export interface IconProps extends SVGAttributes<SVGSVGElement> {
    name: IconName;
    size?: number;
  }
</script>

<script lang="ts">
  let { name, size = 16, class: className = '', ...rest }: IconProps = $props();
</script>

<svg
  {...rest}
  class={`oc-icon ${className}`.trim()}
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.8"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if name === 'agent'}
    <path d="M12 3v3" />
    <path d="M8 6h8a4 4 0 0 1 4 4v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-5a4 4 0 0 1 4-4Z" />
    <path d="M9 13h.01" />
    <path d="M15 13h.01" />
    <path d="M9 17h6" />
  {:else if name === 'check'}
    <path d="m5 13 4 4L19 7" />
  {:else if name === 'chevron'}
    <path d="m9 18 6-6-6-6" />
  {:else if name === 'code'}
    <path d="m9 18-6-6 6-6" />
    <path d="m15 6 6 6-6 6" />
  {:else if name === 'file'}
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
    <path d="M14 3v5h5" />
  {:else if name === 'git'}
    <path d="M6 3v12" />
    <path d="M18 9a3 3 0 1 0-6 0v6a3 3 0 1 1-3-3" />
    <path d="M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
  {:else if name === 'terminal'}
    <path d="m4 7 5 5-5 5" />
    <path d="M12 19h8" />
  {:else if name === 'thinking'}
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M8.5 14.5A6 6 0 1 1 15.5 14c-.9.6-1.5 1.5-1.5 2.5h-4c0-.8-.5-1.5-1.5-2Z" />
  {:else if name === 'tool'}
    <path d="M14.7 6.3a4 4 0 0 0-5 5L4 17l3 3 5.7-5.7a4 4 0 0 0 5-5l-2.5 2.5-3-3Z" />
  {:else if name === 'user'}
    <path d="M20 21a8 8 0 0 0-16 0" />
    <path d="M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />
  {:else if name === 'warning'}
    <path d="m12 3 10 18H2Z" />
    <path d="M12 9v5" />
    <path d="M12 17h.01" />
  {/if}
</svg>

<style>
  .oc-icon {
    display: inline-block;
    flex: 0 0 auto;
  }
</style>
