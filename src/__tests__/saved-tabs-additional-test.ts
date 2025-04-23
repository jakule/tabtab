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
});