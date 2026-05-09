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
