import { expect, test } from './fixtures';

test('saves and closes eligible tabs, then opens the saved tabs page', async ({
  clearExtensionStorage,
  closeAllPages,
  createFixtureTab,
  fixtureUrl,
  openPopupPage,
  queryTabs,
  readSavedTabs,
  waitForNewPage,
}) => {
  await clearExtensionStorage();
  await closeAllPages();

  await createFixtureTab('localhost', 'save-close-localhost');
  await createFixtureTab('127.0.0.1', 'save-close-loopback');
  const popupPage = await openPopupPage();

  const savedTabsPage = await waitForNewPage(
    async () => {
      await popupPage.getByRole('button', { name: 'Save & Close All Tabs' }).click();
    },
    page => page.url().includes('/saved-tabs.html')
  );

  await expect(savedTabsPage).toHaveURL(/saved-tabs\.html$/);
  await expect(savedTabsPage.locator('#tabsContainer .tab-item')).toHaveCount(2);

  const savedTabs = await readSavedTabs();
  expect(savedTabs).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        title: 'Fixture localhost save close localhost',
        url: fixtureUrl('localhost', 'save-close-localhost'),
      }),
      expect.objectContaining({
        title: 'Fixture 127.0.0.1 save close loopback',
        url: fixtureUrl('127.0.0.1', 'save-close-loopback'),
      }),
    ])
  );

  const remainingTabs = await queryTabs();
  expect(
    remainingTabs.some(tab => tab.url === fixtureUrl('localhost', 'save-close-localhost'))
  ).toBe(false);
  expect(
    remainingTabs.some(tab => tab.url === fixtureUrl('127.0.0.1', 'save-close-loopback'))
  ).toBe(false);
  expect(remainingTabs.some(tab => tab.url.endsWith('/src/popup/popup.html'))).toBe(true);
  expect(remainingTabs.some(tab => tab.url.endsWith('/saved-tabs.html'))).toBe(true);
});

test('ignores already-open extension pages during save and close', async ({
  clearExtensionStorage,
  closeAllPages,
  createFixtureTab,
  fixtureUrl,
  openPopupPage,
  openSavedTabsPage,
  queryTabs,
  readSavedTabs,
  waitForNewPage,
}) => {
  await clearExtensionStorage();
  await closeAllPages();

  await createFixtureTab('localhost', 'save-close-filtered');
  const existingSavedTabsPage = await openSavedTabsPage();
  const popupPage = await openPopupPage();

  const newSavedTabsPage = await waitForNewPage(
    async () => {
      await popupPage.getByRole('button', { name: 'Save & Close All Tabs' }).click();
    },
    page => page !== existingSavedTabsPage && page.url().endsWith('/saved-tabs.html')
  );

  await expect(newSavedTabsPage).toHaveURL(/saved-tabs\.html$/);
  expect(existingSavedTabsPage.isClosed()).toBe(false);

  const savedTabs = await readSavedTabs();
  expect(savedTabs).toEqual([
    expect.objectContaining({
      title: 'Fixture localhost save close filtered',
      url: fixtureUrl('localhost', 'save-close-filtered'),
    }),
  ]);
  expect(savedTabs.some(tab => tab.url.endsWith('/saved-tabs.html'))).toBe(false);

  await expect
    .poll(async () => {
      const tabs = await queryTabs();

      return {
        savedTabsPages: tabs.filter(tab => tab.url.endsWith('/saved-tabs.html')).length,
        fixtureTabStillOpen: tabs.some(
          tab => tab.url === fixtureUrl('localhost', 'save-close-filtered')
        ),
      };
    })
    .toEqual({
      savedTabsPages: 2,
      fixtureTabStillOpen: false,
    });
});
