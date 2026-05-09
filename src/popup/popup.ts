import { getHost } from '../utils.ts';

const STALE_TAB_HOURS = 24;
const HOUR_IN_MS = 60 * 60 * 1000;
const POPUP_CLOSE_DELAY_MS = 1500;

document.addEventListener('DOMContentLoaded', function () {
  // Group tabs button
  document.getElementById('groupTabs')?.addEventListener('click', function () {
    chrome.tabs.query({ currentWindow: true }, function (tabs) {
      groupTabsByHost(tabs);
    });
  });

  // Ungroup tabs button
  document.getElementById('ungroupTabs')?.addEventListener('click', function () {
    chrome.tabs.query({ currentWindow: true }, function (tabs) {
      ungroupAllTabs(tabs);
    });
  });

  // Save & Close Tabs button
  document.getElementById('saveCloseTabs')?.addEventListener('click', function () {
    chrome.tabs.query({ currentWindow: true }, function (tabs) {
      saveAndCloseTabs(tabs);
    });
  });

  // Save & Close Stale Tabs button
  document.getElementById('saveCloseStaleTabs')?.addEventListener('click', function () {
    chrome.tabs.query({ currentWindow: true }, function (tabs) {
      saveAndCloseStaleTabs(tabs);
    });
  });

  // View Saved Tabs button
  document.getElementById('viewSavedTabs')?.addEventListener('click', function () {
    chrome.tabs.create({ url: chrome.runtime.getURL('saved-tabs.html') });
  });
});

// Interface for organizing tabs by host
interface HostGroups {
  [host: string]: number[];
}

// Interface for saved tab data
interface SavedTab {
  title: string;
  url: string;
  favicon: string;
  date: number; // timestamp
  groupId: string; // unique identifier for the group
}

type GroupColor = NonNullable<chrome.tabGroups.UpdateProperties['color']>;
type TabIdSelection = NonNullable<chrome.tabs.GroupOptions['tabIds']>;

function toTabIdSelection(tabIds: number[]): TabIdSelection | null {
  const [first, ...rest] = tabIds;

  if (first === undefined) {
    return null;
  }

  return rest.length === 0 ? first : [first, ...rest];
}

function updateStatus(message: string): void {
  const statusElement = document.getElementById('status');

  if (statusElement) {
    statusElement.textContent = message;
  }
}

function closePopupAfterDelay(): void {
  setTimeout(() => {
    window.close();
  }, POPUP_CLOSE_DELAY_MS);
}

function finishPopupAction(message: string): void {
  updateStatus(message);
  closePopupAfterDelay();
}

function isSavedTabsPage(url: string): boolean {
  return url.includes('saved-tabs.html');
}

function isSaveableTab(tab: chrome.tabs.Tab): tab is chrome.tabs.Tab & { url: string } {
  return (
    !!tab.url &&
    !tab.url.startsWith('chrome://') &&
    !tab.url.startsWith('chrome-extension://') &&
    !isSavedTabsPage(tab.url)
  );
}

function isClosableInFullSave(tab: chrome.tabs.Tab): tab is chrome.tabs.Tab & { url: string } {
  return !!tab.url && !tab.url.startsWith('chrome-extension://') && !isSavedTabsPage(tab.url);
}

function createSavedTabs(tabs: chrome.tabs.Tab[]): SavedTab[] {
  const savedAt = Date.now();
  const groupId = savedAt.toString();

  return tabs.filter(isSaveableTab).map(tab => ({
    title: tab.title || '',
    url: tab.url,
    favicon: tab.favIconUrl || '',
    date: savedAt,
    groupId,
  }));
}

function appendSavedTabs(savedTabs: SavedTab[], callback: () => void): void {
  chrome.storage.local.get<{ savedTabs: SavedTab[] }>({ savedTabs: [] }, function (result) {
    const existingTabs = result.savedTabs;
    const allTabs = [...existingTabs, ...savedTabs];

    chrome.storage.local.set({ savedTabs: allTabs }, callback);
  });
}

function getTabIds(tabs: chrome.tabs.Tab[]): number[] {
  return tabs.map(tab => tab.id).filter((id): id is number => id !== undefined);
}

function openSavedTabsPage(): void {
  chrome.tabs.create({ url: chrome.runtime.getURL('saved-tabs.html') });
}

