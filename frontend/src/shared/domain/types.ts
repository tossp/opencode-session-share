export interface RawShareItem {
  type: string;
  data: unknown;
}

declare global {
  interface Window {
    SHARE_ID?: string;
  }
}
