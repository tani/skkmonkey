import assert from 'node:assert/strict';
import type { Page } from 'playwright';
import { assertInlinePreeditPainted } from './inline-preedit.browser.ts';

// Cover both the public React header's ARIA dialog and QueryBuilder's native modal.
// Suggestions and the submitted query are derived from the input event.
export const githubSearchFixture = `
<button id="github-search-trigger" aria-haspopup="dialog" aria-expanded="false">Search</button>
<template id="github-search-template">
  <form role="search" action="/search">
    <input id="github-search" type="text" name="q" role="combobox" aria-label="Search or jump to"
      aria-haspopup="listbox" aria-expanded="true" aria-controls="github-search-results"
      aria-autocomplete="list" placeholder="Search or jump to...">
    <ul id="github-search-results" role="listbox"></ul>
  </form>
</template>
<output id="github-search-submitted"></output>
<script>
{
  const trigger = document.querySelector('#github-search-trigger');
  const native = new URLSearchParams(location.search).has('native-search');
  const dialog = document.createElement(native ? 'dialog' : 'div');
  dialog.id = 'github-search-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'Search GitHub');
  dialog.style.cssText = 'position:fixed;inset:16px 16px auto auto;margin:0;background:Canvas;padding:8px;z-index:1000';
  dialog.hidden = !native;
  dialog.append(document.querySelector('#github-search-template').content.cloneNode(true));
  document.body.append(dialog);
  const input = document.querySelector('#github-search');
  const results = document.querySelector('#github-search-results');
  let query = '';
  function close() {
    if (native) dialog.close();
    else dialog.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.focus();
  }
  trigger.addEventListener('click', () => {
    if (native) dialog.showModal();
    else dialog.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    input.focus();
  });
  input.addEventListener('input', () => {
    query = input.value;
    queueMicrotask(() => {
      const option = document.createElement('li');
      option.id = 'github-search-option';
      option.setAttribute('role', 'option');
      option.textContent = query;
      results.replaceChildren(option);
      input.setAttribute('aria-activedescendant', option.id);
    });
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
  input.form.addEventListener('submit', (event) => {
    event.preventDefault();
    document.querySelector('#github-search-submitted').textContent = query;
    close();
  });
}
</script>`;

export async function checkGitHubSearch(page: Page): Promise<void> {
  const trigger = page.locator('#github-search-trigger');
  const dialog = page.locator('#github-search-dialog');
  const input = dialog.getByRole('combobox');
  const inline = page.locator('.inline-preedit');
  const option = dialog.getByRole('option');
  const placeholderColor = () =>
    input.evaluate((node) => getComputedStyle(node, '::placeholder').color);

  await trigger.click();
  assert.equal(await input.evaluate((node) => node === document.activeElement), true);
  await page.keyboard.press('Control+j');
  const originalColor = await placeholderColor();
  await page.keyboard.press('k');
  await inline.waitFor({ state: 'visible' });
  await assertInlinePreeditPainted(inline);
  assert.equal(await inline.textContent(), 'k');
  assert.equal(await input.inputValue(), '');
  assert.equal(await option.count(), 0);
  assert.equal(await placeholderColor(), 'rgba(0, 0, 0, 0)', 'the placeholder overlaps preedit');

  await page.keyboard.press('Escape');
  await inline.waitFor({ state: 'hidden' });
  assert.equal(await dialog.isVisible(), true);
  assert.equal(await placeholderColor(), originalColor);

  await page.keyboard.press('k');
  await inline.waitFor({ state: 'visible' });
  await page.keyboard.press('a');
  await inline.waitFor({ state: 'hidden' });
  assert.equal(await input.inputValue(), 'か');
  assert.equal(await option.textContent(), 'か');

  // Re-render suggestions between the two keys of the next syllable.
  await page.keyboard.press('s');
  await inline.waitFor({ state: 'visible' });
  await option.evaluate((node) => node.replaceWith(node.cloneNode(true)));
  assert.equal(await inline.textContent(), 's');
  assert.equal(await input.inputValue(), 'か');
  await page.keyboard.press('a');
  await inline.waitFor({ state: 'hidden' });
  assert.equal(await option.textContent(), 'かさ');
  await page.keyboard.press('Enter');
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#github-search-submitted').textContent(), 'かさ');
  assert.equal(await trigger.evaluate((node) => node === document.activeElement), true);

  await trigger.click();
  await input.fill('');
  await page.keyboard.press('Control+j');
  await page.keyboard.press('k');
  await inline.waitFor({ state: 'visible' });
  await page.keyboard.press('Backspace');
  await inline.waitFor({ state: 'hidden' });
  assert.equal(await placeholderColor(), originalColor);
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
}
