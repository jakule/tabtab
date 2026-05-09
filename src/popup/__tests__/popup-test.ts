/**
 * @jest-environment jsdom
 */
import '../../test/test-setup.ts';

const HOUR_IN_MS = 60 * 60 * 1000;

// Mock the utils import
jest.mock('../../utils.ts', () => ({
  getHost: jest.fn(url => {
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
    <button id="saveCloseStaleTabs">Save & Close Tabs Older Than 24 Hours</button>
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

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Popup', () => {
  const mockTabs = [
    { id: 1, url: 'https://example.com/page1', title: 'Example 1' },
    { id: 2, url: 'https://example.com/page2', title: 'Example 2' },
    { id: 3, url: 'https://another.com/page', title: 'Another Site' },
  ] as chrome.tabs.Tab[];

  function mockTabQuery(tabs: chrome.tabs.Tab[]): void {
    chrome.tabs.query = jest.fn().mockImplementation((_, callback) => {
      callback(tabs);
    });
  }

  function mockSavedTabsStorage(existingSavedTabs: Array<Record<string, unknown>> = []): void {
    chrome.storage.local.get = jest.fn().mockImplementation((_, callback) => {
      callback({ savedTabs: existingSavedTabs });
    });

    chrome.storage.local.set = jest.fn().mockImplementation((_, callback) => {
      if (callback) callback();
    });
  }

  test('Group Tabs button should query tabs when clicked', () => {
    mockTabQuery(mockTabs);

    document.getElementById('groupTabs')?.click();

    expect(chrome.tabs.query).toHaveBeenCalledWith({ currentWindow: true }, expect.any(Function));
  });

  test('Ungroup Tabs button should query tabs when clicked', () => {
    mockTabQuery(mockTabs);
    chrome.tabs.ungroup = jest.fn().mockImplementation((_, callback) => {
      if (callback) callback();
    });

    document.getElementById('ungroupTabs')?.click();

    expect(chrome.tabs.query).toHaveBeenCalledWith({ currentWindow: true }, expect.any(Function));
  });

  test('Save & Close button should preserve the existing full save-and-close behavior', () => {
    const tabsToProcess = [
      {
        id: 1,
        url: 'https://example.com/page1',
        title: 'Example 1',
        favIconUrl: 'https://example.com/favicon.ico',
      },
      { id: 2, url: 'chrome://settings', title: 'Chrome Settings' },
      { id: 3, url: 'chrome-extension://mock-extension-id/src/popup/popup.html', title: 'Popup' },
    ] as chrome.tabs.Tab[];
    const existingSavedTabs = [
      {
        title: 'Existing Tab',
        url: 'https://saved.example.com',
        favicon: '',
        date: 123,
        groupId: 'existing-group',
      },
    ];

    mockTabQuery(tabsToProcess);
    mockSavedTabsStorage(existingSavedTabs);

    document.getElementById('saveCloseTabs')?.click();

    expect(chrome.tabs.query).toHaveBeenCalledWith({ currentWindow: true }, expect.any(Function));
    expect(chrome.storage.local.set).toHaveBeenCalled();
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: expect.stringContaining('saved-tabs.html'),
    });
    expect(chrome.tabs.remove).toHaveBeenCalledWith([1, 2]);

    const setCalls = (chrome.storage.local.set as jest.Mock).mock.calls;
    const setCall = setCalls[setCalls.length - 1][0] as {
      savedTabs: Array<Record<string, unknown>>;
    };
    expect(setCall.savedTabs).toEqual(
      expect.arrayContaining([
        existingSavedTabs[0],
        expect.objectContaining({
          title: 'Example 1',
          url: 'https://example.com/page1',
          favicon: 'https://example.com/favicon.ico',
          date: expect.any(Number),
          groupId: expect.any(String),
        }),
      ])
    );
    expect(setCall.savedTabs).toHaveLength(2);
  });

  test('Save & Close Stale Tabs button should save and close only stale eligible tabs', () => {
    const fixedNow = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

    const tabsToProcess = [
      {
        id: 1,
        url: 'https://example.com/old-page',
        title: 'Old Page',
        favIconUrl: 'https://example.com/old.ico',
        lastAccessed: fixedNow - 26 * HOUR_IN_MS,
      },
      {
        id: 2,
        url: 'https://example.com/recent-page',
        title: 'Recent Page',
        lastAccessed: fixedNow - 2 * HOUR_IN_MS,
      },
      {
        id: 3,
        url: 'https://example.com/pinned-page',
        title: 'Pinned Page',
        pinned: true,
        lastAccessed: fixedNow - 30 * HOUR_IN_MS,
      },
      {
        id: 4,
        url: 'https://example.com/no-last-accessed',
        title: 'No Last Accessed',
      },
      {
        id: 5,
        url: 'chrome://settings',
        title: 'Chrome Settings',
        lastAccessed: fixedNow - 30 * HOUR_IN_MS,
      },
      {
        id: 6,
        url: 'https://another.com/old-page',
        title: 'Another Old Page',
        lastAccessed: fixedNow - 40 * HOUR_IN_MS,
      },
    ] as chrome.tabs.Tab[];

    mockTabQuery(tabsToProcess);
    mockSavedTabsStorage();

    document.getElementById('saveCloseStaleTabs')?.click();

    expect(chrome.tabs.query).toHaveBeenCalledWith({ currentWindow: true }, expect.any(Function));
    expect(chrome.storage.local.set).toHaveBeenCalled();
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: expect.stringContaining('saved-tabs.html'),
    });
    expect(chrome.tabs.remove).toHaveBeenCalledWith([1, 6]);

    const setCalls = (chrome.storage.local.set as jest.Mock).mock.calls;
    const setCall = setCalls[setCalls.length - 1][0] as {
      savedTabs: Array<Record<string, unknown>>;
    };
    expect(setCall.savedTabs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Old Page',
          url: 'https://example.com/old-page',
          favicon: 'https://example.com/old.ico',
          date: fixedNow,
          groupId: fixedNow.toString(),
        }),
        expect.objectContaining({
          title: 'Another Old Page',
          url: 'https://another.com/old-page',
          favicon: '',
          date: fixedNow,
          groupId: fixedNow.toString(),
        }),
      ])
    );
    expect(setCall.savedTabs).toHaveLength(2);
  });

  test('Save & Close Stale Tabs button should no-op when no tabs are old enough', () => {
    const fixedNow = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

    const tabsToProcess = [
      {
        id: 1,
        url: 'https://example.com/recent-page',
        title: 'Recent Page',
        lastAccessed: fixedNow - 3 * HOUR_IN_MS,
      },
      {
        id: 2,
        url: 'https://example.com/pinned-page',
        title: 'Pinned Page',
        pinned: true,
        lastAccessed: fixedNow - 30 * HOUR_IN_MS,
      },
      {
        id: 3,
        url: 'https://example.com/no-last-accessed',
        title: 'No Last Accessed',
      },
    ] as chrome.tabs.Tab[];

    mockTabQuery(tabsToProcess);
    mockSavedTabsStorage();

    document.getElementById('saveCloseStaleTabs')?.click();

    expect(chrome.storage.local.get).not.toHaveBeenCalled();
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    expect(chrome.tabs.remove).not.toHaveBeenCalled();
    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(document.getElementById('status')?.textContent).toBe(
      'No tabs older than 24 hours to save and close.'
    );
  });

  test('View Saved Tabs button should create a new tab', () => {
    chrome.runtime.getURL = jest.fn().mockReturnValue('chrome-extension://mock-id/saved-tabs.html');

    document.getElementById('viewSavedTabs')?.click();

    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: expect.stringContaining('saved-tabs.html'),
    });
  });
});
