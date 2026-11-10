import assert from 'node:assert/strict';
import type { Locator, Page } from 'playwright';

export async function assertInlinePreeditPainted(inline: Locator): Promise<void> {
  assert.equal(
    await inline.evaluate((node) => {
      const bounds = node.getBoundingClientRect();
      node.style.pointerEvents = 'auto';
      try {
        const root = node.getRootNode() as ShadowRoot;
        return (
          root.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2) === node
        );
      } finally {
        node.style.removeProperty('pointer-events');
      }
    }),
    true,
    'inline preedit must be painted above the active field',
  );
}

async function box(locator: Locator) {
  const bounds = await locator.boundingBox();
  assert.ok(bounds);
  return bounds;
}

export async function checkInlinePreedit(page: Page): Promise<void> {
  const inline = page.locator('.inline-preedit');
  const textarea = page.locator('#markdown-body');
  const dialog = page.locator('#markdown-dialog');
  await dialog.evaluate((node) => (node as HTMLDialogElement).showModal());
  await textarea.focus();
  await page.keyboard.press('Control+j');

  // Markdown forms can live inside a modal, which paints above ordinary
  // fixed-position overlays even when those overlays have a high z-index.
  await page.keyboard.type('k');
  await inline.waitFor({ state: 'visible' });
  assert.equal(await inline.textContent(), 'k');
  assert.equal(await textarea.inputValue(), '');
  await assertInlinePreeditPainted(inline);
  await page.keyboard.type('a');
  assert.equal(await textarea.inputValue(), 'か');
  await inline.waitFor({ state: 'hidden' });
  await dialog.evaluate((node) => (node as HTMLDialogElement).close());

  // A dynamically removed dialog must not retain the shared preview node.
  await dialog.evaluate((node) => (node as HTMLDialogElement).showModal());
  await textarea.focus();
  await page.keyboard.type('k');
  await inline.waitFor({ state: 'visible' });
  await dialog.evaluate((node) => node.remove());
  await inline.waitFor({ state: 'hidden' });

  const field = page.locator('#markdown-page');
  await field.focus();
  await page.keyboard.press('Control+j');
  await field.fill('abcdefghij'.repeat(4));
  await field.press('End');
  await page.keyboard.type('k');
  await inline.waitFor({ state: 'visible' });
  const wide = await box(inline);
  await field.evaluate((node) => (node.style.width = '160px'));
  await page.waitForFunction(
    (y) => window.__skkUI.querySelector('.inline-preedit')!.getBoundingClientRect().top > y + 15,
    wide.y,
  );
  const narrow = await box(inline);
  const resized = await box(field);
  assert.ok(narrow.x >= resized.x && narrow.x + narrow.width <= resized.x + resized.width);
  assert.equal(await field.inputValue(), 'abcdefghij'.repeat(4));
  await page.keyboard.press('Escape');
  await inline.waitFor({ state: 'hidden' });

  // Vertical scroll can move the caret out of the field and back into view
  // without moving the selection or typing another key.
  const lines = Array.from({ length: 18 }, (_, index) => `row ${index}`).join('\n');
  await field.fill(lines);
  await field.evaluate((node) => {
    const textarea = node as HTMLTextAreaElement;
    textarea.setSelectionRange(42, 42);
    textarea.scrollTop = 84;
  });
  await page.keyboard.type('k');
  await inline.waitFor({ state: 'visible' });
  const scrolled = await box(inline);
  await field.evaluate((node) => (node.scrollTop = 105));
  await page.waitForFunction(
    (y) => window.__skkUI.querySelector('.inline-preedit')!.getBoundingClientRect().top < y - 15,
    scrolled.y,
  );
  await field.evaluate((node) => (node.scrollTop = node.scrollHeight));
  await inline.waitFor({ state: 'hidden' });
  await field.evaluate((node) => (node.scrollTop = 84));
  await inline.waitFor({ state: 'visible' });
  assert.equal(await inline.textContent(), 'k');
  await page.keyboard.press('Backspace');
  await inline.waitFor({ state: 'hidden' });
  assert.equal(await field.inputValue(), lines);

  // A non-wrapping Markdown draft can also scroll its caret horizontally.
  const longLine = '1234567890'.repeat(12);
  await field.fill(longLine);
  await field.evaluate((node) => {
    const textarea = node as HTMLTextAreaElement;
    textarea.wrap = 'off';
    textarea.setSelectionRange(42, 42);
    textarea.scrollLeft = 300;
  });
  await page.keyboard.type('k');
  await inline.waitFor({ state: 'visible' });
  const horizontal = await box(inline);
  await field.evaluate((node) => (node.scrollLeft = 320));
  await page.waitForFunction(
    (x) => window.__skkUI.querySelector('.inline-preedit')!.getBoundingClientRect().left < x - 15,
    horizontal.x,
  );
  await field.evaluate((node) => (node.scrollLeft = 0));
  await inline.waitFor({ state: 'hidden' });
  await field.evaluate((node) => (node.scrollLeft = 300));
  await inline.waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await inline.waitFor({ state: 'hidden' });
  assert.equal(await field.inputValue(), longLine);
  await field.evaluate((node) => ((node as HTMLTextAreaElement).wrap = 'soft'));

  // Selection direction controls the preview anchor. The selected text
  // remains intact until kana is committed.
  await field.fill('alpha OLD omega');
  const anchor = async (direction: 'backward' | 'forward') => {
    await field.evaluate((node, direction) => {
      (node as HTMLTextAreaElement).setSelectionRange(6, 9, direction);
    }, direction);
    await page.keyboard.type('k');
    await inline.waitFor({ state: 'visible' });
    assert.equal(await field.inputValue(), 'alpha OLD omega');
    return (await box(inline)).x;
  };
  const backward = await anchor('backward');
  await page.keyboard.press('Escape');
  await inline.waitFor({ state: 'hidden' });
  const forward = await anchor('forward');
  assert.ok(forward > backward + 10);
  await page.keyboard.type('a');
  assert.equal(await field.inputValue(), 'alpha か omega');
  await inline.waitFor({ state: 'hidden' });
}
