<script module lang="ts">
  import type { NormalizationWarning, NormalizedShareData } from '../../shared/domain/normalize';
  import type { ReaderInjectedMessage, ReaderSideEvent, ReaderToolRun } from '../../shared/domain/opencode-reader-types';
  import type { ShareMetaSummary, ShareRawSourceDebug } from './layout';
  import type { ReaderDebugItem, ReaderFileSummary, ReaderSideItem, ReaderViewModel } from './reader-view-model';

  export interface ReaderSidePanelProps {
    meta: ShareMetaSummary;
    reader: ReaderViewModel;
    warnings?: NormalizationWarning[];
    normalized?: NormalizedShareData;
    rawSources?: ShareRawSourceDebug;
    debugEnabled?: boolean;
  }
</script>

<script lang="ts">
  import { Badge, Collapse } from '../../shared/components';
  import InjectedMessagesPanel from './components/InjectedMessagesPanel.svelte';
  import ProvenanceInspector from './components/ProvenanceInspector.svelte';
  import ProvenanceView from './components/ProvenanceView.svelte';
  import SideEventView from './components/SideEventView.svelte';

  let { meta, reader, warnings = [], normalized, rawSources, debugEnabled = false }: ReaderSidePanelProps = $props();

  const visibleWarnings = $derived(normalized?.warnings ?? warnings);
  const injectedItems = $derived(reader.sideItems.filter(isInjectedSideItem));
  const sideEvents = $derived(reader.sideItems.filter(isSideEventItem));
  const injectedMessages = $derived(reader.debugItems.map((item) => item.value).filter(isInjectedDebugValue));
  const sideEventCount = $derived(reader.sideItems.length > 0 ? sideEvents.length : (reader.rawDebug.sideEventCount ?? 0));
  const readerCounts = $derived([
    { label: '主叙事', value: countLabel(reader.meta.narrativeCount, reader.mainNarrative.length) },
    { label: '章节', value: countLabel(reader.meta.sectionCount, reader.sections.length) },
    { label: '注入消息', value: String(reader.rawDebug.injectedUserMessageCount ?? injectedItems.length) },
    { label: '侧边事件', value: String(sideEventCount) },
    { label: '工具运行', value: String(reader.toolRuns.length) },
    { label: '警告', value: String(visibleWarnings.length) },
    { label: '文件', value: String(reader.fileSummaries.length) },
    { label: 'Raw items', value: String(reader.rawDebug.totalRawItems ?? reader.meta.totalRawItems) },
  ]);
  const toolSummaries = $derived(summarizeTools(reader.toolRuns));
  const fileSummaries = $derived(reader.fileSummaries.length > 0 ? reader.fileSummaries : meta.filesChanged.map(toLegacyFileSummary));
  const provenanceSources = $derived(Object.values(reader.provenance.byNarrativeID).reduce((items, sources) => items.concat(sources), []));

  function countLabel(primary: number | undefined, fallback: number): string {
    return String(primary ?? fallback);
  }

  function isInjectedSideItem(item: ReaderSideItem): boolean {
    return item.kind === 'injected_message';
  }

  function isSideEventItem(item: ReaderSideItem): item is ReaderSideEvent {
    return item.kind !== 'injected_message';
  }

  function isInjectedDebugValue(value: ReaderDebugItem['value']): value is ReaderInjectedMessage {
    return 'detection' in value;
  }

  function toLegacyFileSummary(file: string): ReaderFileSummary {
    return { file, patch: '', sourceIndexes: [] };
  }

  function summarizeTools(toolRuns: readonly ReaderToolRun[]): Array<{ label: string; value: number }> {
    const counts = new Map<string, number>();
    for (const tool of toolRuns) {
      counts.set(tool.tool || 'unknown', (counts.get(tool.tool || 'unknown') ?? 0) + 1);
    }
    return [...counts.entries()].map(([label, value]) => ({ label, value }));
  }

  function toolLabel(tool: ReaderToolRun): string {
    return tool.title ?? tool.tool ?? 'unknown tool';
  }

  function toolState(tool: ReaderToolRun): string {
    return tool.status ?? tool.state?.status ?? '未知状态';
  }

  function fileMeta(file: ReaderFileSummary): string {
    const stats = [file.status, numberMeta(file.additions, '+'), numberMeta(file.deletions, '-')].filter(Boolean).join(' · ');
    return stats || '变更详情未知';
  }

  function numberMeta(value: number | undefined, prefix: string): string {
    return value === undefined ? '' : `${prefix}${value}`;
  }
</script>

