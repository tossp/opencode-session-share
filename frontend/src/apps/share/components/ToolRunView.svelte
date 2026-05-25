<script module lang="ts">
  import type { ToolPart, ToolCallPart } from '../../../shared/domain/types';

  export interface ToolRunViewProps {
    part: ToolPart | ToolCallPart;
  }
</script>

<script lang="ts">
  import ToolCallCard from './ToolCallCard.svelte';

  let { part }: ToolRunViewProps = $props();
</script>

<ToolCallCard {part} />
