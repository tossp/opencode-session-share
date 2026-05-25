<script module lang="ts">
  import type { SourceIndex } from '../../../shared/domain/opencode-types';
  import type { ReaderInjectedMessage, ReaderToolRun } from '../../../shared/domain/opencode-reader-types';
  import type { ResolvedRawSource, ShareRawSourceDebug } from '../layout';
  import type { ReaderDebugItem, ReaderSideItem, ReaderViewModel } from '../reader-view-model';

  export interface ProvenanceInspectorProps {
    reader: ReaderViewModel;
    rawSources: ShareRawSourceDebug;
  }

  interface InspectorTarget {
    category: string;
    label: string;
    id: string;
    description: string;
    sourceIndexes: SourceIndex[];
  }

  interface InspectorRow {
    target: InspectorTarget;
    sources: ResolvedRawSource[];
  }
</script>

<script lang="ts">
  import { Badge, Callout, Collapse } from '../../../shared/components';
  import RawJsonDrawer from './RawJsonDrawer.svelte';
  import { resolveRawSources } from '../layout';

  let { reader, rawSources }: ProvenanceInspectorProps = $props();

  let drawerOpen = $state(false);
  let selectedSource = $state<ResolvedRawSource | undefined>();

  const rows = $derived(buildRows(reader, rawSources));
  const uniqueSourceCount = $derived(uniqueRawSourceCount(rows));
  const drawerTitle = $derived(selectedSource === undefined ? '原始来源' : rawSourceTitle(selectedSource));
  const drawerValue = $derived(
    selectedSource === undefined
      ? null
      : {
          sourceIndex: selectedSource.sourceIndex,
          rawEntry: selectedSource.rawEntry,
          rawSourceItem: selectedSource.sourceItem,
        },
  );

  function buildRows(view: ReaderViewModel, debug: ShareRawSourceDebug): InspectorRow[] {
    return representativeTargets(view).map((target) => ({
      target,
      sources: resolveRawSources(debug, target.sourceIndexes),
    }));
  }

  function representativeTargets(view: ReaderViewModel): InspectorTarget[] {
    return [narrativeTarget(view), injectedTarget(view), sideEventTarget(view), toolRunTarget(view)].filter(isTarget);
  }

  function narrativeTarget(view: ReaderViewModel): InspectorTarget | undefined {
    const item = view.mainNarrative.find((entry) => entry.sourceIndexes.length > 0);
    if (item === undefined) return undefined;

    return {
      category: 'narrative',
      label: item.kind === 'real_user_input' ? '主叙事 · 用户输入' : '主叙事 · 助手回复',
      id: item.id,
      description: preview(item.text || item.message.content || item.id),
      sourceIndexes: view.provenance.byNarrativeID[item.id] ?? item.sourceIndexes,
    };
  }

  function injectedTarget(view: ReaderViewModel): InspectorTarget | undefined {
    const item = view.debugItems.find((entry) => isInjectedDebugValue(entry.value) && entry.sourceIndexes.length > 0);
    if (item === undefined || !isInjectedDebugValue(item.value)) return undefined;

    return {
      category: 'injected',
      label: `注入消息 · ${item.value.detection.kinds.join(' / ') || 'unknown'}`,
      id: item.value.id,
      description: preview(item.value.text || item.value.message.id || item.id),
      sourceIndexes: view.provenance.byMessageID[item.value.id] ?? item.sourceIndexes,
    };
  }

  function sideEventTarget(view: ReaderViewModel): InspectorTarget | undefined {
    const item = view.sideItems.find((entry) => entry.kind !== 'injected_message' && entry.sourceIndexes.length > 0);
    if (item === undefined) return undefined;

    return {
      category: 'side-event',
      label: `侧边事件 · ${item.kind}`,
      id: item.id,
      description: preview(item.text || item.messageID || item.id),
      sourceIndexes: view.provenance.bySideEventID[item.id] ?? item.sourceIndexes,
    };
  }

  function toolRunTarget(view: ReaderViewModel): InspectorTarget | undefined {
    const item = view.toolRuns.find((entry) => entry.sourceIndexes.length > 0);
    if (item === undefined) return undefined;

    return {
      category: 'tool-run',
      label: `工具运行 · ${item.tool || 'unknown'}`,
      id: item.callID ?? item.partID ?? item.tool,
      description: preview(toolDescription(item)),
      sourceIndexes: item.callID !== undefined ? (view.provenance.byToolCallID[item.callID] ?? item.sourceIndexes) : item.sourceIndexes,
    };
  }

  function isTarget(value: InspectorTarget | undefined): value is InspectorTarget {
    return value !== undefined;
  }

  function isInjectedDebugValue(value: ReaderDebugItem['value']): value is ReaderInjectedMessage {
    return 'detection' in value;
  }

  function openRawSource(source: ResolvedRawSource): void {
    selectedSource = source;
    drawerOpen = true;
  }

  function rawSourceTitle(source: ResolvedRawSource): string {
    return `raw #${source.sourceIndex.rawItemIndex} · ${source.rawEntry?.kind ?? 'unknown'}`;
  }

  function rawSourceLabel(source: ResolvedRawSource): string {
    return source.rawEntry === undefined ? '未解析 raw entry' : `${source.rawEntry.kind} · ${source.rawEntry.label}`;
  }

  function rawSourceMeta(source: ResolvedRawSource): string {
    const entry = source.rawEntry;
    return [entry?.messageID, entry?.itemID, source.sourceIndex.arrayOffset === undefined ? '' : `arrayOffset ${source.sourceIndex.arrayOffset}`]
      .filter((value) => value !== undefined && value.length > 0)
      .join(' · ') || 'root item';
  }

  function toolDescription(tool: ReaderToolRun): string {
    return tool.title ?? tool.state?.title ?? tool.status ?? tool.callID ?? tool.partID ?? 'tool source';
  }

  function preview(value: string): string {
    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized.length > 96 ? `${normalized.slice(0, 96)}…` : normalized;
  }

  function uniqueRawSourceCount(items: readonly InspectorRow[]): number {
    return new Set(items.reduce<number[]>((indexes, row) => indexes.concat(row.sources.map((source) => source.sourceIndex.rawItemIndex)), [])).size;
  }
