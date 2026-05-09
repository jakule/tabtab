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

const legacyDateSeededTabs: SavedTabRecord[] = [
  {
    title: 'Legacy Alpha',
    url: 'http://localhost:3210/legacy-alpha',
    favicon: '',
    date: Date.UTC(2024, 4, 1, 12, 0, 0),
  },
  {
    title: 'Legacy Beta',
    url: 'http://localhost:3210/legacy-beta',
    favicon: '',
    date: Date.UTC(2024, 4, 1, 12, 30, 0),
  },
  {
    title: 'Legacy Gamma',
    url: 'http://127.0.0.1:3210/legacy-gamma',
    favicon: '',
    date: Date.UTC(2024, 3, 15, 12, 0, 0),
  },
];

test('renders the empty state when no saved tabs exist', async ({
  clearExtensionStorage,
  closeAllPages,
  openSavedTabsPage,
}) => {
  await clearExtensionStorage();
  await closeAllPages();

  const savedTabsPage = await openSavedTabsPage();

  await expect(savedTabsPage.locator('#stats')).toContainText('0');
  await expect(savedTabsPage.locator('.no-tabs')).toContainText('No saved tabs yet.');
  await expect(savedTabsPage.locator('.tab-item')).toHaveCount(0);
});

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

test('shows a no-results state and recovers from clear search in the message', async ({
  clearExtensionStorage,
  closeAllPages,
  openSavedTabsPage,
  seedSavedTabs,
}) => {
  await clearExtensionStorage();
  await closeAllPages();
  await seedSavedTabs(seededTabs);

  const savedTabsPage = await openSavedTabsPage();

  await savedTabsPage.locator('#searchInput').fill('does-not-exist');
  await expect(savedTabsPage.locator('.no-results')).toContainText(
    'No tabs match your search: "does-not-exist"'
  );
  await expect(savedTabsPage.locator('.tab-group').first()).toBeHidden();
  await expect(savedTabsPage.locator('.tab-group').nth(1)).toBeHidden();

  await savedTabsPage.getByRole('button', { name: 'Clear Search' }).click();
  await expect(savedTabsPage.locator('.no-results')).toHaveCount(0);
  await expect(savedTabsPage.locator('#searchInput')).toHaveValue('');
  await expect(savedTabsPage.locator('.tab-item')).toHaveCount(3);
  await expect(savedTabsPage.locator('.tab-group').first()).toBeVisible();
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
        .filter(url => url.includes('/alpha-localhost') || url.includes('/beta-localhost'))
        .sort()
    )
    .toEqual(['http://localhost:3210/alpha-localhost', 'http://localhost:3210/beta-localhost']);

  const [firstOpenedPage, secondOpenedPage] = context
    .pages()
    .filter(
      page => page.url().includes('/alpha-localhost') || page.url().includes('/beta-localhost')
    )
    .sort((left, right) => left.url().localeCompare(right.url()));
  await expect(firstOpenedPage).toHaveTitle('Fixture localhost alpha localhost');
  await expect(secondOpenedPage).toHaveTitle('Fixture localhost beta localhost');

  await groupA.getByRole('button', { name: 'Remove All' }).click();
  await expect(savedTabsPage.locator('.tab-group')).toHaveCount(1);

  const remainingTabs = await readSavedTabs();
  expect(remainingTabs.map(tab => tab.title)).toEqual(['Gamma Loopback']);
});

test('supports opening and removing legacy date-based groups without group ids', async ({
  clearExtensionStorage,
  closeAllPages,
  context,
  openSavedTabsPage,
  readSavedTabs,
  seedSavedTabs,
}) => {
  await clearExtensionStorage();
  await closeAllPages();
  await seedSavedTabs(legacyDateSeededTabs);

  const savedTabsPage = await openSavedTabsPage();
  const legacyGroup = savedTabsPage.locator('.tab-group').filter({ hasText: 'Legacy Alpha' });

  await expect(savedTabsPage.locator('.tab-group')).toHaveCount(2);
  await legacyGroup.getByRole('button', { name: 'Open All' }).click();

  await expect
    .poll(() =>
      context
        .pages()
        .map(page => page.url())
        .filter(url => url.includes('/legacy-alpha') || url.includes('/legacy-beta'))
        .sort()
    )
    .toEqual(['http://localhost:3210/legacy-alpha', 'http://localhost:3210/legacy-beta']);

  const [legacyAlphaPage, legacyBetaPage] = context
    .pages()
    .filter(page => page.url().includes('/legacy-alpha') || page.url().includes('/legacy-beta'))
    .sort((left, right) => left.url().localeCompare(right.url()));
  await expect(legacyAlphaPage).toHaveTitle('Fixture localhost legacy alpha');
  await expect(legacyBetaPage).toHaveTitle('Fixture localhost legacy beta');

  await legacyGroup.getByRole('button', { name: 'Remove All' }).click();
  await expect(savedTabsPage.locator('.tab-group')).toHaveCount(1);

  const remainingTabs = await readSavedTabs();
  expect(remainingTabs.map(tab => tab.title)).toEqual(['Legacy Gamma']);
});
