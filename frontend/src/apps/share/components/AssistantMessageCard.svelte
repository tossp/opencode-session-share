<script module lang="ts">
  import type { ReaderNarrativeViewItem, ReaderRenderItem } from '../reader-view-model';

  export interface AssistantMessageCardProps {
    item: ReaderNarrativeViewItem;
  }
</script>

<script lang="ts">
  import { Badge, Icon } from '../../../shared/components';
  import PartRenderer from './PartRenderer.svelte';

  let { item }: AssistantMessageCardProps = $props();

  const messageID = $derived(item.message.id ?? item.id);
  const sourceCount = $derived(item.sourceIndexes.length);

  function renderItemKey(renderItem: ReaderRenderItem, index: number): string {
    const sourceKey = renderItem.sourceIndexes.map((source) => `${source.rawItemIndex}:${source.arrayOffset ?? 'root'}`).join('|');
    if (renderItem.type === 'single') return renderItem.part.id ?? `${renderItem.part.type}:${sourceKey}:${index}`;

    const partKey = renderItem.parts.map((part) => part.callID ?? part.id ?? part.type).join('|');
    return partKey || `tool-group:${sourceKey}:${index}`;
  }
</script>

<article class="assistant-message-card" aria-label="助手回复">
  <header class="assistant-message-card__header">
    <div class="assistant-message-card__identity">
      <span class="assistant-message-card__avatar"><Icon name="agent" size={16} /></span>
      <div>
        <p>助手</p>
        <h3>{item.text.trim() || '助手回复'}</h3>
      </div>
    </div>

    <div class="assistant-message-card__badges" aria-label="助手消息元信息">
      <Badge tone="success" size="sm">消息：{messageID}</Badge>
      <Badge tone="neutral" size="sm">片段：{item.renderItems.length}</Badge>
      {#if sourceCount > 0}
        <Badge tone="neutral" size="sm">来源：{sourceCount}</Badge>
      {/if}
    </div>
  </header>

  <div class="assistant-message-card__stack">
    {#each item.renderItems as renderItem, index (renderItemKey(renderItem, index))}
      <PartRenderer item={renderItem} patch={renderItem.type === 'single' ? renderItem.patch : undefined} />
    {:else}
      <p class="assistant-message-card__empty">暂无可渲染的助手内容。</p>
    {/each}
  </div>
</article>

<style>
  @import '../../../shared/styles/tokens.css';

  .assistant-message-card {
    display: grid;
    gap: 16px;
    padding: 18px;
    border: 1px solid rgba(20, 184, 166, 0.2);
    border-radius: var(--oc-radius-lg, 16px);
    background:
      radial-gradient(circle at 0 0, rgba(20, 184, 166, 0.12), transparent 34%),
      linear-gradient(135deg, rgba(240, 253, 250, 0.82), rgba(255, 255, 255, 0.98) 68%),
      var(--oc-color-surface, #fff);
    box-shadow: 0 12px 30px rgba(15, 118, 110, 0.08);
  }

  .assistant-message-card__header {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    justify-content: space-between;
  }

  .assistant-message-card__identity,
  .assistant-message-card__badges,
  .assistant-message-card__stack {
    display: flex;
    gap: 8px;
  }

  .assistant-message-card__identity {
    min-width: 0;
    align-items: flex-start;
  }

  .assistant-message-card__badges {
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .assistant-message-card__stack {
    display: grid;
    gap: 14px;
    min-width: 0;
  }

  .assistant-message-card__avatar {
    display: grid;
    width: 30px;
    height: 30px;
    flex: 0 0 auto;
    place-items: center;
    border-radius: 999px;
    background: #0f766e;
    color: #fff;
  }

  .assistant-message-card__identity p,
  .assistant-message-card__identity h3,
  .assistant-message-card__empty {
    margin: 0;
  }

  .assistant-message-card__identity p {
    color: #0f766e;
    font-size: 0.78rem;
    font-weight: 900;
    letter-spacing: 0.08em;
  }

  .assistant-message-card__identity h3 {
    display: -webkit-box;
    color: var(--oc-color-text, #1e293b);
    font-size: clamp(1rem, 1.8vw, 1.18rem);
    line-height: 1.35;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow-wrap: anywhere;
  }

  .assistant-message-card__empty {
    padding: 12px;
    border: 1px dashed var(--oc-color-border, #dbe3ef);
    border-radius: var(--oc-radius-md, 10px);
    color: var(--oc-color-text-muted, #64748b);
  }

  @media (max-width: 720px) {
    .assistant-message-card__header {
      flex-direction: column;
    }

    .assistant-message-card__badges {
      justify-content: flex-start;
    }
  }
</style>