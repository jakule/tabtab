/**
 * Type definitions for tab-related data structures
 */

/**
 * Represents a saved tab in the extension
 */
export interface SavedTab {
  /**
   * The title of the tab
   */
  title: string;

  /**
   * The URL of the tab
   */
  url: string;

  /**
   * The URL of the tab's favicon
   */
  favicon: string;

  /**
   * Timestamp when the tab was saved
   */
  date: number;

  /**
   * Unique identifier for the group this tab belongs to
   * Optional for backward compatibility with older saved tabs
   */
  groupId?: string;
}

/**
 * Represents tabs grouped by a key (usually groupId)
 */
export interface GroupedTabs {
  [groupKey: string]: SavedTab[];
}

/**
 * Represents a count of tabs by domain
 */
export interface DomainCount {
  [domain: string]: number;
}
