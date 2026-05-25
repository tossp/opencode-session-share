<script module lang="ts">
  import type { SourceIndex } from '../../../shared/domain/opencode-types';

  export interface ProvenanceViewProps {
    sourceIndexes: SourceIndex[];
    title?: string;
    compact?: boolean;
  }
</script>

<script lang="ts">
  import { Badge } from '../../../shared/components';

  let { sourceIndexes, title = '来源索引', compact = false }: ProvenanceViewProps = $props();
</script>

<section class:compact class="provenance-view" aria-label={title}>
  <div class="provenance-view__title">{title}</div>

  {#if sourceIndexes.length > 0}
    <ul class="provenance-view__list" aria-label="来源索引列表">
      {#each sourceIndexes as source, index (`${source.rawItemIndex}:${source.arrayOffset ?? 'root'}:${index}`)}
        <li class="provenance-view__item">
          <Badge tone="accent" size="sm">raw #{source.rawItemIndex}</Badge>
          {#if source.arrayOffset !== undefined}
            <Badge tone="neutral" size="sm">arrayOffset {source.arrayOffset}</Badge>
          {/if}
        </li>
      {/each}
    </ul>
  {:else}
    <p class="provenance-view__empty">暂无来源索引。</p>
  {/if}
</section>

<style>
  @import '../../../shared/styles/tokens.css';

  .provenance-view {
    display: grid;
    gap: 8px;
    padding: 10px 12px;
    border: 1px dashed var(--oc-color-border, #dbe3ef);
    border-radius: var(--oc-radius-md, 10px);
    background: linear-gradient(135deg, var(--oc-color-surface-muted, #f8fafc), #fff);
  }

  .provenance-view.compact {
    padding: 8px 10px;
    gap: 6px;
  }

  .provenance-view__title {
    color: var(--oc-color-text, #1e293b);
    font-size: 0.78rem;
    font-weight: 900;
    letter-spacing: 0.04em;
  }

  .provenance-view__list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .provenance-view__item {
    display: inline-flex;
    gap: 4px;
    align-items: center;
  }

  .provenance-view__empty {
    margin: 0;
    color: var(--oc-color-text-muted, #64748b);
    font-size: 0.84rem;
  }
</style>
