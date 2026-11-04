export type KijazoConfig = {
  apiUrl?: string
  project?: string
  title?: string
  enableWhen?: 'query-param' | 'always' | 'never'
}
export type KijazoHandle = { destroy(): void; open(): void; close(): void }
export function mountKijazo(config?: KijazoConfig): KijazoHandle
