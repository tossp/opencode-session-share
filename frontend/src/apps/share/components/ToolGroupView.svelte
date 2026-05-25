<script module lang="ts">
  import type { ToolPart, ToolCallPart } from '../../../shared/domain/types';

  export interface ToolGroupViewProps {
    parts: Array<ToolPart | ToolCallPart>;
  }
</script>

<script lang="ts">
  import ToolRunView from './ToolRunView.svelte';

  let { parts }: ToolGroupViewProps = $props();
</script>

<section class="tool-group">
  <div class="tool-group__header">工具调用（{parts.length}）</div>
  <div class="tool-group__items">
    {#each parts as part, index (part.callID ?? part.id ?? String(index))}
      <ToolRunView {part} />
    {/each}
  </div>
</section>

<style>
  .tool-group {
    display: grid;
    gap: 10px;
  }

  .tool-group__header {
    color: var(--oc-color-text-muted, #64748b);
    font-size: 0.82rem;
    font-weight: 800;
  }

  .tool-group__items {
    display: grid;
    gap: 10px;
  }
</style>