function removeTabs(tabIds: number[]): void {
  if (tabIds.length > 0) {
    chrome.tabs.remove(tabIds);
  }
}

function completeSaveAndClose(
  tabsToSave: chrome.tabs.Tab[],
  tabIdsToClose: number[],
  successMessage: string
): void {
  const savedTabs = createSavedTabs(tabsToSave);

  appendSavedTabs(savedTabs, function () {
    updateStatus(successMessage);
    openSavedTabsPage();
    removeTabs(tabIdsToClose);
  });
}

function getStaleTabsToSaveAndClose(
  tabs: chrome.tabs.Tab[],
  cutoffTimestamp: number
): Array<chrome.tabs.Tab & { url: string; lastAccessed: number }> {
  return tabs.filter((tab): tab is chrome.tabs.Tab & { url: string; lastAccessed: number } => {
    return (
      isSaveableTab(tab) &&
      !tab.pinned &&
      typeof tab.lastAccessed === 'number' &&
      tab.lastAccessed < cutoffTimestamp
    );
  });
}

// Function to group tabs by host
function groupTabsByHost(tabs: chrome.tabs.Tab[]): void {
  const statusElement = document.getElementById('status');
  updateStatus('Grouping tabs...');

  // Create a map of hosts to tab IDs
  const hostGroups: HostGroups = {};
  tabs.forEach(tab => {
    if (tab.url && tab.id !== undefined) {
      const host = getHost(tab.url);
      if (!hostGroups[host]) {
        hostGroups[host] = [];
      }
      hostGroups[host].push(tab.id);
    }
  });

  // Generate some colors for the groups
  const colors: GroupColor[] = [
    'grey',
    'blue',
    'red',
    'yellow',
    'green',
    'pink',
    'purple',
    'cyan',
    'orange',
  ];

  // Create tab groups based on hosts
  let colorIndex = 0;
  let groupCount = 0;

  // Process each host group
  Object.keys(hostGroups).forEach(host => {
    const tabIds = hostGroups[host];
    const groupedTabIds = toTabIdSelection(tabIds);

    if (!groupedTabIds) {
      return;
    }

    chrome.tabs.group({ tabIds: groupedTabIds }, function (groupId) {
      chrome.tabGroups.update(groupId, {
        title: host,
        color: colors[colorIndex % colors.length],
      });
      colorIndex++;
      groupCount++;
      if (groupCount === Object.keys(hostGroups).length && statusElement) {
        finishPopupAction('Tabs grouped successfully!');
      }
    });
  });
}

// Function to ungroup all tabs
function ungroupAllTabs(tabs: chrome.tabs.Tab[]): void {
  const statusElement = document.getElementById('status');
  updateStatus('Ungrouping tabs...');

  const tabIds = tabs.map(tab => tab.id).filter((id): id is number => id !== undefined);
  const ungroupedTabIds = toTabIdSelection(tabIds);

  if (!ungroupedTabIds) {
    if (statusElement) {
      finishPopupAction('Tabs ungrouped!');
    }
    return;
  }

  chrome.tabs.ungroup(ungroupedTabIds, function () {
    if (statusElement) {
      finishPopupAction('Tabs ungrouped!');
    }
  });
}

// Function to save and close all tabs
function saveAndCloseTabs(tabs: chrome.tabs.Tab[]): void {
  updateStatus('Saving and closing tabs...');

  completeSaveAndClose(
    tabs,
    getTabIds(tabs.filter(isClosableInFullSave)),
    'Tabs saved! Closing...'
  );
}

function saveAndCloseStaleTabs(tabs: chrome.tabs.Tab[]): void {
  updateStatus(`Saving and closing tabs older than ${STALE_TAB_HOURS} hours...`);

  const cutoffTimestamp = Date.now() - STALE_TAB_HOURS * HOUR_IN_MS;
  const staleTabs = getStaleTabsToSaveAndClose(tabs, cutoffTimestamp);

  if (staleTabs.length === 0) {
    finishPopupAction(`No tabs older than ${STALE_TAB_HOURS} hours to save and close.`);
    return;
  }

  completeSaveAndClose(staleTabs, getTabIds(staleTabs), 'Stale tabs saved! Closing...');
}
