<script module lang="ts">
  import type { ReaderSideEvent } from '../../../shared/domain/opencode-reader-types';

  export interface SideEventViewProps {
    event: ReaderSideEvent;
  }
</script>

<script lang="ts">
  import { Badge, Collapse } from '../../../shared/components';
  import ProvenanceView from './ProvenanceView.svelte';
  import RawJsonDrawer from './RawJsonDrawer.svelte';

  let { event }: SideEventViewProps = $props();
  let rawOpen = $state(false);

  const eventTitle = $derived(`侧边事件 · ${event.kind}`);
  const preview = $derived(trimPreview(event.text));
  const messageID = $derived(event.messageID ?? event.message?.id);
  const partID = $derived(event.part?.id);
  const partType = $derived(event.part?.type);
  const partCount = $derived(event.parts?.length ?? 0);

  function trimPreview(value: string): string {
    const normalized = value.trim().replace(/\s+/g, ' ');
    if (normalized.length === 0) return '暂无文本预览。';
    return normalized.length > 180 ? `${normalized.slice(0, 180)}…` : normalized;
  }
</script>

<section class="side-event-view">
  <Collapse title={eventTitle} id={`side-event-${event.id}`}>
    <div class="side-event-view__body">
      <div class="side-event-view__summary">
        <Badge tone="warning" size="sm">事件类型：{event.kind}</Badge>
        {#if messageID !== undefined}
          <Badge tone="neutral" size="sm">消息 ID：{messageID}</Badge>
        {/if}
        {#if event.parentMessageID !== undefined}
          <Badge tone="neutral" size="sm">父消息 ID：{event.parentMessageID}</Badge>
        {/if}
        {#if partID !== undefined}
          <Badge tone="accent" size="sm">片段 ID：{partID}</Badge>
        {/if}
        {#if partType !== undefined}
          <Badge tone="accent" size="sm">片段类型：{partType}</Badge>
        {/if}
      </div>

      <div class="side-event-view__label">文本预览</div>
      <p class="side-event-view__preview">{preview}</p>

      {#if partCount > 0}
        <div class="side-event-view__meta">包含片段：{partCount}</div>
      {/if}

      <ProvenanceView sourceIndexes={event.sourceIndexes} title="侧边事件来源" compact />

      <button type="button" class="side-event-view__raw" onclick={() => (rawOpen = true)}>查看原始事件数据</button>
    </div>
  </Collapse>

  <RawJsonDrawer bind:open={rawOpen} title="侧边事件原始数据" value={event} />
</section>

<style>
  @import '../../../shared/styles/tokens.css';

  .side-event-view__body {
    display: grid;
    gap: 12px;
  }

  .side-event-view__summary {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }

  .side-event-view__preview {
    margin: 0;
    padding: 12px;
    border-left: 3px solid var(--oc-color-warning, #d97706);
    border-radius: var(--oc-radius-md, 10px);
    background: #fffbeb;
    color: var(--oc-color-text, #1e293b);
    font-size: 0.9rem;
  }

  .side-event-view__label {
    color: var(--oc-color-text, #1e293b);
    font-size: 0.78rem;
    font-weight: 900;
    letter-spacing: 0.04em;
  }

  .side-event-view__meta {
    color: var(--oc-color-text-muted, #64748b);
    font-size: 0.82rem;
    font-weight: 800;
  }

  .side-event-view__raw {
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

  .side-event-view__raw:hover {
    border-color: var(--oc-color-warning, #d97706);
    background: var(--oc-color-warning-soft, #fef3c7);
  }
</style>
