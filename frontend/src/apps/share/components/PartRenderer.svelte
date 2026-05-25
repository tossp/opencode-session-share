<script module lang="ts">
  import type { RenderItem } from '../../../shared/domain/opencode-types';

  export interface PartRendererProps {
    item: RenderItem;
    patch?: string;
  }
</script>

<script lang="ts">
  import type {
    CompactionPart,
    PatchPart as PatchPartType,
    RawPartData,
    ReasoningPart as ReasoningPartType,
    StepFinishPart,
    StepStartPart,
    TextPart,
    ToolCallPart,
    ToolPart,
  } from '../../../shared/domain/types';
  import CompactionPartView from './CompactionPartView.svelte';
  import MarkdownBlock from './MarkdownBlock.svelte';
  import PatchPart from './PatchPart.svelte';
  import ReasoningPart from './ReasoningPart.svelte';
  import StepFinishBlock from './StepFinishBlock.svelte';
  import StepStartPartView from './StepStartPartView.svelte';
  import ToolGroupView from './ToolGroupView.svelte';
  import ToolRunView from './ToolRunView.svelte';
  import UnknownPart from './UnknownPart.svelte';

  let { item, patch }: PartRendererProps = $props();

  function isTextPart(p: RawPartData): p is TextPart {
    return p.type === 'text';
  }

  function isReasoningPart(p: RawPartData): p is ReasoningPartType {
    return p.type === 'reasoning';
  }

  function isToolPart(p: RawPartData): p is ToolPart | ToolCallPart {
    return p.type === 'tool' || p.type === 'tool-call';
  }

  function isPatchPart(p: RawPartData): p is PatchPartType {
    return p.type === 'patch';
  }

  function isStepStartPart(p: RawPartData): p is StepStartPart {
    return p.type === 'step-start';
  }

  function isStepFinishPart(p: RawPartData): p is StepFinishPart {
    return p.type === 'step-finish';
  }

  function isCompactionPart(p: RawPartData): p is CompactionPart {
    return p.type === 'compaction';
  }
</script>

{#if item.type === 'tool-group'}
  <ToolGroupView parts={item.parts} />
{:else if isTextPart(item.part)}
  <MarkdownBlock content={item.part.text ?? ''} />
{:else if isReasoningPart(item.part)}
  <ReasoningPart part={{ text: item.part.text }} />
{:else if isToolPart(item.part)}
  <ToolRunView part={item.part} />
{:else if isPatchPart(item.part)}
  <PatchPart part={{ files: item.part.files }} {patch} />
{:else if isStepStartPart(item.part)}
  <StepStartPartView part={item.part} />
{:else if isStepFinishPart(item.part)}
  <StepFinishBlock part={item.part} />
{:else if isCompactionPart(item.part)}
  <CompactionPartView part={item.part} />
{:else}
  <UnknownPart part={item.part} />
{/if}
