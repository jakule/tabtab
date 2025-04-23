/**
 * @jest-environment jsdom
 */
import '../test/test-setup.ts';

// Mock the utils import
jest.mock('../utils.ts', () => ({
  getHost: jest.fn((url) => {
    try {
      return new URL(url).hostname;
    } catch {
      return 'other';
    }
  }),
}));

// Sample test data
const sampleTabs = [
  {
    title: 'Example Page 1',
    url: 'https://example.com/page1',
    favicon: 'https://example.com/favicon.ico',
    date: Date.now() - 86400000, // yesterday
    groupId: 'group1'
  },
  {
    title: 'Example Page 2',
    url: 'https://example.com/page2',
    favicon: '',
    date: Date.now(),
    groupId: 'group1'
  },
  {
    title: 'Another Site',
    url: 'https://another.com',
    favicon: 'https://another.com/favicon.ico',
    date: Date.now(),
    groupId: 'group2'
  },
  {
    title: 'Legacy Tab',
    url: 'https://legacy.com',
    favicon: 'https://legacy.com/favicon.ico',
    date: Date.now() - 172800000 // 2 days ago
    // No groupId to test backward compatibility
  }
];

// Setup test HTML
beforeEach(() => {
  document.body.innerHTML = `
    <div class="search-container">
      <input type="text" id="searchInput" placeholder="Search your saved tabs...">
      <button id="clearSearch">Clear</button>
    </div>
    <div id="stats" class="stats"></div>
    <div id="tabsContainer"></div>
    <button id="exportTabs">Export as Text</button>
    <button id="importTabs">Import from Text</button>
    <input type="file" id="importFile" accept=".txt">
  `;

  // Mock chrome.storage.local.get to return sample data
  chrome.storage.local.get = jest.fn().mockImplementation((_, callback) => {
    callback({ savedTabs: sampleTabs });
  });

  // Reset chrome API mocks
  jest.clearAllMocks();

  // Import the popup module after setting up the DOM
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../saved-tabs.ts');

    // Simulate that the DOM has finished loading inside the isolateModules block
    document.dispatchEvent(new Event('DOMContentLoaded'));
  });
});

