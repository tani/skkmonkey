import assert from 'node:assert/strict';

export async function runScenarios(page, name, errors) {
  const names = await page.evaluate(() => Object.keys(window.fixture));
  async function model(id) {
    return page.evaluate((id) => window.fixture[id].get(), id);
  }
  async function expectModel(id, text) {
    try {
      await page.waitForFunction(([id, text]) => window.fixture[id].get() === text, [id, text]);
    } catch (error) {
      console.log(
        'DEBUG',
        await page.evaluate(
          (id) => ({
            model: window.fixture[id].get(),
            active: document.activeElement?.outerHTML,
            preedit: window.skkUI?.querySelector('.preedit')?.textContent,
            note: window.skkUI?.querySelector('.note')?.textContent,
            events: window.debugEvents.slice(-15),
          }),
          id,
        ),
      );
      throw error;
    }
  }
  async function reset(id, text = '') {
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.evaluate(
      ([id, text]) => {
        window.fixture[id].set(text);
        window.fixture[id].focus();
      },
      [id, text],
    );
    await page.keyboard.press('Control+j');
    // Allow the editor to update its hidden input / native EditContext.
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
  }
  for (const id of names) {
    console.log(`${name}/${id}: starting`);
    await reset(id);
    await page.keyboard.type("kon'nichiha");
    await expectModel(id, 'こんにちは');
    if (id === 'monaco-native') {
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      assert.equal(
        await page.evaluate(() => document.activeElement.editContext.text),
        'こんにちは',
      );
    }
    await reset(id);
    await page.keyboard.type('lABC');
    await expectModel(id, 'ABC');
    await page.keyboard.press('Control+j');
    await page.keyboard.type('kana');
    await expectModel(id, 'ABCかな');
    await reset(id);
    await page.keyboard.type('Kanji');
    assert.equal(await model(id), '');
    await page.keyboard.press('Space');
    const first = await page.evaluate(() =>
      window.skkUI.querySelector('.preedit').textContent.slice(1),
    );
    await page.keyboard.press('Space');
    await page.keyboard.press('x');
    await page.keyboard.press('Enter');
    await expectModel(id, first);
    await reset(id);
    await page.keyboard.type('KaKu');
    await page.keyboard.press('Enter');
    await expectModel(id, '書く');
    await reset(id, 'alpha OLD omega');
    await page.evaluate((id) => window.fixture[id].select(6, 9), id);
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    await page.keyboard.type('Nihon ');
    await page.keyboard.press('Enter');
    await expectModel(id, 'alpha 日本 omega');
    await page.keyboard.press('Control+z');
    await expectModel(id, 'alpha OLD omega');
    await page.keyboard.press(id === 'quill' ? 'Control+Shift+z' : 'Control+y');
    await expectModel(id, 'alpha 日本 omega');

    // Direct kana commits happen syllable by syllable. Each commit must keep
    // the editor model selection at the insertion point instead of falling
    // back to the end of the document after a component rerender.
    await reset(id, 'alpha OLD omega');
    await page.evaluate((id) => window.fixture[id].select(6, 9), id);
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    await page.keyboard.type('kana');
    await expectModel(id, 'alpha かな omega');

    await reset(id, 'alpha omega');
    await page.evaluate((id) => window.fixture[id].select(6, 6), id);
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    await page.keyboard.type('kana');
    await expectModel(id, 'alpha かなomega');
    await reset(id);
    await page.keyboard.type('Nihon ');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expectModel(id, '');
    await reset(id);
    await page.keyboard.type('Nihon ');
    await page.getByRole('button', { name: /^1\. 日本$/ }).click();
    await expectModel(id, '日本');
    await reset(id, 'prefix:');
    await page.keyboard.type('/fixture-' + id + ' ');
    await page.getByRole('textbox', { name: '登録する単語' }).fill('登録');
    await page.getByRole('button', { name: '登録', exact: true }).click();
    await expectModel(id, 'prefix:登録');
    await reset(id);
    await page.keyboard.type('kana');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.type('a');
    await expectModel(id, 'かあな');
    await reset(id);
    await page.keyboard.type('a');
    await page.keyboard.press('Backspace');
    await expectModel(id, '');
    await reset(id);
    await page.keyboard.type('Nihon');
    await page.evaluate((id) => window.fixture[id].set('external'), id);
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    await page.keyboard.type('a');
    await expectModel(id, 'externalあ');
    await reset(id, 'locked');
    await page.evaluate((id) => window.fixture[id].readonly(true), id);
    await page.keyboard.type('kana');
    assert.equal(await model(id), 'locked');
    await page.evaluate((id) => window.fixture[id].readonly(false), id);
    console.log(
      `${name}/${id}: kana, candidates, okuri, selected replacement, undo/redo, cancel, candidate click, cursor, delete, stale edit, read-only passed`,
    );
  }
  // Rich-text marks are preserved in the model, not merely in rendered DOM.
  if (names.includes('pm')) {
    await reset('pm');
    await page.evaluate(() => {
      window.fixture.pm.marked();
      window.fixture.pm.focus();
    });
    await page.keyboard.type('Nihon ');
    await page.keyboard.press('Enter');
    await expectModel('pm', 'bold日本');
    assert.match(await page.evaluate(() => window.fixture.pm.html()), /<strong>bold日本<\/strong>/);
  }
  for (const id of [
    'monaco',
    ...(names.includes('monaco-native') ? ['monaco-native'] : []),
    'cm5',
    'cm6',
  ].filter((id) => names.includes(id))) {
    await reset(id, 'x\ny');
    await page.evaluate((id) => window.fixture[id].multi(), id);
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    await page.keyboard.type('Nihon ');
    await page.keyboard.press('Enter');
    await expectModel(id, '日本x\n日本y');
  }
  assert.deepEqual(errors, []);
}
