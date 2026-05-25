<script module lang="ts">
  import type { CompactionPart } from '../../../shared/domain/types';

  export interface CompactionPartViewProps {
    part: CompactionPart;
  }
</script>

<script lang="ts">
  import { Badge, Icon } from '../../../shared/components';

  let { part }: CompactionPartViewProps = $props();
</script>

<section class="compaction-part">
  <div class="compaction-part__marker"><Icon name="code" /></div>
  <div class="compaction-part__content">
    <strong>上下文压缩</strong>
    <Badge tone="warning" size="sm">{part.auto ? '自动' : '手动'}</Badge>
    {#if part.tail_start_id}
      <Badge tone="neutral" size="sm">tail: {part.tail_start_id}</Badge>
    {/if}
  </div>
</section>

<style>
  @import '../../../shared/styles/tokens.css';

  .compaction-part {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 12px;
    align-items: center;
    padding: 10px 16px;
    border: 1px solid #fed7aa;
    border-radius: var(--oc-radius-lg, 16px);
    background: linear-gradient(135deg, #fffbeb 0%, #ffffff 100%);
    color: var(--oc-color-text, #1e293b);
  }

  .compaction-part__marker {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    background: #f59e0b;
    color: #fff;
    font-weight: 900;
  }

  .compaction-part__content {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .compaction-part__content strong {
    font-size: 0.92rem;
  }
</style>
