/* eslint-disable @typescript-eslint/no-namespace */
declare namespace chrome.storage {
  interface StorageChange {
    oldValue?: unknown;
    newValue?: unknown;
  }

  interface StorageChanges {
    [key: string]: StorageChange;
  }

  interface StorageArea {
    get(
      keys?: string | string[] | Record<string, unknown> | null,
      callback?: (items: Record<string, unknown>) => void
    ): void;

    getBytesInUse(
      keys: string | string[] | null,
      callback?: (bytesInUse: number) => void
    ): void;

    set(
      items: Record<string, unknown>,
      callback?: () => void
    ): void;

    remove(
      keys: string | string[],
      callback?: () => void
    ): void;

    clear(callback?: () => void): void;
  }

  interface StorageAreaSync extends StorageArea {
    MAX_ITEMS: number;
    MAX_WRITE_OPERATIONS_PER_HOUR: number;
    MAX_WRITE_OPERATIONS_PER_MINUTE: number;
    QUOTA_BYTES: number;
    QUOTA_BYTES_PER_ITEM: number;
  }

  interface StorageAreaLocal extends StorageArea {
    QUOTA_BYTES: number;
  }

  interface StorageAreaSession extends StorageArea {
    QUOTA_BYTES: number;
  }

  interface Static {
    local: StorageAreaLocal;
    sync: StorageAreaSync;
    session: StorageAreaSession;
    onChanged: chrome.events.Event<
      (changes: StorageChanges, areaName: string) => void
    >;
    managed: StorageArea;
  }
}
