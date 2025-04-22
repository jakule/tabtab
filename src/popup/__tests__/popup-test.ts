/**
 * @jest-environment jsdom
 */
import '../../test/test-setup.ts';

// Mock the utils import
jest.mock('../../utils.ts', () => ({
  getHost: jest.fn((url) => {
    try {
      return new URL(url).hostname;
    } catch {
      return 'other';
    }
  }),
}));

// Setup test HTML
beforeEach(() => {
  document.body.innerHTML = `
    <button id="groupTabs">Group Tabs by Domain</button>
    <button id="ungroupTabs">Ungroup All Tabs</button>
    <button id="saveCloseTabs">Save & Close All Tabs</button>
    <button id="viewSavedTabs">View Saved Tabs</button>
    <div id="status" class="status"></div>
  `;

  // Reset chrome API mocks
  jest.clearAllMocks();

  // Import the popup module after setting up the DOM
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../popup.ts');
  });

  // Simulate that the DOM has finished loading
  document.dispatchEvent(new Event('DOMContentLoaded'));

});

describe('Popup', () => {
  // Mock data for testing
  const mockTabs = [
    { id: 1, url: 'https://example.com/page1', title: 'Example 1' },
    { id: 2, url: 'https://example.com/page2', title: 'Example 2' },
    { id: 3, url: 'https://another.com/page', title: 'Another Site' },
  ] as chrome.tabs.Tab[];

  test('Group Tabs button should query tabs when clicked', () => {
    // Set up chrome.tabs.query to use our mock data
    chrome.tabs.query = jest.fn().mockImplementation((_, callback) => {
      callback(mockTabs);
    });

    // Simulate button click
    document.getElementById('groupTabs')?.click();

    // Verify that chrome.tabs.query was called
    expect(chrome.tabs.query).toHaveBeenCalledWith(
      { currentWindow: true },
      expect.any(Function)
    );
  });

  test('Ungroup Tabs button should query tabs when clicked', () => {
    // Set up chrome.tabs.query to use our mock data
    chrome.tabs.query = jest.fn().mockImplementation((_, callback) => {
      callback(mockTabs);
    });

    // Set up chrome.tabs.ungroup to succeed
    chrome.tabs.ungroup = jest.fn().mockImplementation((_, callback) => {
      if (callback) callback();
    });

    // Simulate button click
    document.getElementById('ungroupTabs')?.click();

    // Verify that chrome.tabs.query was called
    expect(chrome.tabs.query).toHaveBeenCalledWith(
      { currentWindow: true },
      expect.any(Function)
    );
  });

  test('Save & Close button should query tabs when clicked', () => {
    // Set up chrome.tabs.query to use our mock data
    chrome.tabs.query = jest.fn().mockImplementation((_, callback) => {
      callback(mockTabs);
    });

    // Mock chrome.storage.local.get
    chrome.storage.local.get = jest.fn().mockImplementation((_, callback) => {
      callback({ savedTabs: [] });
    });

    // Mock chrome.storage.local.set
    chrome.storage.local.set = jest.fn().mockImplementation((_, callback) => {
      if (callback) callback();
    });

    // Simulate button click
    document.getElementById('saveCloseTabs')?.click();

    // Verify that chrome.tabs.query was called
    expect(chrome.tabs.query).toHaveBeenCalledWith(
      { currentWindow: true },
      expect.any(Function)
    );
  });

  test('View Saved Tabs button should create a new tab', () => {
    // Mock chrome.tabs.create
    chrome.tabs.create = jest.fn();

    // Mock chrome.runtime.getURL
    chrome.runtime.getURL = jest.fn().mockReturnValue('chrome-extension://mock-id/saved-tabs.html');

    // Simulate button click
    document.getElementById('viewSavedTabs')?.click();

    // Verify that chrome.tabs.create was called with the correct URL
    expect(chrome.tabs.create).toHaveBeenCalledWith({ 
      url: expect.stringContaining('saved-tabs.html') 
    });
  });
});