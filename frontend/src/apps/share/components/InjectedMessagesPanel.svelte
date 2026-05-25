<script module lang="ts">
  import type { ReaderInjectedMessage } from '../../../shared/domain/opencode-reader-types';

  export interface InjectedMessagesPanelProps {
    messages: ReaderInjectedMessage[];
  }
</script>

<script lang="ts">
  import { Badge, Collapse } from '../../../shared/components';
  import ProvenanceView from './ProvenanceView.svelte';
  import RawJsonDrawer from './RawJsonDrawer.svelte';

  let { messages }: InjectedMessagesPanelProps = $props();
  let rawOpen = $state(false);
  let rawMessage = $state<ReaderInjectedMessage | undefined>();

  const panelTitle = $derived(`注入消息 · ${messages.length}`);

  function previewText(value: string): string {
    const normalized = value.trim().replace(/\s+/g, ' ');
    if (normalized.length === 0) return '暂无文本预览。';
    return normalized.length > 180 ? `${normalized.slice(0, 180)}…` : normalized;
  }

  function openRawMessage(message: ReaderInjectedMessage): void {
    rawMessage = message;
    rawOpen = true;
  }

  function closeRawMessage(): void {
    rawOpen = false;
    rawMessage = undefined;
  }
</script>

<section class="injected-messages-panel">
  <Collapse title={panelTitle} id="injected-messages-panel">
    <div class="injected-messages-panel__body">
      <div class="injected-messages-panel__count">共 {messages.length} 条注入消息，已从主叙事中隔离。</div>

      {#if messages.length > 0}
        <ul class="injected-messages-panel__list" aria-label="注入消息列表">
          {#each messages as message, index (message.id || `injected-${index}`)}
            <li class="injected-messages-panel__item">
              <div class="injected-messages-panel__header">
                <strong>消息 ID：{message.id}</strong>
                <Badge tone="warning" size="sm">检测类型：{message.detection.kinds.join(' / ') || 'unknown_injection'}</Badge>
              </div>

              {#if message.detection.markers.length > 0}
                <div class="injected-messages-panel__markers" aria-label="检测标记">
                  {#each message.detection.markers as marker, markerIndex (`${message.id}:marker:${marker}:${markerIndex}`)}
                    <Badge tone="neutral" size="sm">检测标记：{marker}</Badge>
                  {/each}
                </div>
              {/if}

              <div class="injected-messages-panel__label">文本预览</div>
              <p class="injected-messages-panel__preview">{previewText(message.text)}</p>

              <ProvenanceView sourceIndexes={message.sourceIndexes} title="注入消息来源" compact />

              <button type="button" class="injected-messages-panel__raw" onclick={() => openRawMessage(message)}>查看原始注入数据</button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="injected-messages-panel__empty">暂无注入消息。</p>
      {/if}
    </div>
  </Collapse>

  {#if rawMessage !== undefined}
    <RawJsonDrawer bind:open={rawOpen} title="注入消息原始数据" value={rawMessage} onClose={closeRawMessage} />
  {/if}
</section>

<style>
  @import '../../../shared/styles/tokens.css';

  .injected-messages-panel__body {
    display: grid;
    gap: 12px;
  }

  .injected-messages-panel__count {
    color: var(--oc-color-text-muted, #64748b);
    font-size: 0.85rem;
    font-weight: 800;
  }

  .injected-messages-panel__list {
    display: grid;
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .injected-messages-panel__item {
    display: grid;
    gap: 10px;
    padding: 12px;
    border: 1px solid var(--oc-color-border, #dbe3ef);
    border-radius: var(--oc-radius-lg, 16px);
    background: linear-gradient(135deg, #fff7ed 0%, #ffffff 58%);
  }

  .injected-messages-panel__header,
  .injected-messages-panel__markers {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }

  .injected-messages-panel__header strong {
    color: var(--oc-color-text, #1e293b);
    font-size: 0.92rem;
  }

  .injected-messages-panel__preview {
    margin: 0;
    padding: 10px 12px;
    border-left: 3px solid var(--oc-color-warning, #d97706);
    border-radius: var(--oc-radius-md, 10px);
    background: #fffbeb;
    color: var(--oc-color-text, #1e293b);
    font-size: 0.9rem;
  }

  .injected-messages-panel__label {
    color: var(--oc-color-text, #1e293b);
    font-size: 0.78rem;
    font-weight: 900;
    letter-spacing: 0.04em;
  }

  .injected-messages-panel__empty {
    margin: 0;
    color: var(--oc-color-text-muted, #64748b);
  }

  .injected-messages-panel__raw {
    width: fit-content;
    padding: 7px 10px;
    border: 1px solid var(--oc-color-border, #dbe3ef);
    border-radius: var(--oc-radius-sm, 6px);
    background: var(--oc-color-surface, #fff);
    color: var(--oc-color-text, #1e293b);
    cursor: pointer;
    font: inherit;
    font-size: 0.82rem;
    font-weight: 800;
  }

  .injected-messages-panel__raw:hover {
    border-color: var(--oc-color-warning, #d97706);
    background: var(--oc-color-warning-soft, #fef3c7);
  }
</style>
