import { getHost } from './utils.ts';

// Helper function to escape HTML attributes
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Define interfaces for our data structures
interface SavedTab {
  title: string;
  url: string;
  favicon: string;
  date: number; // timestamp
  groupId?: string; // unique identifier for the group (optional for backward compatibility)
}

interface GroupedTabs {
  [groupKey: string]: SavedTab[];
}

interface DomainCount {
  [domain: string]: number;
}

document.addEventListener('DOMContentLoaded', function () {
  loadSavedTabs();

  // Search functionality
  const searchInput = document.getElementById('searchInput') as HTMLInputElement;
  searchInput.addEventListener('input', function () {
    filterTabs(searchInput.value);
  });

  // Clear search
  document.getElementById('clearSearch')?.addEventListener('click', function () {
    searchInput.value = '';
    filterTabs('');
  });

  // Export tabs
  document.getElementById('exportTabs')?.addEventListener('click', exportTabs);

  // Import tabs
  document.getElementById('importTabs')?.addEventListener('click', function () {
    const importFileElement = document.getElementById('importFile');
    if (importFileElement) {
      importFileElement.click();
    }
  });

  // Handle file selection
  document.getElementById('importFile')?.addEventListener('change', importTabs as EventListener);
});

// Function to load saved tabs
function loadSavedTabs(): void {
  chrome.storage.local.get({ savedTabs: [] }, function (result: { savedTabs: SavedTab[] }) {
    const savedTabs = result.savedTabs;
    updateStats(savedTabs);
    renderTabs(savedTabs);
  });
}

// Function to update stats
function updateStats(tabs: SavedTab[]): void {
  const statsElement = document.getElementById('stats');
  if (!statsElement) return;

  const totalTabs = tabs.length;

  // Count domains
  const domains: DomainCount = {};
  tabs.forEach(tab => {
    const host = getHost(tab.url);
    domains[host] = (domains[host] || 0) + 1;
  });

  const domainCount = Object.keys(domains).length;

  // Create the stats HTML
  let statsHtml = `<strong>${totalTabs}</strong> tabs saved across <strong>${domainCount}</strong> domains`;

  // Add top domains (limit to 10)
  if (domainCount > 0) {
    statsHtml += '<div class="domain-count">';

    // Sort domains by count (descending)
    const sortedDomains = Object.entries(domains)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    sortedDomains.forEach(([domain, count]) => {
      statsHtml += `<span class="domain-badge">${escapeHtml(domain)}: ${count}</span>`;
    });

    statsHtml += '</div>';
  }

  statsElement.innerHTML = statsHtml;
}

