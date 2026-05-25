<script module lang="ts">
  import type { ReaderNarrativeViewItem } from '../reader-view-model';

  export interface UserMessageCardProps {
    item: ReaderNarrativeViewItem;
  }
</script>

<script lang="ts">
  import { Badge, Icon } from '../../../shared/components';
  import MarkdownBlock from './MarkdownBlock.svelte';

  let { item }: UserMessageCardProps = $props();

  const messageText = $derived(item.text.trim() || item.message.content?.trim() || '暂无用户输入内容。');
  const messageID = $derived(item.message.id ?? item.id);
  const sourceCount = $derived(item.sourceIndexes.length);
</script>

<article class="user-message-card" aria-label="用户消息">
  <header class="user-message-card__header">
    <div class="user-message-card__identity">
      <span class="user-message-card__avatar"><Icon name="user" size={16} /></span>
      <div>
        <p>用户</p>
        <h3>{messageText}</h3>
      </div>
    </div>

    <div class="user-message-card__badges" aria-label="用户消息元信息">
      <Badge tone="accent" size="sm">消息：{messageID}</Badge>
      {#if sourceCount > 0}
        <Badge tone="neutral" size="sm">来源：{sourceCount}</Badge>
      {/if}
    </div>
  </header>

  <div class="user-message-card__content">
    <MarkdownBlock content={messageText} />
  </div>
</article>

<style>
  @import '../../../shared/styles/tokens.css';

  .user-message-card {
    display: grid;
    gap: 14px;
    padding: 18px;
    border: 1px solid rgba(14, 165, 233, 0.22);
    border-radius: var(--oc-radius-lg, 16px);
    background:
      linear-gradient(135deg, rgba(224, 242, 254, 0.78), rgba(255, 255, 255, 0.96) 62%),
      var(--oc-color-surface, #fff);
    box-shadow: 0 12px 30px rgba(2, 132, 199, 0.08);
  }

  .user-message-card__header {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    justify-content: space-between;
  }

  .user-message-card__identity,
  .user-message-card__badges {
    display: flex;
    gap: 8px;
  }

  .user-message-card__identity {
    min-width: 0;
    align-items: flex-start;
  }

  .user-message-card__badges {
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .user-message-card__avatar {
    display: grid;
    width: 30px;
    height: 30px;
    flex: 0 0 auto;
    place-items: center;
    border-radius: 999px;
    background: var(--oc-color-accent, #0284c7);
    color: #fff;
  }

  .user-message-card__identity p,
  .user-message-card__identity h3 {
    margin: 0;
  }

  .user-message-card__identity p {
    color: #075985;
    font-size: 0.78rem;
    font-weight: 900;
    letter-spacing: 0.08em;
  }

  .user-message-card__identity h3 {
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

  .user-message-card__content {
    padding-left: 38px;
  }

  @media (max-width: 720px) {
    .user-message-card__header {
      flex-direction: column;
    }

    .user-message-card__badges {
      justify-content: flex-start;
    }

    .user-message-card__content {
      padding-left: 0;
    }
  }
</style>
