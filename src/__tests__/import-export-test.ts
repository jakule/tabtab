/**
 * @jest-environment jsdom
 */
import '../test/test-setup.ts';
import { SavedTab } from '../types/tab-types';

// Mock the utils import
jest.mock('../utils.ts', () => ({
  getHost: jest.fn(url => {
    try {
      return new URL(url).hostname;
    } catch {
      return 'other';
    }
  }),
}));

// Sample test data with two groups
const sampleTabs = [
  {
    title: 'Group 1 Tab 1',
    url: 'https://example.com/group1/tab1',
    favicon: 'https://example.com/favicon.ico',
    date: Date.now() - 86400000, // yesterday
    groupId: 'group1',
  },
  {
    title: 'Group 1 Tab 2',
    url: 'https://example.com/group1/tab2',
    favicon: 'https://example.com/favicon.ico',
    date: Date.now() - 86400000, // yesterday
    groupId: 'group1',
  },
  {
    title: 'Group 2 Tab 1',
    url: 'https://example.com/group2/tab1',
    favicon: 'https://example.com/favicon.ico',
    date: Date.now(),
    groupId: 'group2',
  },
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

describe('Import/Export Sum Behavior', () => {
  test('importTabs should not create duplicates when importing tabs that already exist', () => {
    // Create a mock FileReader implementation
    let mockFileReaderInstance: {
      readAsText: jest.Mock;
      onload: null | ((event: ProgressEvent<FileReader>) => void);
    } | null = null;

    // Create a mock file content that simulates an exported file with tabs that already exist
    const mockFileContent = `TabTab Exported Tabs
=====================

== Group 1 (2 tabs) ==

Group 1 Tab 1
https://example.com/group1/tab1

Group 1 Tab 2
https://example.com/group1/tab2

== Group 2 (1 tab) ==

Group 2 Tab 1
https://example.com/group2/tab1

`;

    const mockReadAsText = jest.fn().mockImplementation((_file: Blob) => {
      setTimeout(() => {
        const mockEvent = {
          target: {
            result: mockFileContent,
          },
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
        onload: null,
      };
      return mockFileReaderInstance;
    });

    // Replace the global FileReader with our mock
    window.FileReader = MockFileReader as unknown as typeof FileReader;

    // Mock file input
    const fileInput = document.getElementById('importFile') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      value: [new File([mockFileContent], 'export.txt')],
    });

    // Mock chrome.storage.local.set
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

      // No new tabs should have been added since all imported tabs already exist
      expect(allTabs.length).toBe(sampleTabs.length);

      // Alert should show 0 tabs imported
      expect(window.alert).toHaveBeenCalledWith('Successfully imported 0 tabs in 0 groups');
    }, 0);
  });

  test('importTabs should add only new tabs when importing a mix of existing and new tabs', () => {
    // Create a mock FileReader implementation
    let mockFileReaderInstance: {
      readAsText: jest.Mock;
      onload: null | ((event: ProgressEvent<FileReader>) => void);
    } | null = null;

    // Create a mock file content that simulates an exported file with a mix of existing and new tabs
    const mockFileContent = `TabTab Exported Tabs
=====================

== Group 1 (3 tabs) ==

Group 1 Tab 1
https://example.com/group1/tab1

Group 1 Tab 2
https://example.com/group1/tab2

Group 1 Tab 3 (New)
https://example.com/group1/tab3

== Group 2 (2 tabs) ==

Group 2 Tab 1
https://example.com/group2/tab1

Group 2 Tab 2 (New)
https://example.com/group2/tab2

== Group 3 (1 tab) ==

Group 3 Tab 1 (New)
https://example.com/group3/tab1

`;

    const mockReadAsText = jest.fn().mockImplementation((_file: Blob) => {
      setTimeout(() => {
        const mockEvent = {
          target: {
            result: mockFileContent,
          },
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
        onload: null,
      };
      return mockFileReaderInstance;
    });

    // Replace the global FileReader with our mock
    window.FileReader = MockFileReader as unknown as typeof FileReader;

    // Mock file input
    const fileInput = document.getElementById('importFile') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      value: [new File([mockFileContent], 'export.txt')],
    });

    // Mock chrome.storage.local.set
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

      // 3 new tabs should have been added
      expect(allTabs.length).toBe(sampleTabs.length + 3);

      // Verify the new tabs were added
      const urls = allTabs.map((tab: SavedTab) => tab.url);
      expect(urls).toContain('https://example.com/group1/tab3');
      expect(urls).toContain('https://example.com/group2/tab2');
      expect(urls).toContain('https://example.com/group3/tab1');

      // Alert should show 3 tabs imported
      expect(window.alert).toHaveBeenCalledWith(
        expect.stringContaining('Successfully imported 3 tabs')
      );
    }, 0);
  });
});
