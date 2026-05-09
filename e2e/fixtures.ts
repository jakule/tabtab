import {
  chromium,
  expect,
  test as base,
  type BrowserContext,
  type Download,
  type Page,
  type Worker,
} from '@playwright/test';
import path from 'node:path';
import { Readable } from 'node:stream';

const fixturePort = Number(process.env.E2E_FIXTURE_PORT ?? 3210);
const extensionPath = path.join(process.cwd(), 'dist-e2e');
const headed = process.env.PWTEST_HEADED === '1';

export interface SavedTabRecord {
  title: string;
  url: string;
  favicon: string;
  date: number;
  groupId?: string;
}

export interface ExtensionTabRecord {
  id: number;
  url: string;
  title: string;
  groupId: number;
  windowId: number;
  active: boolean;
  pinned: boolean;
}

export interface ExtensionTabGroupRecord {
  id: number;
  title: string;
  color: string;
  collapsed: boolean;
  windowId: number;
}

type TestFixtures = {
  context: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
  fixtureUrl: (host: 'localhost' | '127.0.0.1', slug: string) => string;
  openPopupPage: () => Promise<Page>;
  openSavedTabsPage: () => Promise<Page>;
  closeAllPages: () => Promise<void>;
  createFixtureTab: (host: 'localhost' | '127.0.0.1', slug: string) => Promise<Page>;
  clearExtensionStorage: () => Promise<void>;
  seedSavedTabs: (tabs: SavedTabRecord[]) => Promise<void>;
  readSavedTabs: () => Promise<SavedTabRecord[]>;
  queryTabs: () => Promise<ExtensionTabRecord[]>;
  queryTabGroups: () => Promise<ExtensionTabGroupRecord[]>;
  waitForNewPage: (
    action: () => Promise<unknown>,
    predicate?: (page: Page) => boolean
  ) => Promise<Page>;
  readDownloadAsText: (download: Download) => Promise<string>;
};

async function getServiceWorker(context: BrowserContext): Promise<Worker> {
  const [existing] = context.serviceWorkers();

  if (existing) {
    return existing;
  }

  return await context.waitForEvent('serviceworker');
}

async function readStream(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString('utf8');
}

export const test = base.extend<TestFixtures>({
  context: async ({}, use, testInfo) => {
    const userDataDir = testInfo.outputPath('user-data');
    const context = await chromium.launchPersistentContext(userDataDir, {
      acceptDownloads: true,
      channel: 'chromium',
      headless: !headed,
      locale: 'en-US',
      timezoneId: 'UTC',
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });

    await use(context);
    await context.close();
  },
  serviceWorker: async ({ context }, use) => {
    const worker = await getServiceWorker(context);
    await use(worker);
  },
  extensionId: async ({ serviceWorker }, use) => {
    await use(serviceWorker.url().split('/')[2]);
  },
  fixtureUrl: async ({}, use) => {
    await use((host, slug) => `http://${host}:${fixturePort}/${slug}`);
  },
  openPopupPage: async ({ context, extensionId }, use) => {
    await use(async () => {
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
      await page.waitForLoadState('domcontentloaded');
      return page;
    });
  },
  openSavedTabsPage: async ({ context, extensionId }, use) => {
    await use(async () => {
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/saved-tabs.html`);
      await page.waitForLoadState('domcontentloaded');
      return page;
    });
  },
  closeAllPages: async ({ context }, use) => {
    await use(async () => {
      await Promise.all(
        context.pages().map(async page => {
          await page.close();
        })
      );
    });
  },
  createFixtureTab: async ({ context, fixtureUrl }, use) => {
    await use(async (host, slug) => {
      const page = await context.newPage();
      await page.goto(fixtureUrl(host, slug));
      const escapedHost = host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const normalizedSlug = slug.replace(/-/g, ' ');
      await expect(page).toHaveTitle(new RegExp(`${escapedHost} ${normalizedSlug}`));
      return page;
    });
  },
  clearExtensionStorage: async ({ serviceWorker }, use) => {
    await use(async () => {
      await serviceWorker.evaluate(async () => {
        await chrome.storage.local.clear();
      });
    });
  },
  seedSavedTabs: async ({ serviceWorker }, use) => {
    await use(async tabs => {
      await serviceWorker.evaluate(async savedTabs => {
        await chrome.storage.local.set({ savedTabs });
      }, tabs);
    });
  },
  readSavedTabs: async ({ serviceWorker }, use) => {
    await use(async () => {
      return await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get({ savedTabs: [] });
        return result.savedTabs as SavedTabRecord[];
      });
    });
  },
  queryTabs: async ({ serviceWorker }, use) => {
    await use(async () => {
      return await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({});
        return tabs.map(tab => ({
          id: tab.id ?? -1,
          url: tab.url ?? '',
          title: tab.title ?? '',
          groupId: tab.groupId ?? -1,
          windowId: tab.windowId ?? -1,
          active: Boolean(tab.active),
          pinned: Boolean(tab.pinned),
        }));
      });
    });
  },
  queryTabGroups: async ({ serviceWorker }, use) => {
    await use(async () => {
      const groups = await serviceWorker.evaluate(async () => {
        return await chrome.tabGroups.query({});
      });

      return groups.map(group => ({
        id: group.id,
        title: group.title ?? '',
        color: group.color ?? '',
        collapsed: Boolean(group.collapsed),
        windowId: group.windowId ?? -1,
      }));
    });
  },
  waitForNewPage: async ({ context }, use) => {
    await use(async (action, predicate) => {
      const pagePromise = (async () => {
        while (true) {
          const page = await context.waitForEvent('page');
          await page.waitForLoadState('domcontentloaded');

          if (!predicate || predicate(page)) {
            return page;
          }
        }
      })();

      await action();
      return await pagePromise;
    });
  },
  readDownloadAsText: async ({}, use) => {
    await use(async download => {
      const stream = await download.createReadStream();

      if (!stream) {
        throw new Error('Download stream was not available.');
      }

      return await readStream(stream);
    });
  },
});

export { expect };
