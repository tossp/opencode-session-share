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
  import { Collapse, Icon } from '../../../shared/components';
  import DiffViewer from './DiffViewer.svelte';

  let { part, patch = '' }: PatchPartProps = $props();
  const fileList = $derived(part.files?.join(', ') || '补丁');
</script>

<section class="patch-part">
  <Collapse title={`代码变更 · ${fileList}`} open>
    <div class="patch-part__label"><Icon name="git" /> Patch</div>
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
