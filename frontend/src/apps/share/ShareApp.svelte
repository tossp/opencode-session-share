<script lang="ts">
  const shareID = window.SHARE_ID ?? '';
</script>

<main class="share-shell">
  <section class="share-flow">
    <h1>OpenCode Session Share</h1>
    <p>Share ID: {shareID}</p>
    <p>这里将承载左侧主体会话流。</p>
  </section>

  <nav class="section-rail" aria-label="分节导航">
    <span></span>
  </nav>

  <aside class="meta-sidebar">
    <h2>Meta</h2>
    <p>这里将承载汇聚后的 session 信息。</p>
  </aside>
</main>

<style>
  .share-shell {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 48px 320px;
    min-height: 100vh;
  }

  .share-flow {
    padding: 32px;
  }

  .section-rail {
    border-inline: 1px solid #e5e7eb;
    padding-block: 32px;
  }

  .section-rail span {
    display: block;
    width: 16px;
    height: 2px;
    margin: 0 auto;
    border-radius: 999px;
    background: #94a3b8;
  }

  .meta-sidebar {
    padding: 32px 24px;
    background: #f8fafc;
  }
</style>
