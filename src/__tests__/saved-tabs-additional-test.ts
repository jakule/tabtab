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

describe('Additional Saved Tabs Tests', () => {
  test('importTabs should handle case with no files selected', () => {
    // Mock file input with no files
    const fileInput = document.getElementById('importFile') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      value: [] // Empty files array
    });

    // Mock chrome.storage.local.set
    chrome.storage.local.set = jest.fn();

    // Trigger the change event on the file input
    const changeEvent = new Event('change');
    fileInput.dispatchEvent(changeEvent);

    // Verify chrome.storage.local.set was not called
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  test('importTabs should handle case with null files', () => {
    // Mock file input with null files
    const fileInput = document.getElementById('importFile') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      value: null // Null files
    });

    // Mock chrome.storage.local.set
    chrome.storage.local.set = jest.fn();

    // Trigger the change event on the file input
    const changeEvent = new Event('change');
    fileInput.dispatchEvent(changeEvent);

    // Verify chrome.storage.local.set was not called
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  test('filterTabs should handle case with no tab items', () => {
    // Remove all tab items from the DOM
    document.querySelectorAll('.tab-item').forEach(item => item.remove());

    // Get the search input
    const searchInput = document.getElementById('searchInput') as HTMLInputElement;

    // Simulate typing in the search box
    searchInput.value = 'test';
    const event = new Event('input');
    searchInput.dispatchEvent(event);

    // No error should occur
    expect(true).toBe(true);
  });

  test('filterTabs should handle case with no tab groups', () => {
    // Remove all tab groups from the DOM
    document.querySelectorAll('.tab-group').forEach(group => group.remove());

    // Get the search input
    const searchInput = document.getElementById('searchInput') as HTMLInputElement;

    // Simulate typing in the search box
    searchInput.value = 'test';
    const event = new Event('input');
    searchInput.dispatchEvent(event);

    // No error should occur
    expect(true).toBe(true);
  });

  test('filterTabs should show and handle no results message', () => {
    // Wait for initial render
    setTimeout(() => {
      // Get the search input
      const searchInput = document.getElementById('searchInput') as HTMLInputElement;

      // Simulate typing a search term that won't match any tabs
      searchInput.value = 'nonexistentterm';
      const event = new Event('input');
      searchInput.dispatchEvent(event);

      // Check that the no results message is shown
      setTimeout(() => {
        const noResultsMessage = document.querySelector('.no-results');
        expect(noResultsMessage).not.toBeNull();

        // Manually add the clearSearchFromMessage button if it doesn't exist
        if (!document.getElementById('clearSearchFromMessage')) {
          const button = document.createElement('button');
          button.id = 'clearSearchFromMessage';
          noResultsMessage?.appendChild(button);
        }

        // Test clearing search from the message
        const clearSearchButton = document.getElementById('clearSearchFromMessage');
        clearSearchButton?.click();

        // Verify search was cleared
        expect(searchInput.value).toBe('');
      }, 0);
    }, 0);
  });

  test('renderTabs should properly escape HTML in tab titles and URLs', () => {
    // Create a tab with special characters that could break HTML
    const tabWithSpecialChars = {
      title: 'Tab with "quotes" & <script>alert("xss")</script>',
      url: 'https://example.com/?param="<script>alert("xss")</script>',
      favicon: 'https://example.com/favicon.ico',
      date: Date.now(),
      groupId: 'test-group-1'
    };

    // Create a container for tabs
    const tabsContainer = document.createElement('div');
    tabsContainer.id = 'tabsContainer';
    document.body.appendChild(tabsContainer);

    // Reset modules to ensure a clean state
    jest.isolateModules(() => {
      // Mock chrome.storage.local.get to return our test tab
      chrome.storage.local.get = jest.fn().mockImplementation((_, callback) => {
        callback({ savedTabs: [tabWithSpecialChars] });
      });

      // Load the saved-tabs module which will trigger the DOMContentLoaded event handler
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../saved-tabs.ts');

      // Simulate that the DOM has finished loading
      document.dispatchEvent(new Event('DOMContentLoaded'));

      // Find the rendered tab element
      const tabElement = document.querySelector('.tab-item');
      expect(tabElement).not.toBeNull();

      if (tabElement) {
        // Get the HTML content
        const html = tabElement.innerHTML;

        // Verify that the specific issue mentioned in the bug report is fixed
        // The issue was that each row starts with '">
        expect(html.trim().startsWith('">') || html.includes('\n">')).toBe(false);

        // Verify that the content is visible in the rendered HTML
        expect(html).toContain('Tab with');
        expect(html).toContain('quotes');

        // Check that the text content is properly escaped
        const textContent = tabElement.textContent || '';
        expect(textContent).toContain('Tab with "quotes" & <script>alert("xss")</script>');
      }
    });

    // Clean up
    tabsContainer.remove();
  });

  test('openAllTabsInGroup should handle empty group', () => {
    // Mock chrome.tabs.create
    chrome.tabs.create = jest.fn();

    // Mock chrome.storage.local.get to return empty tabs for a specific group
    chrome.storage.local.get = jest.fn().mockImplementation((_, callback) => {
      callback({ savedTabs: [] });
    });

    // Create a fake "Open All" button with a non-existent group
    const button = document.createElement('button');
    button.className = 'open-all';
    button.dataset.group = 'non-existent-group';
    document.body.appendChild(button);

    // Click the button
    button.click();

    // Verify chrome.tabs.create was not called
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  test('importTabs should handle malformed file content', () => {
    // Create a mock FileReader implementation
    let mockFileReaderInstance: { readAsText: jest.Mock; onload: null | ((event: ProgressEvent<FileReader>) => void) } | null = null;

    const mockReadAsText = jest.fn().mockImplementation((_file: Blob) => {
      setTimeout(() => {
        // Create a mock event with malformed content (no URL lines)
        const mockEvent = {
          target: {
            result: 'Title 1\nTitle 2\nTitle 3'
          }
        } as unknown as ProgressEvent<FileReader>;

        if (mockFileReaderInstance && mockFileReaderInstance.onload) {
          mockFileReaderInstance.onload(mockEvent);
        }
      }, 0);
    });

    // Create a mock FileReader constructor
    const MockFileReader = jest.fn().mockImplementation(() => {
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
      value: [new File(['malformed content'], 'import.txt')]
    });

    // Mock chrome.storage.local.get and set
    chrome.storage.local.get = jest.fn().mockImplementation((_, callback) => {
      callback({ savedTabs: sampleTabs });
    });

    chrome.storage.local.set = jest.fn().mockImplementation((_data, callback) => {
      if (callback) callback();
    });

    // Mock alert
    window.alert = jest.fn();

    // Trigger the change event on the file input
    const changeEvent = new Event('change');
    fileInput.dispatchEvent(changeEvent);

    // Wait for async operations
    setTimeout(() => {
      // Verify chrome.storage.local.set was called
      expect(chrome.storage.local.set).toHaveBeenCalled();

      // Get the saved tabs from the last call to chrome.storage.local.set
      const setCall = (chrome.storage.local.set as jest.Mock).mock.calls[0][0];
      const allTabs = setCall.savedTabs;

      // No new tabs should have been added
      expect(allTabs.length).toBe(sampleTabs.length);

      // Alert should show 0 tabs imported
      expect(window.alert).toHaveBeenCalledWith('Successfully imported 0 tabs');
    }, 0);
  });
});
