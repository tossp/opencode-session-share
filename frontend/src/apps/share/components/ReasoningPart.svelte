<script module lang="ts">
  interface ReasoningPartData {
    text?: string;
  }

  export interface ReasoningPartProps {
    part: ReasoningPartData;
    open?: boolean;
  }
</script>

<script lang="ts">
  import { Collapse } from '../../../shared/components';
  import MarkdownBlock from './MarkdownBlock.svelte';

  let { part, open = false }: ReasoningPartProps = $props();
</script>

<section class="reasoning-part">
  <Collapse title="推理过程" bind:open>
    <MarkdownBlock content={part.text ?? ''} />
  </Collapse>
</section>

<style>
  @import '../../../shared/styles/tokens.css';

  .reasoning-part {
    border-left: 3px solid #38bdf8;
    padding-left: 12px;
  }
</style>