<aside class="reader-side-panel" aria-label="阅读器侧栏">
  <div class="reader-side-panel__sticky">
    <section class="reader-panel reader-panel--hero">
      <p class="eyebrow">Reader Overview</p>
      <h2>{meta.title}</h2>
      <dl class="meta-facts">
        <div><dt>Root session</dt><dd>{reader.meta.rootSessionID}</dd></div>
        <div><dt>Model</dt><dd>{meta.model}</dd></div>
        <div><dt>Cost</dt><dd>{meta.cost}</dd></div>
        <div><dt>Tokens</dt><dd>{meta.tokens}</dd></div>
        <div><dt>Duration</dt><dd>{meta.duration}</dd></div>
      </dl>
    </section>

    <section class="reader-panel">
      <h3>Reader semantic counts</h3>
      <div class="count-grid">
        {#each readerCounts as item}
          <div><strong>{item.value}</strong><span>{item.label}</span></div>
        {/each}
      </div>
    </section>

    <section class="reader-panel">
      <h3>Tool summary</h3>
      {#if toolSummaries.length > 0}
        <ul class="compact-list">
          {#each toolSummaries as item}<li><span>{item.label}</span><strong>{item.value}</strong></li>{/each}
        </ul>
        <Collapse title={`工具运行明细 · ${reader.toolRuns.length}`} id="reader-tool-runs">
          <ul class="detail-list">
            {#each reader.toolRuns as tool, index (`${tool.callID ?? tool.partID ?? tool.tool}:${index}`)}
              <li><strong>{toolLabel(tool)}</strong><span>{toolState(tool)}</span></li>
            {/each}
          </ul>
        </Collapse>
      {:else}
        <p class="empty-text">暂无工具调用。</p>
      {/if}
    </section>

    <section class="reader-panel">
      <h3>Files changed</h3>
      {#if fileSummaries.length > 0}
        <ul class="file-list">
          {#each fileSummaries as file, index (`${file.file}:${index}`)}
            <li><strong>{file.file}</strong><span>{fileMeta(file)}</span></li>
          {/each}
        </ul>
      {:else}
        <p class="empty-text">暂无文件变更。</p>
      {/if}
    </section>

    <section class="reader-panel">
      <h3>Warning summary</h3>
      {#if visibleWarnings.length > 0}
        <ul class="warning-list">
          {#each visibleWarnings as warning, index (`${warning.code}:${warning.index}:${index}`)}
            <li><Badge tone="warning" size="sm">{warning.code}</Badge><span>{warning.message}</span></li>
          {/each}
        </ul>
      {:else}
        <p class="empty-text">未发现兼容警告。</p>
      {/if}
    </section>

    <InjectedMessagesPanel messages={injectedMessages} />

    <section class="reader-panel reader-panel--debug">
      <Collapse title={`侧边事件 · ${sideEvents.length}`} id="reader-side-events">
        {#if sideEvents.length > 0}
          <div class="side-event-stack">
            {#each sideEvents as event, index (`${event.id}:${event.kind}:${index}`)}
              <SideEventView {event} />
            {/each}
          </div>
        {:else}
          <p class="empty-text">暂无侧边事件。</p>
        {/if}
      </Collapse>

      <Collapse title="来源索引与调试入口" id="reader-provenance">
        {#if debugEnabled && rawSources !== undefined}
          <ProvenanceInspector {reader} {rawSources} />
        {:else}
          <ProvenanceView sourceIndexes={provenanceSources} title="主叙事来源索引" compact />
          <p class="debug-note">追加 <code>?debug=1</code> 可查看 raw/provenance inspector；完整 JSON 默认不展开。</p>
        {/if}
      </Collapse>
    </section>
  </div>
</aside>

<style>
  @import '../../shared/styles/tokens.css';

  .reader-side-panel {
    min-width: 0;
    padding: 28px 22px;
  }

  .reader-side-panel__sticky {
    position: sticky;
    top: 0;
    display: grid;
    gap: 16px;
    max-height: 100vh;
    overflow: auto;
    padding-bottom: 28px;
  }

  .reader-panel {
    padding: 18px;
    border: 1px solid rgba(20, 184, 166, 0.22);
    border-radius: 28px;
    background: linear-gradient(145deg, rgba(255, 255, 255, 0.84), rgba(240, 253, 250, 0.72));
    box-shadow: 0 24px 70px rgba(15, 23, 42, 0.1);
    backdrop-filter: blur(18px);
  }

  .reader-panel--debug {
    display: grid;
    gap: 12px;
    padding: 12px;
    background: rgba(248, 250, 252, 0.82);
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
  .compact-list,
  .detail-list,
  .file-list,
  .warning-list {
    margin: 0;
  }

  .meta-facts {
    display: grid;
    gap: 10px;
  }

  .meta-facts div,
  .compact-list li,
  .detail-list li,
  .file-list li {
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
  .compact-list span,
  .detail-list span,
  .file-list span {
    color: #64748b;
    font-size: 0.78rem;
    font-weight: 800;
  }

  .meta-facts dd,
  .compact-list strong,
  .detail-list strong,
  .file-list strong {
    color: #0f172a;
    font-weight: 900;
    overflow-wrap: anywhere;
  }

  .meta-facts dd {
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
    background: #ecfeff;
  }

  .count-grid strong {
    color: #0f766e;
    font-size: 1.35rem;
  }

  .compact-list,
  .detail-list,
  .file-list,
  .warning-list {
    display: grid;
    gap: 8px;
    padding-left: 0;
    list-style: none;
  }

  .detail-list,
  .file-list,
  .warning-list {
    line-height: 1.45;
  }

  .warning-list li {
    display: grid;
    gap: 6px;
    color: #475569;
    font-size: 0.86rem;
  }

  .file-list strong {
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    font-size: 0.78rem;
  }

  .side-event-stack {
    display: grid;
    gap: 10px;
  }

  .empty-text,
  .debug-note {
    margin: 0;
    color: #64748b;
    font-size: 0.88rem;
  }

  @media (max-width: 960px) {
    .reader-side-panel {
      grid-column: 1 / -1;
      order: 3;
      padding-top: 0;
    }

    .reader-side-panel__sticky {
      position: static;
      max-height: none;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      overflow: visible;
    }

    .reader-panel--hero,
    .reader-panel--debug {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 720px) {
    .reader-side-panel {
      order: 3;
      padding: 0 18px 24px;
    }

    .reader-side-panel__sticky {
      grid-template-columns: 1fr;
    }
  }
</style>
