/**
 * Issue #219: slot-swap reordering for the Instagram grid.
 *
 * The grid shows scheduled posts newest-first; each position corresponds to a
 * publish time slot. Dragging an item to a new position keeps the SET of slot
 * times fixed and reassigns items to slots, so the grid order and the publish
 * schedule stay consistent.
 */

export interface SlotItem {
  jobId: string
  at: string | null
}

export interface SlotChange {
  jobId: string
  scheduledAt: string
}

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/**
 * Returns the new item order plus the minimal set of reschedule changes
 * (only jobs whose slot time actually changed).
 */
export function computeSlotSwap<T extends SlotItem>(
  reorderables: T[],
  from: number,
  to: number
): { moved: T[]; slots: (string | null)[]; changes: SlotChange[] } {
  const moved = arrayMove(reorderables, from, to)
  const slots = reorderables.map((i) => i.at)
  const changes: SlotChange[] = []
  moved.forEach((item, idx) => {
    const slot = slots[idx]
    if (slot && item.at !== slot) changes.push({ jobId: item.jobId, scheduledAt: slot })
  })
  return { moved, slots, changes }
}
