/**
 * Reader Component Shared Primitives Policy
 *
 * Approved Primitives: Badge, Callout, Collapse, Drawer, CodeBlock, Icon
 * External UI libraries are explicitly forbidden.
 */

export const APPROVED_READER_PRIMITIVES = [
  'Badge',
  'Callout',
  'Collapse',
  'Drawer',
  'CodeBlock',
  'Icon'
] as const;

export type ApprovedPrimitive = typeof APPROVED_READER_PRIMITIVES[number];