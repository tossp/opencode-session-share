<script module lang="ts">
  import type { StepFinishPart } from '../../../shared/domain/types';

  export interface StepFinishBlockProps {
    part: StepFinishPart;
  }
</script>

<script lang="ts">
  import { Badge, Icon } from '../../../shared/components';

  let { part }: StepFinishBlockProps = $props();
  const labels = $derived(
    [
      ['输入', part.tokens?.input],
      ['输出', part.tokens?.output],
      ['推理', part.tokens?.reasoning],
      ['总计', part.tokens?.total],
      ['缓存读', part.tokens?.cache?.read],
      ['缓存写', part.tokens?.cache?.write],
    ]
      .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
      .map(([label, value]) => `${label}: ${value}`),
  );
</script>

<section class="step-finish">
  <div class="step-finish__marker"><Icon name="check" /></div>
  <div class="step-finish__content">
    <div class="step-finish__header">
      <strong>步骤完成</strong>
      {#if part.reason}
        <Badge tone="success" size="sm">{part.reason}</Badge>
      {/if}
    </div>

    {#if labels.length > 0 || typeof part.cost === 'number'}
      <dl class="step-finish__metrics">
        {#each labels as label}
          <div><dd>{label}</dd></div>
        {/each}
        {#if typeof part.cost === 'number'}
          <div><dd>成本: ${part.cost.toFixed(6)}</dd></div>
        {/if}
      </dl>
    {/if}
  </div>
</section>

<style>
  @import '../../../shared/styles/tokens.css';

  .step-finish {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 12px;
    padding: 14px 16px;
    border: 1px solid #bbf7d0;
    border-radius: var(--oc-radius-lg, 16px);
    background: linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%);
    color: var(--oc-color-text, #1e293b);
  }

  .step-finish__marker {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    background: #16a34a;
    color: #fff;
    font-weight: 900;
  }

  .step-finish__content {
    display: grid;
    gap: 8px;
  }

  .step-finish__header,
  .step-finish__metrics {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin: 0;
  }

  .step-finish__metrics dd {
    margin: 0;
    color: var(--oc-color-text-muted, #64748b);
    font-size: 0.82rem;
    font-weight: 800;
  }
</style>
