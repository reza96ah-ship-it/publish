/**
 * Client-safe CSV parsing utilities (#205).
 * No server imports here — this file is bundled into the browser.
 * Server-side validation + creation live in ./csv-import.ts.
 */

export interface CsvRow {
  title: string
  caption: string
  channels: string
  scheduledAt: string
  hashtags: string
}

export interface RowError {
  row: number
  field: string
  message: string
}

export interface ValidatedRow {
  row: number
  data: CsvRow
  channelIds: string[]
  scheduledAtIso: string | null
  errors: RowError[]
  valid: boolean
}

export const CSV_MAX_ROWS = 200

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

// Parses ALL data rows — no truncation. Callers must check length against
// CSV_MAX_ROWS and reject oversized files (silently dropping rows 201+ would
// let an import "succeed" while losing data).
export function parseCSV(text: string): CsvRow[] {
  const normalized = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const lines = normalized.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().trim())
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line)
    const get = (key: string) => values[headers.indexOf(key)]?.trim() ?? ''
    return {
      title: get('title'),
      caption: get('caption'),
      channels: get('channels'),
      scheduledAt: get('scheduled_at'),
      hashtags: get('hashtags'),
    }
  })
}
