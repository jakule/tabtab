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
    date: Date.now() - 86400000 // yesterday
  },
  {
    title: 'Example Page 2',
    url: 'https://example.com/page2',
    favicon: '',
    date: Date.now()
  },
  {
    title: 'Another Site',
    url: 'https://another.com',
    favicon: 'https://another.com/favicon.ico',
    date: Date.now()
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

  // Reset other mocks
  jest.clearAllMocks();
});

// Import the saved-tabs module to test
// This needs to be after the DOM setup to work correctly
import '../saved-tabs.ts';

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
    document.createElement = jest.fn().mockImplementation((tag) => {
      if (tag === 'a') {
        return mockAnchor as unknown as HTMLElement;
      }
      return document.createElement(tag);
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
});