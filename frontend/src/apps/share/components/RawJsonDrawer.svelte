<script module lang="ts">
  export interface RawJsonDrawerProps {
    open?: boolean;
    title?: string;
    value: unknown;
    onClose?: () => void;
  }
</script>

<script lang="ts">
  import { CodeBlock, Drawer } from '../../../shared/components';
  import { safeJson } from './markdown';

  let { open = $bindable(false), title = '原始数据', value, onClose }: RawJsonDrawerProps = $props();
  const rawJson = $derived(safeJson(value));
</script>

<Drawer bind:open title={title} label={title} closeLabel="关闭原始数据" {onClose}>
  <CodeBlock code={rawJson} language="json" wrap maxHeight="calc(100vh - 160px)" />
</Drawer>
