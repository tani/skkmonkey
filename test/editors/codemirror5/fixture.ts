import CodeMirror from 'codemirror5';
import 'codemirror5/lib/codemirror.css';
import { fixtures, container } from '../shared/fixture.ts';

const cm5 = CodeMirror(container('cm5'), { value: '', lineNumbers: true, inputStyle: 'textarea' });
fixtures.cm5 = {
  get: () => cm5.getValue(),
  focus: () => cm5.focus(),
  set: (value: string) => {
    cm5.setValue(value);
    cm5.setCursor(cm5.posFromIndex(value.length));
    cm5.clearHistory();
  },
  select: (from: number, to: number) =>
    cm5.setSelection(cm5.posFromIndex(from), cm5.posFromIndex(to)),
  readonly: (value: boolean) => cm5.setOption('readOnly', value),
  undo: () => cm5.undo(),
  redo: () => cm5.redo(),
  multi: () =>
    cm5.setSelections([
      { anchor: { line: 0, ch: 0 }, head: { line: 0, ch: 0 } },
      { anchor: { line: 1, ch: 0 }, head: { line: 1, ch: 0 } },
    ]),
};