</script>

<section class="provenance-inspector" aria-label="Raw provenance inspector">
  <header class="inspector-head">
    <div>
      <p class="eyebrow">Raw provenance inspector</p>
      <h3>Raw 来源解析</h3>
    </div>
    <div class="summary-chips" aria-label="Raw 来源摘要">
      <Badge tone="accent" size="sm">{rows.length} 类代表引用</Badge>
      <Badge tone="neutral" size="sm">{uniqueSourceCount} 个 raw 来源</Badge>
      <Badge tone="neutral" size="sm">entries {rawSources.entries.length}</Badge>
    </div>
  </header>

  <Callout compact title="调试视图已开启">
    <p>该面板由 <code>?debug=1</code> 暴露。默认只展示计数、标签和来源芯片；完整 raw entry / raw source item 需点击单条来源后在抽屉中查看。</p>
  </Callout>

  {#if rows.length > 0}
    <div class="target-stack">
      {#each rows as row (row.target.category)}
        <article class="target-card">
          <div class="target-card__head">
            <Badge tone="success" size="sm">{row.target.category}</Badge>
            <div>
              <h4>{row.target.label}</h4>
              <p>{row.target.id} · {row.target.description}</p>
            </div>
          </div>

          <ul class="source-list" aria-label={`${row.target.label} raw 来源列表`}>
            {#each row.sources as source, index (`${row.target.category}:${source.sourceIndex.rawItemIndex}:${source.sourceIndex.arrayOffset ?? 'root'}:${index}`)}
              <li>
                <button type="button" onclick={() => openRawSource(source)} aria-label={`查看 raw #${source.sourceIndex.rawItemIndex} 原始数据`}>
                  <span class="source-list__chips">
                    <Badge tone="accent" size="sm">raw #{source.sourceIndex.rawItemIndex}</Badge>
                    {#if source.sourceIndex.arrayOffset !== undefined}
                      <Badge tone="neutral" size="sm">arrayOffset {source.sourceIndex.arrayOffset}</Badge>
                    {/if}
                  </span>
                  <strong>{rawSourceLabel(source)}</strong>
                  <small>{rawSourceMeta(source)}</small>
                </button>
              </li>
            {/each}
          </ul>
        </article>
      {/each}
    </div>
  {:else}
    <Callout compact tone="warning" title="暂无可解析来源">
      <p>当前 reader 视图没有可映射的 SourceIndex。</p>
    </Callout>
  {/if}

  <Collapse title={`来源覆盖范围 · narrative ${reader.mainNarrative.length} / injected ${reader.debugItems.filter((item) => isInjectedDebugValue(item.value)).length} / side ${reader.sideItems.filter((item) => item.kind !== 'injected_message').length} / tool ${reader.toolRuns.length}`} id="provenance-inspector-coverage">
    <p class="coverage-note">覆盖检查只显示分类数量，避免默认展开大型 raw payload。点击上方 raw 来源可查看对应 JSON。</p>
  </Collapse>

  <RawJsonDrawer bind:open={drawerOpen} title={drawerTitle} value={drawerValue} />
</section>

<style>
  @import '../../../shared/styles/tokens.css';

  .provenance-inspector {
    display: grid;
    gap: 12px;
  }

  .inspector-head,
  .target-card__head {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    justify-content: space-between;
  }

  .eyebrow,
  h3,
  h4,
  p {
    margin-top: 0;
  }

  .eyebrow {
    margin-bottom: 6px;
    color: #0f766e;
    font-size: 0.68rem;
    font-weight: 900;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  h3,
  h4 {
    margin-bottom: 6px;
    color: #0f172a;
    line-height: 1.16;
  }

  h3 {
    font-size: 1rem;
  }

  h4 {
    font-size: 0.92rem;
  }

  p {
    margin-bottom: 0;
    color: #475569;
    font-size: 0.84rem;
    line-height: 1.55;
  }

  code {
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    font-size: 0.8em;
  }

  .summary-chips,
  .source-list__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .summary-chips {
    justify-content: flex-end;
  }

  .target-stack {
    display: grid;
    gap: 10px;
  }

  .target-card {
    display: grid;
    gap: 10px;
    padding: 12px;
    border: 1px solid rgba(20, 184, 166, 0.18);
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.76);
  }

  .target-card__head {
    justify-content: flex-start;
  }

  .source-list {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .source-list button {
    display: grid;
    gap: 6px;
    width: 100%;
    padding: 10px;
    border: 1px solid rgba(100, 116, 139, 0.18);
    border-radius: 14px;
    background: #f8fafc;
    color: #0f172a;
    cursor: pointer;
    font: inherit;
    text-align: left;
  }

  .source-list button:hover,
  .source-list button:focus-visible {
    border-color: rgba(14, 165, 233, 0.42);
    background: #ecfeff;
  }

  .source-list strong,
  .source-list small {
    overflow-wrap: anywhere;
  }

  .source-list strong {
    font-size: 0.84rem;
  }

  .source-list small,
  .coverage-note {
    color: #64748b;
    font-size: 0.78rem;
  }
</style>
