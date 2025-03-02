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
});

// Function to extract host from URL
function getHost(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return "other";
  }
}

// Interface for organizing tabs by host
interface HostGroups {
  [host: string]: number[];
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
