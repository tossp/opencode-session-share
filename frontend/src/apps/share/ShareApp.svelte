<script lang="ts">
  import ShareMetaSidebar from './ShareMetaSidebar.svelte';
  import ShareTimeline from './ShareTimeline.svelte';
  import { buildNavSections, demoMeta, demoTurns } from './layout';

  const shareID = window.SHARE_ID ?? 'preview-session';
  const navSections = buildNavSections(demoTurns);
</script>

<svelte:head>
  <title>{demoMeta.title}</title>
</svelte:head>

<main class="share-shell">
  <ShareTimeline turns={demoTurns} title={demoMeta.title} {shareID} />

  <nav class="section-rail" aria-label="分节导航">
    <div class="section-rail__sticky">
      <span class="rail-label">Sections</span>
      {#each navSections as section}
        <a href={`#${section.id}`} aria-label={`跳转到 ${section.label}`}>
          <span class="rail-dot" aria-hidden="true"></span>
          <span class="rail-copy">
            <strong>{section.label}</strong>
            <small>{section.meta}</small>
          </span>
        </a>
      {/each}
    </div>
  </nav>

  <ShareMetaSidebar meta={demoMeta} />
</main>

<style>
  @import '../../shared/styles/tokens.css';

  :global(html) {
    scroll-behavior: smooth;
  }

  :global(body) {
    margin: 0;
    background:
      radial-gradient(circle at 8% 0%, rgba(14, 165, 233, 0.16), transparent 30rem),
      linear-gradient(135deg, #f8fafc 0%, #eef5f8 48%, #f8fafc 100%);
    color: #172033;
    font-family: Avenir Next, Trebuchet MS, Verdana, sans-serif;
  }

  .share-shell {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 88px minmax(280px, 340px);
    gap: 0;
    min-height: 100vh;
  }

  .section-rail {
    border-inline: 1px solid rgba(100, 116, 139, 0.2);
    background: rgba(15, 23, 42, 0.035);
  }

  .section-rail__sticky {
    position: sticky;
    top: 0;
    display: grid;
    gap: 14px;
    padding: 36px 16px;
  }

  .rail-label {
    margin: 0 0 10px;
    color: #0f766e;
    font-size: 0.72rem;
    font-weight: 900;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .section-rail a {
    display: grid;
    grid-template-columns: 16px minmax(0, 1fr);
    gap: 10px;
    color: #334155;
    text-decoration: none;
  }

  .rail-dot {
    width: 10px;
    height: 10px;
    margin-top: 5px;
    border-radius: 999px;
    background: #14b8a6;
    box-shadow: 0 0 0 5px rgba(20, 184, 166, 0.12);
  }

  .rail-copy {
    display: none;
  }

  @media (min-width: 1180px) {
    .share-shell {
      grid-template-columns: minmax(0, 1fr) 220px minmax(300px, 360px);
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
    .share-shell {
      grid-template-columns: minmax(0, 1fr) 72px;
    }
  }

  @media (max-width: 720px) {
    .share-shell {
      display: flex;
      flex-direction: column;
    }

    .section-rail {
      order: 2;
      border-block: 1px solid rgba(100, 116, 139, 0.2);
      border-inline: 0;
      overflow-x: auto;
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
