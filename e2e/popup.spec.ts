import { expect, test } from './fixtures';

test('groups and ungroups tabs by host', async ({
  closeAllPages,
  createFixtureTab,
  openPopupPage,
  queryTabGroups,
  queryTabs,
}) => {
  await closeAllPages();

  await createFixtureTab('localhost', 'alpha-localhost');
  await createFixtureTab('localhost', 'beta-localhost');
  await createFixtureTab('127.0.0.1', 'alpha-loopback');
  const popupPage = await openPopupPage();

  await popupPage.getByRole('button', { name: 'Group Tabs by Domain' }).click();
  await expect(popupPage.locator('#status')).toHaveText('Tabs grouped successfully!');

  await expect
    .poll(async () => (await queryTabGroups()).map(group => group.title).sort())
    .toEqual(expect.arrayContaining(['127.0.0.1', 'localhost']));

  const groupedTabs = await queryTabs();
  const localhostTabs = groupedTabs.filter(tab => tab.url.startsWith('http://localhost:3210/'));
  const loopbackTabs = groupedTabs.filter(tab => tab.url.startsWith('http://127.0.0.1:3210/'));
  expect(localhostTabs).toHaveLength(2);
  expect(loopbackTabs).toHaveLength(1);
  expect(new Set(localhostTabs.map(tab => tab.groupId)).size).toBe(1);
  expect(localhostTabs[0]?.groupId).not.toBe(-1);
  expect(loopbackTabs[0]?.groupId).not.toBe(-1);
  expect(localhostTabs[0]?.groupId).not.toBe(loopbackTabs[0]?.groupId);

  await popupPage.getByRole('button', { name: 'Ungroup All Tabs' }).click();
  await expect(popupPage.locator('#status')).toHaveText('Tabs ungrouped!');

  await expect
    .poll(async () => {
      const tabs = await queryTabs();
      return tabs
        .filter(
          tab =>
            tab.url.startsWith('http://localhost:3210/') ||
            tab.url.startsWith('http://127.0.0.1:3210/')
        )
        .every(tab => tab.groupId === -1);
    })
    .toBe(true);
});
