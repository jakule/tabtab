import { expect, test, type SavedTabRecord } from './fixtures';

const seededTabs: SavedTabRecord[] = [
  {
    title: 'Alpha Localhost',
    url: 'http://localhost:3210/alpha-localhost',
    favicon: '',
    date: 1_710_000_000_000,
    groupId: 'group-a',
  },
  {
    title: 'Beta Localhost',
    url: 'http://localhost:3210/beta-localhost',
    favicon: '',
    date: 1_710_000_000_000,
    groupId: 'group-a',
  },
  {
    title: 'Gamma Loopback',
    url: 'http://127.0.0.1:3210/gamma-loopback',
    favicon: '',
    date: 1_709_000_000_000,
    groupId: 'group-b',
  },
];

test('renders grouped tabs, filters by search, and supports open/remove actions', async ({
  clearExtensionStorage,
  closeAllPages,
  openSavedTabsPage,
  readSavedTabs,
  seedSavedTabs,
  waitForNewPage,
}) => {
  await clearExtensionStorage();
  await closeAllPages();
  await seedSavedTabs(seededTabs);

  const savedTabsPage = await openSavedTabsPage();

  await expect(savedTabsPage.locator('.tab-group')).toHaveCount(2);
  await expect(savedTabsPage.locator('#stats')).toContainText('3');
  await expect(savedTabsPage.locator('#stats')).toContainText('2');
  await expect(savedTabsPage.locator('.tab-item')).toHaveCount(3);

  await savedTabsPage.locator('#searchInput').fill('gamma');
  await expect(savedTabsPage.locator('.tab-item', { hasText: 'Gamma Loopback' })).toBeVisible();
  await expect(savedTabsPage.locator('.tab-item', { hasText: 'Alpha Localhost' })).toBeHidden();

  await savedTabsPage.getByRole('button', { name: 'Clear' }).click();
  await expect(savedTabsPage.locator('.tab-item', { hasText: 'Alpha Localhost' })).toBeVisible();

  const openedPage = await waitForNewPage(
    async () => {
      await savedTabsPage
        .locator('.tab-item', { hasText: 'Gamma Loopback' })
        .getByRole('button', { name: 'Open' })
        .click();
    },
    page => page.url().includes('/gamma-loopback')
  );
  await expect(openedPage).toHaveTitle('Fixture 127.0.0.1 gamma loopback');

  await savedTabsPage
    .locator('.tab-item', { hasText: 'Beta Localhost' })
    .getByRole('button', { name: 'Remove' })
    .click();
  await expect(savedTabsPage.locator('.tab-item')).toHaveCount(2);

  const remainingTabs = await readSavedTabs();
  expect(remainingTabs.map(tab => tab.title)).toEqual(['Alpha Localhost', 'Gamma Loopback']);
});

test('opens and removes a full saved-tab group', async ({
  clearExtensionStorage,
  closeAllPages,
  context,
  openSavedTabsPage,
  readSavedTabs,
  seedSavedTabs,
}) => {
  await clearExtensionStorage();
  await closeAllPages();
  await seedSavedTabs(seededTabs);

  const savedTabsPage = await openSavedTabsPage();
  const groupA = savedTabsPage.locator('.tab-group').filter({ hasText: 'Alpha Localhost' });

  await groupA.getByRole('button', { name: 'Open All' }).click();

  await expect
    .poll(() =>
      context
        .pages()
        .map(page => page.url())
        .filter(
          url => url.includes('/alpha-localhost') || url.includes('/beta-localhost')
        )
        .sort()
    )
    .toEqual([
      'http://localhost:3210/alpha-localhost',
      'http://localhost:3210/beta-localhost',
    ]);

  const [firstOpenedPage, secondOpenedPage] = context
    .pages()
    .filter(
      page =>
        page.url().includes('/alpha-localhost') || page.url().includes('/beta-localhost')
    )
    .sort((left, right) => left.url().localeCompare(right.url()));
  await expect(firstOpenedPage).toHaveTitle('Fixture localhost alpha localhost');
  await expect(secondOpenedPage).toHaveTitle('Fixture localhost beta localhost');

  await groupA.getByRole('button', { name: 'Remove All' }).click();
  await expect(savedTabsPage.locator('.tab-group')).toHaveCount(1);

  const remainingTabs = await readSavedTabs();
  expect(remainingTabs.map(tab => tab.title)).toEqual(['Gamma Loopback']);
});
