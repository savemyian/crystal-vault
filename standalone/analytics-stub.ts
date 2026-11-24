// Minimal stand-in for Enter's analytics SDK.
//
// `vite.config.standalone.ts` aliases '@enter-pro/analytics-sdk' to this file so
// the editor can be built with plain Vite, outside Enter, where that private
// package is not available. Analytics calls become no-ops; nothing else changes.

export type EventDefinition = Record<string, unknown>;

export function bootstrapEnterAnalytics(): void {
  // Usage tracking is disabled in standalone builds.
}

export function replaceEventDefinitions(definitions: EventDefinition[]): void {
  void definitions;
}