// Function to render tabs
function renderTabs(tabs: SavedTab[]): void {
  const tabsContainer = document.getElementById('tabsContainer');
  if (!tabsContainer) return;

  tabsContainer.innerHTML = '';

  if (tabs.length === 0) {
    tabsContainer.innerHTML = `
      <div class="no-tabs">
        <p>No saved tabs yet.</p>
        <p>Use the "Save & Close All Tabs" button in the extension popup to save your tabs.</p>
      </div>
    `;
    return;
  }

  // Group tabs by groupId or date (for backward compatibility)
  const groupedTabs: GroupedTabs = {};
  tabs.forEach(tab => {
    let groupKey: string;

    if (tab.groupId) {
      // Use groupId if available
      groupKey = tab.groupId;
    } else {
      // Fallback to date for backward compatibility
      const date = new Date(tab.date);
      groupKey = `date-${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    }

    if (!groupedTabs[groupKey]) {
      groupedTabs[groupKey] = [];
    }
    groupedTabs[groupKey].push(tab);
  });

  // Sort groups in descending order by date (newest first)
  const sortedGroups = Object.keys(groupedTabs).sort((a, b) => {
    // Get the newest date from each group
    const maxDateA = Math.max(...groupedTabs[a].map(tab => tab.date));
    const maxDateB = Math.max(...groupedTabs[b].map(tab => tab.date));
    return maxDateB - maxDateA;
  });

  // Render each group
  sortedGroups.forEach(groupKey => {
    // Get the newest date from the group for display
    const newestDate = Math.max(...groupedTabs[groupKey].map(tab => tab.date));
    const dateObj = new Date(newestDate);
    const formattedDate = dateObj.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const groupElement = document.createElement('div');
    groupElement.className = 'tab-group';
    groupElement.dataset.group = groupKey;

    const groupHeader = document.createElement('div');
    groupHeader.className = 'group-header';
    groupHeader.innerHTML = `
      <span>${escapeHtml(formattedDate)} (${groupedTabs[groupKey].length} tabs)</span>
      <div class="button-group">
        <button class="open-all" data-group="${escapeHtml(groupKey)}">Open All</button>
        <button class="remove-all" data-group="${escapeHtml(groupKey)}">Remove All</button>
      </div>
    `;

    const tabsList = document.createElement('div');
    tabsList.className = 'tabs-list';

    // Sort tabs by domain for better organization
    const sortedTabs = [...groupedTabs[groupKey]].sort((a, b) => {
      const hostA = getHost(a.url);
      const hostB = getHost(b.url);
      return hostA.localeCompare(hostB);
    });

    sortedTabs.forEach(tab => {
      const tabElement = document.createElement('div');
      tabElement.className = 'tab-item';
      tabElement.dataset.url = escapeHtml(tab.url);
      tabElement.dataset.title = escapeHtml(tab.title || '');

      // Use a default favicon if none is available
      const defaultFavicon =
        'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="%23ddd"/></svg>';
      const favicon = tab.favicon || defaultFavicon;

      // Create elements using DOM methods instead of innerHTML
      // Favicon image
      const faviconImg = document.createElement('img');
      faviconImg.className = 'tab-favicon';
      faviconImg.src = favicon;
      faviconImg.alt = '';
      faviconImg.onerror = function (): void {
        this.src = defaultFavicon;
      };

      // Tab title
      const titleDiv = document.createElement('div');
      titleDiv.className = 'tab-title';
      titleDiv.setAttribute('title', escapeHtml(tab.title || tab.url));
      titleDiv.textContent = tab.title || tab.url;

      // Tab actions
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'tab-actions';

      // Open button
      const openButton = document.createElement('button');
      openButton.className = 'open-tab';
      openButton.setAttribute('data-url', escapeHtml(tab.url));
      openButton.textContent = 'Open';

      // Remove button
      const removeButton = document.createElement('button');
      removeButton.className = 'remove-tab';
      removeButton.setAttribute('data-url', escapeHtml(tab.url));
      removeButton.textContent = 'Remove';

      // Append all elements
      actionsDiv.appendChild(openButton);
      actionsDiv.appendChild(removeButton);

      tabElement.appendChild(faviconImg);
      tabElement.appendChild(titleDiv);
      tabElement.appendChild(actionsDiv);

      tabsList.appendChild(tabElement);
    });

    groupElement.appendChild(groupHeader);
    groupElement.appendChild(tabsList);
    tabsContainer.appendChild(groupElement);
  });

  // Add event listeners for buttons
  addButtonEventListeners();
}

// Function to add event listeners to tab buttons
function addButtonEventListeners(): void {
  // Open tab button
  document.querySelectorAll('.open-tab').forEach(button => {
    button.addEventListener('click', function (this: HTMLButtonElement) {
      const url = this.dataset.url;
      if (url) {
        chrome.tabs.create({ url });
      }
    });
  });

  // Remove tab button
  document.querySelectorAll('.remove-tab').forEach(button => {
    button.addEventListener('click', function (this: HTMLButtonElement) {
      const url = this.dataset.url;
      if (url) {
        removeTab(url);
      }
    });
  });

  // Open all tabs in group
  document.querySelectorAll('.open-all').forEach(button => {
    button.addEventListener('click', function (this: HTMLButtonElement) {
      const groupKey = this.dataset.group;
      if (groupKey) {
        openAllTabsInGroup(groupKey);
      }
    });
  });

  // Remove all tabs in group
  document.querySelectorAll('.remove-all').forEach(button => {
    button.addEventListener('click', function (this: HTMLButtonElement) {
      const groupKey = this.dataset.group;
      if (groupKey) {
        removeAllTabsInGroup(groupKey);
      }
    });
  });
}

// Function to filter tabs based on search query
function filterTabs(query: string): void {
  const normalizedQuery = query.toLowerCase();
  let visibleTabsCount = 0;

  document.querySelectorAll('.tab-item').forEach(tabElement => {
    const element = tabElement as HTMLElement;
    const title = element.dataset.title?.toLowerCase() || '';
    const url = element.dataset.url?.toLowerCase() || '';

    if (title.includes(normalizedQuery) || url.includes(normalizedQuery)) {
      element.style.display = '';
      visibleTabsCount++;
    } else {
      element.style.display = 'none';
    }
  });

  // Hide empty groups
  document.querySelectorAll('.tab-group').forEach(groupElement => {
    const element = groupElement as HTMLElement;
    const visibleTabs = element.querySelectorAll('.tab-item[style="display: none;"]').length;
    const totalTabs = element.querySelectorAll('.tab-item').length;

    if (visibleTabs === totalTabs) {
      element.style.display = 'none';
    } else {
      element.style.display = '';
    }
  });

  // Show no results message if needed
  if (visibleTabsCount === 0 && normalizedQuery !== '') {
    const tabsContainer = document.getElementById('tabsContainer');
    if (tabsContainer) {
      const existingMessage = document.querySelector('.no-results');
      if (!existingMessage) {
        tabsContainer.innerHTML += `
          <div class="no-tabs no-results">
            <p>No tabs match your search: "${escapeHtml(query)}"</p>
            <button id="clearSearchFromMessage">Clear Search</button>
          </div>
        `;

        document.getElementById('clearSearchFromMessage')?.addEventListener('click', function () {
          const searchInput = document.getElementById('searchInput') as HTMLInputElement;
          searchInput.value = '';
          filterTabs('');
        });
      }
    }
  } else {
    const existingMessage = document.querySelector('.no-results');
    if (existingMessage) {
      existingMessage.remove();
    }
  }
}

// Function to remove a tab
function removeTab(url: string): void {
  chrome.storage.local.get({ savedTabs: [] }, function (result: { savedTabs: SavedTab[] }) {
    const savedTabs = result.savedTabs;
    const updatedTabs = savedTabs.filter(tab => tab.url !== url);

    chrome.storage.local.set({ savedTabs: updatedTabs }, function () {
      loadSavedTabs();
    });
  });
}

// Function to open all tabs in a group
function openAllTabsInGroup(groupKey: string): void {
  chrome.storage.local.get({ savedTabs: [] }, function (result: { savedTabs: SavedTab[] }) {
    const savedTabs = result.savedTabs;
    const tabsToOpen: SavedTab[] = [];

    savedTabs.forEach(tab => {
      // Check if the tab belongs to the specified group
      if (tab.groupId === groupKey) {
        tabsToOpen.push(tab);
      } else if (!tab.groupId && groupKey.startsWith('date-')) {
        // For backward compatibility with tabs that don't have a groupId
        const date = new Date(tab.date);
        const tabDateKey = `date-${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;

        if (tabDateKey === groupKey) {
          tabsToOpen.push(tab);
        }
      }
    });

    // Open first tab active, the rest in background
    if (tabsToOpen.length > 0) {
      chrome.tabs.create({ url: tabsToOpen[0].url, active: true });

      // Open the rest in background
      for (let i = 1; i < tabsToOpen.length; i++) {
        chrome.tabs.create({ url: tabsToOpen[i].url, active: false });
      }
    }
  });
}

