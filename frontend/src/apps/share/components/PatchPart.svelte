<script module lang="ts">
  interface PatchPartData {
    files?: string[];
    hash?: string;
  }

  export interface PatchPartProps {
    part: PatchPartData;
    patch?: string;
  }
</script>

<script lang="ts">
  import { Collapse } from '../../../shared/components';
  import DiffViewer from './DiffViewer.svelte';

  let { part, patch = '' }: PatchPartProps = $props();
  const fileList = $derived(part.files?.join(', ') || '补丁');
</script>

<section class="patch-part">
  <Collapse title={`代码变更 · ${fileList}`} open>
    {#if patch.trim()}
      <DiffViewer {patch} file={part.files?.[0]} />
    {:else}
      <p class="patch-part__empty">没有可展示的 patch 内容。</p>
    {/if}
  </Collapse>
</section>

<style>
  @import '../../../shared/styles/tokens.css';

  .patch-part__empty {
    margin: 0;
    color: var(--oc-color-text-muted, #64748b);
  }
</style>