describe('Saved Tabs', () => {
  test('should render tabs from storage on load', () => {
    // Verify chrome.storage.local.get was called
    expect(chrome.storage.local.get).toHaveBeenCalledWith(
      { savedTabs: [] },
      expect.any(Function)
    );

    // Wait for DOM updates
    setTimeout(() => {
      // Check if tabs container has content
      const tabsContainer = document.getElementById('tabsContainer');
      expect(tabsContainer?.innerHTML).not.toBe('');

      // Check if tab items were rendered
      const tabItems = document.querySelectorAll('.tab-item');
      expect(tabItems.length).toBe(sampleTabs.length);
    }, 0);
  });

  test('search functionality should filter tabs', () => {
    // Wait for initial render
    setTimeout(() => {
      // Get the search input
      const searchInput = document.getElementById('searchInput') as HTMLInputElement;

      // Simulate typing in the search box
      searchInput.value = 'Another';
      const event = new Event('input');
      searchInput.dispatchEvent(event);

      // Check filtering
      setTimeout(() => {
        const visibleTabs = Array.from(document.querySelectorAll('.tab-item'))
          .filter(el => (el as HTMLElement).style.display !== 'none');

        // Should only show the "Another Site" tab
        expect(visibleTabs.length).toBe(1);
      }, 0);
    }, 0);
  });

  test('clear search button should reset the search', () => {
    // Wait for initial render
    setTimeout(() => {
      // Set up a search first
      const searchInput = document.getElementById('searchInput') as HTMLInputElement;
      searchInput.value = 'example';
      searchInput.dispatchEvent(new Event('input'));

      // Then clear it
      const clearButton = document.getElementById('clearSearch');
      clearButton?.click();

      // Verify search was cleared
      expect(searchInput.value).toBe('');

      // All tabs should be visible again
      setTimeout(() => {
        const visibleTabs = Array.from(document.querySelectorAll('.tab-item'))
          .filter(el => (el as HTMLElement).style.display !== 'none');
        expect(visibleTabs.length).toBe(sampleTabs.length);
      }, 0);
    }, 0);
  });

  test('export tabs button should create a download link', () => {
    // Mock URL.createObjectURL and createElement.click
    const mockURL = 'blob:test';
    URL.createObjectURL = jest.fn().mockReturnValue(mockURL);

    const mockAnchor = {
      href: '',
      download: '',
      click: jest.fn()
    };
    // Store original createElement
    const originalCreateElement = document.createElement;
    document.createElement = jest.fn().mockImplementation((tag) => {
      if (tag === 'a') {
        return mockAnchor as unknown as HTMLElement;
      }
      return originalCreateElement.call(document, tag);
    });

    // Click export button
    const exportButton = document.getElementById('exportTabs');
    exportButton?.click();

    // Verify URL was created and link was clicked
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(mockAnchor.click).toHaveBeenCalled();
    expect(mockAnchor.download).toContain('tabtab-export-');

    // Verify URL was revoked
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockURL);
  });

  test('should group tabs by groupId', () => {
    // Wait for initial render
    setTimeout(() => {
      // Check if tab groups were created correctly
      const tabGroups = document.querySelectorAll('.tab-group');

      // We should have 3 groups: group1, group2, and a date-based group for the legacy tab
      expect(tabGroups.length).toBe(3);

      // Check if the first group (group1) has 2 tabs
      const group1 = document.querySelector('.tab-group[data-group="group1"]');
      const group1Tabs = group1?.querySelectorAll('.tab-item');
      expect(group1Tabs?.length).toBe(2);

      // Check if the second group (group2) has 1 tab
      const group2 = document.querySelector('.tab-group[data-group="group2"]');
      const group2Tabs = group2?.querySelectorAll('.tab-item');
      expect(group2Tabs?.length).toBe(1);

      // Check if there's a date-based group for the legacy tab
      const dateGroup = document.querySelector('.tab-group[data-group^="date-"]');
      expect(dateGroup).not.toBeNull();
      const dateGroupTabs = dateGroup?.querySelectorAll('.tab-item');
      expect(dateGroupTabs?.length).toBe(1);
    }, 0);
  });

  test('openAllTabsInGroup should open tabs with the specified groupId', () => {
    // Mock chrome.tabs.create
    chrome.tabs.create = jest.fn();

    // Wait for initial render
    setTimeout(() => {
      // Find and click the "Open All" button for group1
      const openAllButton = document.querySelector('.open-all[data-group="group1"]');
      openAllButton?.dispatchEvent(new Event('click'));

      // Verify chrome.tabs.create was called twice (once for each tab in group1)
      expect(chrome.tabs.create).toHaveBeenCalledTimes(2);

      // First tab should be active, second should not
      expect(chrome.tabs.create).toHaveBeenCalledWith({
        url: 'https://example.com/page1',
        active: true
      });
      expect(chrome.tabs.create).toHaveBeenCalledWith({
        url: 'https://example.com/page2',
        active: false
      });
    }, 0);
  });

  test('removeAllTabsInGroup should remove tabs with the specified groupId', () => {
    // Mock chrome.storage.local.set
    chrome.storage.local.set = jest.fn().mockImplementation((_data, callback) => {
      if (callback) callback();
    });

    // Wait for initial render
    setTimeout(() => {
      // Find and click the "Remove All" button for group2
      const removeAllButton = document.querySelector('.remove-all[data-group="group2"]');
      removeAllButton?.dispatchEvent(new Event('click'));

      // Verify chrome.storage.local.set was called with the updated tabs
      // (all tabs except the one in group2)
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        {
          savedTabs: expect.arrayContaining([
            expect.objectContaining({ groupId: 'group1' }),
            expect.not.objectContaining({ groupId: 'group2' })
          ])
        },
        expect.any(Function)
      );
    }, 0);
  });

  test('importTabs should assign a unique groupId to imported tabs', () => {
    // Create a mock FileReader implementation
    let mockFileReaderInstance: { readAsText: jest.Mock; onload: null | ((event: ProgressEvent<FileReader>) => void) } | null = null;

    const mockReadAsText = jest.fn().mockImplementation((_file: Blob) => {
      // Implementation will be handled by the mock
      setTimeout(() => {
        // Create a mock event with the necessary data
        const mockEvent = {
          target: {
            result: 'Title 1\nhttps://example.org/1\n\nTitle 2\nhttps://example.org/2'
          }
        } as unknown as ProgressEvent<FileReader>;

        // Call onload on the current instance
        if (mockFileReaderInstance && mockFileReaderInstance.onload) {
          mockFileReaderInstance.onload(mockEvent);
        }
      }, 0);
    });

    // Create a mock FileReader constructor
    const MockFileReader = jest.fn().mockImplementation(() => {
      // Create a new instance
      mockFileReaderInstance = {
        readAsText: mockReadAsText,
        onload: null
      };
      return mockFileReaderInstance;
    });

    // Replace the global FileReader with our mock
    window.FileReader = MockFileReader as unknown as typeof FileReader;

    // Mock file input
    const fileInput = document.getElementById('importFile') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      value: [new File(['Title 1\nhttps://example.org/1\n\nTitle 2\nhttps://example.org/2'], 'import.txt')]
    });

    // Mock chrome.storage.local.get and set
    chrome.storage.local.get = jest.fn().mockImplementation((_, callback) => {
      callback({ savedTabs: sampleTabs });
    });

    chrome.storage.local.set = jest.fn().mockImplementation((_data, callback) => {
      if (callback) callback();
    });

    // Directly trigger the change event on the file input
    const changeEvent = new Event('change');
    fileInput.dispatchEvent(changeEvent);

    // Wait for async operations
    setTimeout(() => {
      // Verify chrome.storage.local.set was called with tabs that have the same groupId
      expect(chrome.storage.local.set).toHaveBeenCalled();

      // Get the saved tabs from the last call to chrome.storage.local.set
      const setCall = (chrome.storage.local.set as jest.Mock).mock.calls[0][0];
      const allTabs = setCall.savedTabs;

      // The last two tabs should be the imported ones
      const importedTabs = allTabs.slice(-2);

      // Both imported tabs should have the same groupId starting with "import-"
      expect(importedTabs[0].groupId).toBeDefined();
      expect(importedTabs[0].groupId).toMatch(/^import-\d+$/);
      expect(importedTabs[1].groupId).toBe(importedTabs[0].groupId);
    }, 0);
  });
});
