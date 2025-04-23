// Mock Chrome API
const createChromeApiMock = (): Record<string, unknown> => {
  return {
    tabs: {
      query: jest.fn(),
      create: jest.fn(),
      group: jest.fn(),
      ungroup: jest.fn(),
      remove: jest.fn(),
    },
    tabGroups: {
      update: jest.fn(),
    },
    storage: {
      local: {
        get: jest.fn(),
        set: jest.fn(),
      },
    },
    runtime: {
      getURL: jest.fn().mockImplementation((path) => `chrome-extension://mock-extension-id/${path}`),
    },
  };
};

// Set up global Chrome mock
global.chrome = createChromeApiMock() as unknown as typeof chrome;

window.URL.createObjectURL = jest.fn();
window.URL.revokeObjectURL = jest.fn();
