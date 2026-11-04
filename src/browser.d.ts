export type KijazoConfig = {
  apiUrl: string
  project?: string
  title?: string
  initialContent?: Record<string, string>
  onContentChange?: (next: Record<string, string>) => void
  enableWhen?: 'query-param' | 'always'
}
export type KijazoHandle = { destroy(): void; open(): void; close(): void }
export function mountKijazo(config: KijazoConfig): KijazoHandle
