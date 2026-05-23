<script module lang="ts">
  import type { UnknownPart as UnknownPartData } from '../../../shared/domain/types';

  export interface UnknownPartProps {
    part: UnknownPartData | Record<string, unknown>;
  }
</script>

<script lang="ts">
  import { Callout, CodeBlock, Icon } from '../../../shared/components';
  import { safeJson } from './markdown';

  let { part }: UnknownPartProps = $props();
  const raw = $derived(safeJson(part));
  const typeLabel = $derived(typeof part.type === 'string' ? part.type : 'unknown');
</script>

<Callout tone="warning" title={`未知片段：${typeLabel}`}>
  <div class="unknown-part__label"><Icon name="warning" /> Raw part</div>
  <CodeBlock code={raw} language="json" wrap maxHeight="360px" />
</Callout>

<style>
  .unknown-part__label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 10px;
    font-size: 0.78rem;
    font-weight: 800;
  }
</style>
