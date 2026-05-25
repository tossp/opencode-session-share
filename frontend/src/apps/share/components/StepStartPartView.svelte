<script module lang="ts">
  import type { StepStartPart } from '../../../shared/domain/types';

  export interface StepStartPartViewProps {
    part: StepStartPart;
  }
</script>

<script lang="ts">
  import { Badge, Icon } from '../../../shared/components';

  let { part }: StepStartPartViewProps = $props();
</script>

<section class="step-start">
  <div class="step-start__marker"><Icon name="check" /></div>
  <div class="step-start__content">
    <strong>步骤开始</strong>
    {#if part.snapshot}
      <Badge tone="accent" size="sm">snapshot: {part.snapshot}</Badge>
    {/if}
  </div>
</section>

<style>
  @import '../../../shared/styles/tokens.css';

  .step-start {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 12px;
    align-items: center;
    padding: 10px 16px;
    border: 1px solid #bfdbfe;
    border-radius: var(--oc-radius-lg, 16px);
    background: linear-gradient(135deg, #eff6ff 0%, #ffffff 100%);
    color: var(--oc-color-text, #1e293b);
  }

  .step-start__marker {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    background: #3b82f6;
    color: #fff;
    font-weight: 900;
  }

  .step-start__content {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .step-start__content strong {
    font-size: 0.92rem;
  }
</style>
