<script module lang="ts">
  import type { DemoTurn } from './layout';

  export interface ShareTimelineProps {
    turns: DemoTurn[];
    title: string;
    shareID: string;
  }
</script>

<script lang="ts">
  import { Badge } from '../../shared/components';
  import { MarkdownBlock, PatchPart, ReasoningPart, StepFinishBlock, ToolCallCard } from './components';
  import { sectionID } from './layout';

  let { turns, title, shareID }: ShareTimelineProps = $props();
</script>

<section class="share-flow" aria-labelledby="share-title">
  <header class="hero-card">
    <div>
      <p class="eyebrow">OpenCode Session Share</p>
      <h1 id="share-title">{title}</h1>
      <p class="hero-card__copy">左侧优先呈现会话流；中栏提供分节跳转；右侧只保留可读摘要，方便快速判断会话规模与风险。</p>
    </div>
    <div class="session-chip" aria-label="Share ID">
      <span>Share ID</span>
      <strong>{shareID}</strong>
    </div>
  </header>

  <div class="timeline" aria-label="会话时间线">
    {#each turns as turn, index}
      <article class="turn-card" id={sectionID(turn.id)}>
        <div class="turn-card__marker" aria-hidden="true">{index + 1}</div>
        <div class="turn-card__body">
          <header class="turn-card__header">
            <div>
              <p>{turn.actor} · {turn.time}</p>
              <h2>{turn.title}</h2>
            </div>
            <Badge tone="accent" size="sm">{turn.category}</Badge>
          </header>
          <p class="turn-card__summary">{turn.summary}</p>

          <div class="render-stack">
            {#each turn.blocks as block}
              {#if block.kind === 'markdown'}
                <MarkdownBlock content={block.content} />
              {:else if block.kind === 'reasoning'}
                <ReasoningPart part={{ text: block.text }} />
              {:else if block.kind === 'tool'}
                <ToolCallCard part={block.part} />
              {:else if block.kind === 'patch'}
                <PatchPart part={{ files: block.files }} patch={block.patch} />
              {:else if block.kind === 'finish'}
                <StepFinishBlock part={block.part} />
              {/if}
            {/each}
          </div>
        </div>
      </article>
    {/each}
  </div>
</section>

<style>
  @import '../../shared/styles/tokens.css';

  .share-flow {
    min-width: 0;
    padding: 40px clamp(18px, 4vw, 56px);
  }

  .hero-card,
  .turn-card {
    border: 1px solid rgba(100, 116, 139, 0.2);
    border-radius: 28px;
    background: rgba(255, 255, 255, 0.76);
    box-shadow: 0 24px 70px rgba(15, 23, 42, 0.1);
    backdrop-filter: blur(18px);
  }

  .hero-card {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    padding: clamp(24px, 4vw, 42px);
    overflow: hidden;
  }

  .eyebrow {
    margin: 0 0 10px;
    color: #0f766e;
    font-size: 0.72rem;
    font-weight: 900;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  h1,
  h2,
  p {
    margin-top: 0;
  }

  h1 {
    max-width: 780px;
    margin-bottom: 14px;
    color: #0f172a;
    font-size: clamp(2.4rem, 7vw, 5.6rem);
    line-height: 0.92;
    letter-spacing: -0.08em;
  }

  .hero-card__copy {
    max-width: 720px;
    margin-bottom: 0;
    color: #475569;
    font-size: 1.05rem;
    line-height: 1.75;
  }

  .session-chip {
    display: grid;
    gap: 6px;
    min-width: 180px;
    padding: 14px 16px;
    border-radius: 18px;
    background: #0f172a;
    color: #e2e8f0;
  }

  .session-chip span,
  .session-chip strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .session-chip span {
    color: #67e8f9;
    font-size: 0.72rem;
    font-weight: 900;
    text-transform: uppercase;
  }

  .timeline {
    position: relative;
    display: grid;
    gap: 26px;
    margin-top: 28px;
  }

  .timeline::before {
    position: absolute;
    inset: 24px auto 24px 20px;
    width: 2px;
    background: linear-gradient(#0ea5e9, #14b8a6, #94a3b8);
    content: '';
  }

  .turn-card {
    position: relative;
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
    gap: 18px;
    padding: 22px;
    scroll-margin-top: 24px;
  }

  .turn-card__marker {
    z-index: 1;
    display: grid;
    width: 42px;
    height: 42px;
    place-items: center;
    border: 3px solid #ecfeff;
    border-radius: 999px;
    background: #0f766e;
    color: #fff;
    font-weight: 900;
  }

  .turn-card__body,
  .render-stack {
    display: grid;
    gap: 16px;
    min-width: 0;
  }

  .turn-card__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
  }

  .turn-card__header p,
  .turn-card__summary {
    color: #64748b;
  }

  .turn-card__header p {
    margin-bottom: 6px;
    font-size: 0.82rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .turn-card__header h2 {
    margin-bottom: 0;
    color: #111827;
    font-size: clamp(1.4rem, 3vw, 2.05rem);
    line-height: 1.05;
    letter-spacing: -0.04em;
  }

  .turn-card__summary {
    margin-bottom: 0;
    line-height: 1.65;
  }

  @media (max-width: 720px) {
    .share-flow {
      order: 1;
      padding: 18px;
    }

    .hero-card,
    .turn-card__header {
      flex-direction: column;
    }

    .turn-card {
      grid-template-columns: 34px minmax(0, 1fr);
      padding: 16px;
    }

    .turn-card__marker {
      width: 32px;
      height: 32px;
    }

    .timeline::before {
      left: 16px;
    }
  }
</style>
