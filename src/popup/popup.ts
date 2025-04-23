import {getHost} from "../utils.ts";

document.addEventListener('DOMContentLoaded', function() {
  // Group tabs button
  document.getElementById('groupTabs')?.addEventListener('click', function() {
    chrome.tabs.query({ currentWindow: true }, function(tabs) {
      groupTabsByHost(tabs);
    });
  });

  // Ungroup tabs button
  document.getElementById('ungroupTabs')?.addEventListener('click', function() {
    chrome.tabs.query({ currentWindow: true }, function(tabs) {
      ungroupAllTabs(tabs);
    });
  });

  // Save & Close Tabs button
  document.getElementById('saveCloseTabs')?.addEventListener('click', function() {
    chrome.tabs.query({ currentWindow: true }, function(tabs) {
      saveAndCloseTabs(tabs);
    });
  });

  // View Saved Tabs button
  document.getElementById('viewSavedTabs')?.addEventListener('click', function() {
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

// Function to group tabs by host
function groupTabsByHost(tabs: chrome.tabs.Tab[]): void {
  const statusElement = document.getElementById('status');
  if (statusElement) {
    statusElement.textContent = 'Grouping tabs...';
  }

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
  const colors: chrome.tabGroups.ColorEnum[] = [
    'grey', 'blue', 'red', 'yellow', 'green',
    'pink', 'purple', 'cyan', 'orange'
  ];

  // Create tab groups based on hosts
  let colorIndex = 0;
  let groupCount = 0;

  // Process each host group
  Object.keys(hostGroups).forEach(host => {
    const tabIds = hostGroups[host];
    if (tabIds.length > 0) {
      chrome.tabs.group({ tabIds }, function(groupId) {
        chrome.tabGroups.update(groupId, {
          title: host,
          color: colors[colorIndex % colors.length]
        });
        colorIndex++;
        groupCount++;
        if (groupCount === Object.keys(hostGroups).length && statusElement) {
          statusElement.textContent = 'Tabs grouped successfully!';
          setTimeout(() => { window.close(); }, 1500);
        }
      });
    }
  });
}

// Function to ungroup all tabs
function ungroupAllTabs(tabs: chrome.tabs.Tab[]): void {
  const statusElement = document.getElementById('status');
  if (statusElement) {
    statusElement.textContent = 'Ungrouping tabs...';
  }

  const tabIds = tabs.map(tab => tab.id).filter((id): id is number => id !== undefined);
  chrome.tabs.ungroup(tabIds, function() {
    if (statusElement) {
      statusElement.textContent = 'Tabs ungrouped!';
      setTimeout(() => { window.close(); }, 1500);
    }
  });
}

// Function to save and close all tabs
function saveAndCloseTabs(tabs: chrome.tabs.Tab[]): void {
  const statusElement = document.getElementById('status');
  if (statusElement) {
    statusElement.textContent = 'Saving and closing tabs...';
  }

  // Generate a unique identifier for this group of tabs
  const groupId = Date.now().toString();

  // Extract tab information - filter out chrome:// and extension pages
  const savedTabs: SavedTab[] = tabs
    .filter(tab => {
      return tab.url &&
        !tab.url.startsWith('chrome://') &&
        !tab.url.startsWith('chrome-extension://') &&
        !tab.url.includes('saved-tabs.html'); // Don't save our own page
    })
    .map(tab => ({
      title: tab.title || '',
      url: tab.url || '',
      favicon: tab.favIconUrl || '',
      date: Date.now(),
      groupId: groupId
    }));

  // Save tabs to storage
  chrome.storage.local.get({ savedTabs: [] }, function(result) {
    const existingTabs: SavedTab[] = result.savedTabs;
    const allTabs = [...existingTabs, ...savedTabs];

    chrome.storage.local.set({ savedTabs: allTabs }, function() {
      if (statusElement) {
        statusElement.textContent = 'Tabs saved! Closing...';
      }

      // Close all tabs except the extension popup
      const tabIds = tabs
        .filter(tab => {
          return tab.url &&
            !tab.url.startsWith('chrome-extension://') &&
            !tab.url.includes('saved-tabs.html'); // Don't close our own page
        })
        .map(tab => tab.id)
        .filter((id): id is number => id !== undefined);

      // Open the saved tabs page
      chrome.tabs.create({ url: chrome.runtime.getURL('saved-tabs.html') });
      chrome.tabs.remove(tabIds);
    });
  });
}
