/**
 * Client-safe snippet utilities (#207).
 * No server imports — bundled into the browser.
 * Server CRUD lives in ./saved-replies.ts.
 */

export interface SavedReply {
  id: string
  title: string
  body: string
  createdAt: Date | string
}

/** Substitute {نام} and {کانال} variables in a saved-reply body. */
export function interpolate(body: string, vars: { senderName?: string; channelName?: string }): string {
  return body
    .replace(/\{نام\}/g, vars.senderName ?? '')
    .replace(/\{کانال\}/g, vars.channelName ?? '')
}
