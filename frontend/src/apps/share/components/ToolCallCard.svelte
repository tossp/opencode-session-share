<script module lang="ts">
  interface ToolCardState {
    status?: string;
    title?: string;
    input?: string | Record<string, unknown>;
    output?: string;
    time?: {
      start?: number;
      end?: number;
    };
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
  }

  interface ToolCardPart {
    tool?: string;
    callID?: string;
    state?: ToolCardState;
  }

  export interface ToolCallCardProps {
    part: ToolCardPart;
  }
</script>

<script lang="ts">
  import { Badge, CodeBlock, Collapse } from '../../../shared/components';
  import RawJsonDrawer from './RawJsonDrawer.svelte';
  import { formatToolInput, summarizeToolOutput, toolDisplayName, toolStatusTone, toolTitle } from './tool-output';

  let { part }: ToolCallCardProps = $props();
  let drawerOpen = $state(false);

  const toolState = $derived<ToolCardState>(part.state ?? {});
  const status = $derived(toolState.status?.trim() || 'unknown');
  const name = $derived(toolDisplayName(part, toolState));
  const title = $derived(toolTitle(toolState));
  const input = $derived(formatToolInput(toolState.input));
  const output = $derived(toolState.output?.trim() ?? '');
  const outputSummary = $derived(summarizeToolOutput(output));
  const duration = $derived(
    typeof toolState.time?.start === 'number' && typeof toolState.time?.end === 'number'
      ? toolState.time.end - toolState.time.start
      : undefined,
  );
</script>

<article class="tool-card">
  <header class="tool-card__header">
    <div class="tool-card__title">
      <span class="tool-card__icon" aria-hidden="true">⌘</span>
      <div>
        <h3>{name}</h3>
        {#if title}
          <p>{title}</p>
        {/if}
      </div>
    </div>
    <Badge tone={toolStatusTone(status)} size="sm">{status}</Badge>
  </header>

  {#if input}
    <Collapse title="输入" open={false}>
      <CodeBlock code={input} language="text" wrap maxHeight="240px" />
    </Collapse>
  {/if}

  {#if output}
    <section class="tool-card__output">
      <div class="tool-card__output-head">
        <span>输出</span>
        {#if outputSummary.isLong}
          <button type="button" onclick={() => (drawerOpen = true)}>查看完整输出</button>
        {/if}
      </div>
      {#if outputSummary.isLong}
        <Collapse title={`已折叠长输出（${outputSummary.lineCount} 行 / ${outputSummary.charCount} 字符）`} open={false}>
          <CodeBlock code={outputSummary.preview} language="text" wrap maxHeight="220px" />
        </Collapse>
      {:else}
        <CodeBlock code={outputSummary.full} language="text" wrap maxHeight="320px" />
      {/if}
    </section>
  {/if}

  {#if duration !== undefined || part.callID}
    <footer class="tool-card__meta">
      {#if part.callID}<span>call: {part.callID}</span>{/if}
      {#if duration !== undefined}<span>{duration}ms</span>{/if}
    </footer>
  {/if}
</article>

<RawJsonDrawer bind:open={drawerOpen} title={`${name} 完整输出`} value={{ output: outputSummary.full }} />

<style>
  @import '../../../shared/styles/tokens.css';

  .tool-card {
    display: grid;
    gap: 12px;
    padding: 14px;
    border: 1px solid var(--oc-color-border, #dbe3ef);
    border-radius: var(--oc-radius-lg, 16px);
    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
  }

  .tool-card__header,
  .tool-card__output-head,
  .tool-card__meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .tool-card__title {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 10px;
  }

  .tool-card__icon {
    display: grid;
    flex: 0 0 auto;
    width: 32px;
    height: 32px;
    place-items: center;
    border-radius: 10px;
    background: var(--oc-color-surface-strong, #0f172a);
    color: var(--oc-color-text-inverse, #e2e8f0);
    font-weight: 900;
  }

  .tool-card h3,
  .tool-card p {
    margin: 0;
  }

  .tool-card h3 {
    color: var(--oc-color-text, #1e293b);
    font-size: 0.98rem;
  }

  .tool-card p,
  .tool-card__meta {
    color: var(--oc-color-text-muted, #64748b);
    font-size: 0.82rem;
  }

  .tool-card__output {
    display: grid;
    gap: 8px;
  }

  .tool-card__output-head span {
    color: var(--oc-color-text, #1e293b);
    font-size: 0.85rem;
    font-weight: 900;
  }

  .tool-card__output-head button {
    padding: 5px 9px;
    border: 1px solid rgba(14, 165, 233, 0.28);
    border-radius: var(--oc-radius-sm, 6px);
    background: var(--oc-color-accent-soft, #e0f2fe);
    color: #075985;
    cursor: pointer;
    font: inherit;
    font-size: 0.78rem;
    font-weight: 800;
  }

  .tool-card__meta {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
</style>
