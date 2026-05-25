<script module lang="ts">
  import type { ReasoningPart as ReasoningPartType } from '../../../shared/domain/types';

  export interface ReasoningPartProps {
    part: Pick<ReasoningPartType, 'text'>;
    open?: boolean;
  }
</script>

<script lang="ts">
  import { Collapse, Icon } from '../../../shared/components';
  import MarkdownBlock from './MarkdownBlock.svelte';

  let { part, open = false }: ReasoningPartProps = $props();
</script>

<section class="reasoning-part">
  <Collapse title="推理过程" bind:open>
    <div class="reasoning-part__label"><Icon name="thinking" /> Thinking</div>
    <MarkdownBlock content={part.text ?? ''} />
  </Collapse>
</section>

<style>
  @import '../../../shared/styles/tokens.css';

  .reasoning-part {
    border-left: 3px solid #38bdf8;
    padding-left: 12px;
  }

  .reasoning-part__label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 10px;
    color: var(--oc-color-text-muted, #64748b);
    font-size: 0.78rem;
    font-weight: 800;
  }
</style>