// Function to remove all tabs in a group
function removeAllTabsInGroup(groupKey: string): void {
  chrome.storage.local.get({ savedTabs: [] }, function (result: { savedTabs: SavedTab[] }) {
    const savedTabs = result.savedTabs;
    const updatedTabs = savedTabs.filter(tab => {
      // Keep tabs that don't belong to the specified group
      if (tab.groupId !== groupKey) {
        // For backward compatibility with tabs that don't have a groupId
        if (!tab.groupId && groupKey.startsWith('date-')) {
          const date = new Date(tab.date);
          const tabDateKey = `date-${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
          return tabDateKey !== groupKey;
        }
        return true;
      }
      return false;
    });

    chrome.storage.local.set({ savedTabs: updatedTabs }, function () {
      loadSavedTabs();
    });
  });
}

// Function to export tabs
function exportTabs(): void {
  chrome.storage.local.get({ savedTabs: [] }, function (result: { savedTabs: SavedTab[] }) {
    const savedTabs = result.savedTabs;

    // Create a text representation
    let text = 'TabTab Exported Tabs\n';
    text += '=====================\n\n';

    // Group tabs by groupId or date (for backward compatibility)
    const groupedTabs: GroupedTabs = {};
    savedTabs.forEach(tab => {
      let groupKey: string;

      if (tab.groupId) {
        // Use groupId if available
        groupKey = tab.groupId;
      } else {
        // Fallback to date for backward compatibility
        const date = new Date(tab.date);
        groupKey = `date-${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
      }

      if (!groupedTabs[groupKey]) {
        groupedTabs[groupKey] = [];
      }
      groupedTabs[groupKey].push(tab);
    });

    // Sort groups in descending order by date (newest first)
    const sortedGroups = Object.keys(groupedTabs).sort((a, b) => {
      // Get the newest date from each group
      const maxDateA = Math.max(...groupedTabs[a].map(tab => tab.date));
      const maxDateB = Math.max(...groupedTabs[b].map(tab => tab.date));
      return maxDateB - maxDateA;
    });

    // Add each group to the text
    sortedGroups.forEach(groupKey => {
      // Get the newest date from the group for display
      const newestDate = Math.max(...groupedTabs[groupKey].map(tab => tab.date));
      const dateObj = new Date(newestDate);
      const formattedDate = dateObj.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      text += `== ${formattedDate} (${groupedTabs[groupKey].length} tabs) ==\n\n`;

      // Sort tabs by domain
      const sortedTabs = [...groupedTabs[groupKey]].sort((a, b) => {
        const hostA = getHost(a.url);
        const hostB = getHost(b.url);
        return hostA.localeCompare(hostB);
      });

      sortedTabs.forEach(tab => {
        text += `${tab.title || 'Untitled'}\n${tab.url}\n\n`;
      });

      text += '\n';
    });

    // Create a download link
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tabtab-export-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();

    // Clean up
    URL.revokeObjectURL(url);
  });
}

// Function to import tabs
function importTabs(event: Event): void {
  const fileInput = event.target as HTMLInputElement;

  if (fileInput.files && fileInput.files.length > 0) {
    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function (e: ProgressEvent<FileReader>): void {
      const contents = e.target?.result as string;
      const lines = contents.split('\n');

      const importedTabs: SavedTab[] = [];
      const currentDate = Date.now();

      // Parse the file to identify groups and tabs
      let currentGroupId = '';
      let currentGroupDate = currentDate;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Check if this line is a group header
        if (line.startsWith('== ') && line.endsWith(' ==')) {
          // Extract date from the group header if possible
          const dateMatch = line.match(/== (.*?) \(\d+ tabs\) ==/);
          if (dateMatch && dateMatch[1]) {
            try {
              // Try to parse the date, fallback to current date if it fails
              const dateStr = dateMatch[1];
              const parsedDate = new Date(dateStr);
              currentGroupDate = isNaN(parsedDate.getTime()) ? currentDate : parsedDate.getTime();
            } catch {
              currentGroupDate = currentDate;
            }
          }

          // Generate a unique group ID based on the date
          currentGroupId = `import-group-${currentGroupDate}-${Math.floor(Math.random() * 10000)}`;
          continue;
        }

        // If we haven't found a group yet, create a default one
        if (!currentGroupId) {
          currentGroupId = `import-group-${currentDate}-${Math.floor(Math.random() * 10000)}`;
        }

        // Check if this line could be a title with a URL on the next line
        if (i < lines.length - 1) {
          const nextLine = lines[i + 1].trim();

          // Check if the next line is a URL
          if (nextLine.startsWith('http://') || nextLine.startsWith('https://')) {
            const title = line;
            const url = nextLine;

            // Generate favicon URL using Google's favicon service
            const urlObj = new URL(url);
            const domain = urlObj.hostname;
            const favicon = `https://www.google.com/s2/favicons?domain=${domain}`;

            importedTabs.push({
              title: title,
              url: url,
              favicon: favicon,
              date: currentGroupDate,
              groupId: currentGroupId,
            });

            // Skip the URL line
            i += 1;
          }
        }
      }

      // Add imported tabs to storage
      chrome.storage.local.get({ savedTabs: [] }, function (result: { savedTabs: SavedTab[] }) {
        const savedTabs = result.savedTabs;

        // Create a map of existing tabs by URL for quick lookup
        const existingTabsByUrl = new Map<string, SavedTab>();
        savedTabs.forEach(tab => {
          existingTabsByUrl.set(tab.url, tab);
        });

        // Filter out imported tabs that already exist in savedTabs
        const newImportedTabs = importedTabs.filter(
          importedTab => !existingTabsByUrl.has(importedTab.url)
        );

        // Combine existing tabs with new imported tabs
        const allTabs = [...savedTabs, ...newImportedTabs];

        chrome.storage.local.set({ savedTabs: allTabs }, function () {
          loadSavedTabs();
          alert(
            `Successfully imported ${newImportedTabs.length} tabs in ${new Set(newImportedTabs.map(tab => tab.groupId)).size} groups`
          );
        });
      });
    };

    reader.readAsText(file);

    // Reset the file input
    fileInput.value = '';
  }
}
