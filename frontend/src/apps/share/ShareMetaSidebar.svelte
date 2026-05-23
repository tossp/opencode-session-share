<script module lang="ts">
  import type { ShareMetaSummary } from './layout';

  export interface ShareMetaSidebarProps {
    meta: ShareMetaSummary;
  }
</script>

<script lang="ts">
  let { meta }: ShareMetaSidebarProps = $props();
</script>

<aside class="meta-sidebar" aria-label="会话摘要">
  <div class="meta-sidebar__sticky">
    <section class="meta-panel meta-panel--hero">
      <p class="eyebrow">Session Meta</p>
      <h2>{meta.title}</h2>
      <dl class="meta-facts">
        <div><dt>Model</dt><dd>{meta.model}</dd></div>
        <div><dt>Cost</dt><dd>{meta.cost}</dd></div>
        <div><dt>Tokens</dt><dd>{meta.tokens}</dd></div>
        <div><dt>Duration</dt><dd>{meta.duration}</dd></div>
      </dl>
    </section>

    <section class="meta-panel">
      <h3>Counts</h3>
      <div class="count-grid">
        {#each meta.counts as item}
          <div><strong>{item.value}</strong><span>{item.label}</span></div>
        {/each}
      </div>
    </section>

    <section class="meta-panel">
      <h3>Activity summary</h3>
      <ul class="meta-list">
        {#each meta.activity as item}<li>{item}</li>{/each}
      </ul>
    </section>

    <section class="meta-panel">
      <h3>Files changed</h3>
      <ul class="file-list">
        {#each meta.filesChanged as file}<li>{file}</li>{/each}
      </ul>
    </section>

    <section class="meta-panel meta-panel--split">
      <div>
        <h3>Tool counts</h3>
        <ul class="compact-list">
          {#each meta.toolCounts as item}<li><span>{item.label}</span><strong>{item.value}</strong></li>{/each}
        </ul>
      </div>
      <div>
        <h3>Error counts</h3>
        <ul class="compact-list">
          {#each meta.errorCounts as item}<li><span>{item.label}</span><strong>{item.value}</strong></li>{/each}
        </ul>
      </div>
    </section>
  </div>
</aside>

<style>
  @import '../../shared/styles/tokens.css';

  .meta-sidebar {
    min-width: 0;
    padding: 28px 22px;
  }

  .meta-sidebar__sticky {
    position: sticky;
    top: 0;
    display: grid;
    gap: 16px;
    max-height: 100vh;
    overflow: auto;
    padding-bottom: 28px;
  }

  .meta-panel {
    padding: 18px;
    border: 1px solid rgba(100, 116, 139, 0.2);
    border-radius: 28px;
    background: rgba(255, 255, 255, 0.76);
    box-shadow: 0 24px 70px rgba(15, 23, 42, 0.1);
    backdrop-filter: blur(18px);
  }

  .eyebrow {
    margin: 0 0 10px;
    color: #0f766e;
    font-size: 0.72rem;
    font-weight: 900;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  h2,
  h3 {
    margin-top: 0;
    margin-bottom: 14px;
    color: #0f172a;
  }

  h2 {
    font-size: 1.35rem;
    line-height: 1.08;
    letter-spacing: -0.04em;
  }

  h3 {
    font-size: 0.9rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .meta-facts,
  .count-grid,
  .meta-list,
  .file-list,
  .compact-list {
    margin: 0;
  }

  .meta-facts {
    display: grid;
    gap: 10px;
  }

  .meta-facts div,
  .compact-list li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }

  .meta-facts dt,
  .meta-facts dd {
    margin: 0;
  }

  .meta-facts dt,
  .count-grid span,
  .compact-list span {
    color: #64748b;
    font-size: 0.78rem;
    font-weight: 800;
  }

  .meta-facts dd,
  .compact-list strong {
    color: #0f172a;
    font-weight: 900;
    text-align: right;
  }

  .count-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .count-grid div {
    display: grid;
    gap: 4px;
    padding: 12px;
    border-radius: 16px;
    background: #f1f5f9;
  }

  .count-grid strong {
    color: #0f766e;
    font-size: 1.35rem;
  }

  .meta-list,
  .file-list,
  .compact-list {
    display: grid;
    gap: 8px;
    padding-left: 18px;
    color: #475569;
    line-height: 1.45;
  }

  .file-list li {
    overflow-wrap: anywhere;
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    font-size: 0.78rem;
  }

  .compact-list {
    padding-left: 0;
    list-style: none;
  }

  .meta-panel--split {
    display: grid;
    gap: 16px;
  }

  @media (max-width: 960px) {
    .meta-sidebar {
      grid-column: 1 / -1;
      order: 3;
      padding-top: 0;
    }

    .meta-sidebar__sticky {
      position: static;
      max-height: none;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      overflow: visible;
    }

    .meta-panel--hero,
    .meta-panel--split {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 720px) {
    .meta-sidebar {
      order: 3;
      padding: 0 18px 24px;
    }

    .meta-sidebar__sticky {
      grid-template-columns: 1fr;
    }
  }
</style>
