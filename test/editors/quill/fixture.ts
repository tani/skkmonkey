import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { fixtures, container } from '../shared/fixture.ts';

const quill = new Quill(container('quill'), { theme: 'snow', modules: { toolbar: false, history: { userOnly: true } } });
fixtures.quill = {
  get: () => quill.getText().replace(/\n$/, ''), focus: () => quill.focus(),
  set: (value: string) => { quill.setText(value); quill.setSelection(value.length, 0); quill.history.clear(); },
  select: (from: number, to: number) => quill.setSelection(from, to - from),
  readonly: (value: boolean) => quill.enable(!value),
  html: () => quill.root.innerHTML,
};
