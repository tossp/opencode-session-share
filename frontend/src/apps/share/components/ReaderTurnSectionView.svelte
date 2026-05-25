<script module lang="ts">
  import type { ReaderTurnSection } from '../reader-view-model';

  export interface ReaderTurnSectionViewProps {
    section: ReaderTurnSection;
    index?: number;
  }
</script>

<script lang="ts">
  import { Badge } from '../../../shared/components';
  import AssistantMessageCard from './AssistantMessageCard.svelte';
  import UserMessageCard from './UserMessageCard.svelte';

  let { section, index = 0 }: ReaderTurnSectionViewProps = $props();

  const marker = $derived(String(index + 1).padStart(2, '0'));
  const sectionSummary = $derived(section.user === undefined ? `助手独立片段 · ${section.assistants.length} 条回复` : `用户提问后跟随 ${section.assistants.length} 条助手回复`);
</script>

<article class="reader-turn-section" id={section.id} aria-labelledby={`${section.id}-title`}>
  <div class="reader-turn-section__marker" aria-hidden="true">{marker}</div>

  <div class="reader-turn-section__body">
    <header class="reader-turn-section__header">
      <div>
        <p>{section.user === undefined ? '助手起始段落' : '对话段落'}</p>
        <h2 id={`${section.id}-title`}>{section.title}</h2>
        <span>{sectionSummary}</span>
      </div>
      <Badge tone={section.user === undefined ? 'success' : 'accent'} size="sm">来源：{section.sourceIndexes.length}</Badge>
    </header>

    <div class="reader-turn-section__messages">
      {#if section.user !== undefined}
        <UserMessageCard item={section.user} />
      {/if}

      {#each section.assistants as assistant, assistantIndex (assistant.id || `assistant-${assistantIndex}`)}
        <AssistantMessageCard item={assistant} />
      {/each}
    </div>
  </div>
</article>

<style>
  @import '../../../shared/styles/tokens.css';

  .reader-turn-section {
    position: relative;
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr);
    gap: 16px;
    scroll-margin-top: 24px;
  }

  .reader-turn-section__marker {
    z-index: 1;
    display: grid;
    width: 38px;
    height: 38px;
    place-items: center;
    border: 3px solid #ecfeff;
    border-radius: 999px;
    background: #0f172a;
    color: #e0f2fe;
    font-size: 0.78rem;
    font-weight: 900;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.18);
  }

  .reader-turn-section__body {
    display: grid;
    gap: 14px;
    min-width: 0;
    padding: 18px;
    border: 1px solid rgba(100, 116, 139, 0.18);
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.82);
    box-shadow: 0 16px 42px rgba(15, 23, 42, 0.08);
    backdrop-filter: blur(16px);
  }

  .reader-turn-section__header {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    justify-content: space-between;
  }

  .reader-turn-section__header p,
  .reader-turn-section__header h2 {
    margin: 0;
  }

  .reader-turn-section__header p {
    color: #0f766e;
    font-size: 0.76rem;
    font-weight: 900;
    letter-spacing: 0.1em;
  }

  .reader-turn-section__header h2 {
    margin-top: 4px;
    color: var(--oc-color-text, #1e293b);
    font-size: clamp(1.18rem, 2.2vw, 1.52rem);
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .reader-turn-section__header span {
    display: block;
    margin-top: 8px;
    color: var(--oc-color-text-muted, #64748b);
    font-size: 0.9rem;
  }

  .reader-turn-section__messages {
    display: grid;
    gap: 14px;
  }

  @media (max-width: 720px) {
    .reader-turn-section {
      grid-template-columns: 1fr;
    }

    .reader-turn-section__marker {
      display: none;
    }

    .reader-turn-section__header {
      flex-direction: column;
    }
  }
</style>
