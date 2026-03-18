import type { CapabilityPoolQueueItem } from "./pool-types.js";

function compareQueueItems(left: CapabilityPoolQueueItem, right: CapabilityPoolQueueItem): number {
  if (left.sortPriority !== right.sortPriority) {
    return left.sortPriority - right.sortPriority;
  }

  const createdAtDelta = new Date(left.enqueuedAt).getTime() - new Date(right.enqueuedAt).getTime();
  if (createdAtDelta !== 0) {
    return createdAtDelta;
  }

  return left.prepared.preparedId.localeCompare(right.prepared.preparedId, "en");
}

export class CapabilityPoolQueue {
  readonly #items: CapabilityPoolQueueItem[] = [];

  enqueue(item: CapabilityPoolQueueItem): CapabilityPoolQueueItem {
    this.#items.push(item);
    this.#items.sort(compareQueueItems);
    return item;
  }

  dequeue(): CapabilityPoolQueueItem | undefined {
    return this.#items.shift();
  }

  size(): number {
    return this.#items.length;
  }

  list(): readonly CapabilityPoolQueueItem[] {
    return this.#items;
  }
}

