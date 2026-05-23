export { default as Badge } from './Badge.svelte';
export { default as Callout } from './Callout.svelte';
export { default as CodeBlock } from './CodeBlock.svelte';
export { default as Collapse } from './Collapse.svelte';
export { default as Drawer } from './Drawer.svelte';
export { default as Icon } from './Icon.svelte';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
export type BadgeSize = 'sm' | 'md';
export type CalloutTone = 'info' | 'success' | 'warning' | 'danger';
export type DrawerSide = 'left' | 'right';

export interface BadgeProps {
  tone?: BadgeTone;
  size?: BadgeSize;
}

export interface CalloutProps {
  tone?: CalloutTone;
  title?: string;
  compact?: boolean;
}

export interface CodeBlockProps {
  code: string;
  language?: string;
  wrap?: boolean;
  maxHeight?: string;
  showCopy?: boolean;
  copyLabel?: string;
  copiedLabel?: string;
  unavailableLabel?: string;
}

export interface CollapseProps {
  title: string;
  id?: string;
  open?: boolean;
}

export interface DrawerProps {
  open?: boolean;
  side?: DrawerSide;
  title?: string;
  label?: string;
  closeLabel?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  onClose?: () => void;
}
