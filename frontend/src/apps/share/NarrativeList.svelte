<script module lang="ts">
  import type { ReaderTurnSection } from './reader-view-model';

  export interface NarrativeListProps {
    sections: ReaderTurnSection[];
  }
</script>

<script lang="ts">
  import ReaderTurnSectionView from './components/ReaderTurnSectionView.svelte';

  let { sections }: NarrativeListProps = $props();
</script>

<section class="narrative-list" aria-label="主叙事列表">
  {#if sections.length > 0}
    <div class="narrative-list__rail" aria-hidden="true"></div>
    <div class="narrative-list__sections">
      {#each sections as section, index (section.id || `section-${index}`)}
        <ReaderTurnSectionView {section} {index} />
      {/each}
    </div>
  {:else}
    <div class="narrative-list__empty">
      <p>暂无可阅读的主叙事内容。</p>
      <span>注入消息、侧边事件与调试数据不会显示在这里。</span>
    </div>
  {/if}
</section>

<style>
  @import '../../shared/styles/tokens.css';

  .narrative-list {
    position: relative;
    min-width: 0;
  }

  .narrative-list__sections {
    display: grid;
    gap: 20px;
  }

  .narrative-list__rail {
    position: absolute;
    inset: 18px auto 18px 19px;
    width: 2px;
    background: linear-gradient(#0ea5e9, #14b8a6, rgba(148, 163, 184, 0.18));
  }

  .narrative-list__empty {
    display: grid;
    gap: 8px;
    padding: 28px;
    border: 1px dashed var(--oc-color-border, #dbe3ef);
    border-radius: 22px;
    background:
      radial-gradient(circle at top left, rgba(14, 165, 233, 0.12), transparent 36%),
      var(--oc-color-surface, #fff);
    color: var(--oc-color-text, #1e293b);
  }

  .narrative-list__empty p,
  .narrative-list__empty span {
    margin: 0;
  }

  .narrative-list__empty p {
    font-size: 1rem;
    font-weight: 900;
  }

  .narrative-list__empty span {
    color: var(--oc-color-text-muted, #64748b);
    font-size: 0.9rem;
  }

  @media (max-width: 720px) {
    .narrative-list__rail {
      display: none;
    }
  }
</style>
