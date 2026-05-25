<script module lang="ts">
  import type { ShareViewModel } from './layout';

  export interface ReaderShellProps {
    view: ShareViewModel;
    shareID: string;
    debugEnabled?: boolean;
    onOpenDebug?: () => void;
  }
</script>

<script lang="ts">
  import { Icon } from '../../shared/components';
  import NarrativeList from './NarrativeList.svelte';
  import ShareMetaSidebar from './ShareMetaSidebar.svelte';

  let { view, shareID, debugEnabled = false, onOpenDebug }: ReaderShellProps = $props();
</script>

<main class="reader-shell">
  <div class="top-actions" aria-label="页面操作">
    {#if debugEnabled}
      <button type="button" onclick={() => onOpenDebug?.()}>更多</button>
    {/if}
  </div>

  <section class="reader-flow" aria-labelledby="share-title">
    <header class="hero-card">
      <div>
        <p class="eyebrow"><Icon name="agent" size={14} /> OpenCode Session Share</p>
        <h1 id="share-title">{view.meta.title}</h1>
        <p class="hero-card__copy">左侧优先呈现可阅读的主叙事；中栏按 Reader 章节跳转；右侧保留语义摘要、侧边事件与调试来源，方便快速判断会话规模与风险。</p>
      </div>
      <div class="session-chip" aria-label="Share ID">
        <span>Share ID</span>
        <strong>{shareID}</strong>
      </div>
    </header>

    <NarrativeList sections={view.reader.sections} />
  </section>

  <nav class="section-rail" aria-label="分节导航">
    <div class="section-rail__sticky">
      <span class="rail-label">会话节点</span>
      {#each view.navSections as section}
        <a href={`#${section.id}`} aria-label={`跳转到 ${section.label}`}>
          <span class="rail-dot" aria-hidden="true"><Icon name="chevron" size={12} /></span>
          <span class="rail-copy">
            <strong>{section.label}</strong>
            <small>{section.meta}</small>
          </span>
        </a>
      {/each}
    </div>
  </nav>

  <ShareMetaSidebar meta={view.meta} reader={view.reader} warnings={view.normalized.warnings} normalized={view.normalized} rawSources={view.rawSources} {debugEnabled} />
</main>

<style>
  @import '../../shared/styles/tokens.css';

  .reader-shell {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 96px minmax(280px, 340px);
    gap: 0;
    width: min(100%, 1800px);
    min-height: 100vh;
    margin-inline: auto;
  }

  .top-actions {
    position: fixed;
    z-index: 10;
    top: 18px;
    right: 18px;
  }

  .top-actions button {
    padding: 10px 14px;
    border: 0;
    border-radius: 999px;
    background: #0f172a;
    color: #ecfeff;
    cursor: pointer;
    font-weight: 900;
    letter-spacing: 0.04em;
    box-shadow: 0 14px 34px rgba(15, 23, 42, 0.18);
  }

  .reader-flow {
    min-width: 0;
    padding: 40px clamp(18px, 4vw, 56px);
  }

  .hero-card {
    display: flex;
    gap: 24px;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 28px;
    padding: clamp(22px, 3vw, 34px);
    overflow: hidden;
    border: 1px solid rgba(100, 116, 139, 0.2);
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.88);
    box-shadow: 0 12px 38px rgba(15, 23, 42, 0.08);
    backdrop-filter: blur(18px);
  }

  .eyebrow,
  .rail-label {
    margin: 0 0 10px;
    color: #0f766e;
    font-size: 0.72rem;
    font-weight: 900;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .eyebrow {
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }

  h1,
  p {
    margin-top: 0;
  }

  h1 {
    max-width: 780px;
    margin-bottom: 14px;
    color: #0f172a;
    font-size: clamp(1.8rem, 4vw, 3.8rem);
    line-height: 1.02;
    letter-spacing: -0.06em;
    overflow-wrap: anywhere;
  }

  .hero-card__copy {
    max-width: 720px;
    margin-bottom: 0;
    color: #475569;
    font-size: 0.98rem;
    line-height: 1.65;
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

  .section-rail {
    position: relative;
    border-inline: 1px solid rgba(100, 116, 139, 0.18);
    background: linear-gradient(90deg, rgba(15, 23, 42, 0.018), rgba(15, 23, 42, 0.045));
  }

  .section-rail::before {
    position: absolute;
    inset: 0 auto 0 50%;
    width: 2px;
    background: linear-gradient(transparent, rgba(20, 184, 166, 0.5), transparent);
    content: '';
    transform: translateX(-50%);
  }

  .section-rail__sticky {
    position: sticky;
    z-index: 1;
    top: 0;
    display: grid;
    gap: 14px;
    padding: 36px 16px;
  }

  .section-rail a {
    display: grid;
    grid-template-columns: 16px minmax(0, 1fr);
    gap: 10px;
    color: #334155;
    text-decoration: none;
  }

  .section-rail a:hover .rail-dot,
  .section-rail a:focus-visible .rail-dot {
    background: #0ea5e9;
    color: #fff;
  }

  .rail-dot {
    display: grid;
    width: 10px;
    height: 10px;
    place-items: center;
    margin-top: 3px;
    border-radius: 999px;
    background: #f8fafc;
    color: #0f766e;
    box-shadow: 0 0 0 5px rgba(20, 184, 166, 0.12), inset 0 0 0 1px rgba(20, 184, 166, 0.32);
    transition: background var(--oc-transition-fast, 150ms ease), color var(--oc-transition-fast, 150ms ease);
  }

  .rail-copy {
    display: none;
  }

  @media (min-width: 1180px) {
    .reader-shell {
      grid-template-columns: minmax(0, 1fr) 240px minmax(300px, 360px);
    }

    .rail-copy {
      display: grid;
      gap: 2px;
    }

    .rail-copy strong {
      font-size: 0.86rem;
      line-height: 1.2;
    }

    .rail-copy small {
      color: #64748b;
      font-size: 0.72rem;
      font-weight: 800;
      text-transform: uppercase;
    }
  }

  @media (max-width: 960px) {
    .reader-shell {
      grid-template-columns: minmax(0, 1fr) 72px;
    }

    .reader-shell > :global(.reader-side-panel),
    .reader-shell > :global(.meta-sidebar) {
      display: none;
    }
  }

  @media (max-width: 720px) {
    .reader-shell {
      display: flex;
      flex-direction: column;
    }

    .reader-flow {
      order: 1;
      padding: 18px;
    }

    .hero-card {
      flex-direction: column;
    }

    .section-rail {
      order: 2;
      overflow-x: auto;
      border-block: 1px solid rgba(100, 116, 139, 0.2);
      border-inline: 0;
    }

    .section-rail__sticky {
      position: static;
      display: flex;
      min-width: max-content;
      padding: 14px 18px;
    }

    .section-rail a {
      grid-template-columns: 14px auto;
      min-width: 180px;
    }

    .rail-copy {
      display: grid;
    }
  }
</style>
