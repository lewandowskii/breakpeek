/** Minimal Client Runtime value exports used by Breakpeek unit tests. */

interface SnapshotStore<Value> {
  getSnapshot(): Value
  subscribe(listener: () => void): () => void
  set(value: Value): void
}

/**
 * Create the observable store used by the settings controller.
 * @param initial - first published value.
 * @returns a synchronous store matching the Harness client contract used here.
 */
export function createSnapshotStore<Value>(initial: Value): SnapshotStore<Value> {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => value,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set: (next) => {
      value = next
      for (const listener of listeners) listener()
    },
  }
}
