import path from 'node:path';
import { expect, test } from './fixtures';

const importFixturePath = path.join(process.cwd(), 'e2e', 'fixtures', 'import-tabs.txt');

test('exports tabs, imports a fixture file, and skips duplicate URLs', async ({
  clearExtensionStorage,
  closeAllPages,
  openSavedTabsPage,
  readDownloadAsText,
  readSavedTabs,
  seedSavedTabs,
}) => {
  await clearExtensionStorage();
  await closeAllPages();
  await seedSavedTabs([
    {
      title: 'Existing Localhost',
      url: 'http://localhost:3210/existing-localhost',
      favicon: '',
      date: 1_710_500_000_000,
      groupId: 'existing-group',
    },
  ]);

  const savedTabsPage = await openSavedTabsPage();

  const downloadPromise = savedTabsPage.waitForEvent('download');
  await savedTabsPage.getByRole('button', { name: 'Export as Text' }).click();
  const download = await downloadPromise;
  const exportText = await readDownloadAsText(download);

  expect(exportText).toContain('TabTab Exported Tabs');
  expect(exportText).toContain('Existing Localhost');
  expect(exportText).toContain('http://localhost:3210/existing-localhost');

  const dialogPromise = savedTabsPage.waitForEvent('dialog');
  await savedTabsPage.locator('#importFile').setInputFiles(importFixturePath);
  const dialog = await dialogPromise;
  expect(dialog.message()).toBe('Successfully imported 2 tabs in 1 groups');
  await dialog.accept();

  await expect(savedTabsPage.locator('.tab-item')).toHaveCount(3);
  await expect(savedTabsPage.locator('.tab-item', { hasText: 'Imported Localhost' })).toBeVisible();
  await expect(savedTabsPage.locator('.tab-item', { hasText: 'Imported Loopback' })).toBeVisible();

  const savedTabs = await readSavedTabs();
  expect(savedTabs).toHaveLength(3);
  expect(
    savedTabs.filter(tab => tab.url === 'http://localhost:3210/existing-localhost')
  ).toHaveLength(1);
});
