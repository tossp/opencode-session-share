<script module lang="ts">
  import type { PatchPart as PatchPartType } from '../../../shared/domain/types';

  export interface PatchPartProps {
    part: Pick<PatchPartType, 'files'>;
    patch?: string;
  }
</script>

<script lang="ts">
  import { Collapse, Icon, CodeBlock } from '../../../shared/components';
  import DiffViewer from './DiffViewer.svelte';

  let { part, patch = '' }: PatchPartProps = $props();
  const fileList = $derived(part.files?.join(', ') || '补丁');

  const isUnifiedDiff = $derived(() => {
    if (!patch.trim()) return false;
    const trimmed = patch.trim();
    return (
      trimmed.startsWith('diff --git') ||
      trimmed.startsWith('--- ') ||
      trimmed.startsWith('+++ ') ||
      trimmed.startsWith('@@')
    );
  });
</script>

<section class="patch-part">
  <Collapse title={`代码变更 · ${fileList}`} open>
    <div class="patch-part__label"><Icon name="git" /> Patch</div>
    {#if patch.trim()}
      {#if isUnifiedDiff()}
        <DiffViewer {patch} file={part.files?.[0]} />
      {:else}
        <p class="patch-part__non-unified">无法解析为统一 diff，显示原始内容：</p>
        <CodeBlock code={patch} language="text" wrap maxHeight="520px" />
      {/if}
    {:else}
      <p class="patch-part__empty">没有可展示的 patch 内容。</p>
    {/if}
  </Collapse>
</section>

<style>
  @import '../../../shared/styles/tokens.css';

  .patch-part__non-unified {
    margin: 8px 0 12px 0;
    color: var(--oc-color-text-muted, #64748b);
    font-size: 0.875rem;
  }

  .patch-part__empty {
    margin: 0;
    color: var(--oc-color-text-muted, #64748b);
  }

  .patch-part__label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 10px;
    color: var(--oc-color-text-muted, #64748b);
    font-size: 0.78rem;
    font-weight: 800;
  }
</style>
