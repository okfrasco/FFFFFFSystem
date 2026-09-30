/** Campo per l'espressione del Setaccio, con l'errore se non è valida. */

import type { EditorApi, Widget } from '../../../ui/editor/api';
import { configOf } from '../../../ui/editor/widgetKit';
import { parseSieve, type SieveConfig } from './index';

export function sieveWidget(api: EditorApi, nodeId: string): Widget {
  const el = document.createElement('div');
  el.className = 'widget lsys';
  el.innerHTML = `<div class="wtitle">espressione · m@r | & ~ ( )</div><input spellcheck="false"><div class="expanded"></div>`;
  const input = el.querySelector('input') as HTMLInputElement;
  const info = el.querySelector('.expanded') as HTMLElement;
  input.addEventListener('pointerdown', (e) => e.stopPropagation());
  const check = () => {
    try {
      parseSieve(input.value);
      info.textContent = '';
      return true;
    } catch (e) {
      info.textContent = (e as Error).message;
      info.style.color = '#ff6b5d';
      return false;
    }
  };
  const apply = () => {
    if (!check()) return;
    const next: SieveConfig = { expr: input.value.trim() };
    if (next.expr === configOf<SieveConfig>(api, nodeId).expr) return;
    api.setConfig(nodeId, next);
    api.commit();
  };
  input.addEventListener('input', check);
  input.addEventListener('change', apply);
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') apply();
  });
  let shown = '';
  return {
    el,
    handles: () => false,
    update() {
      const expr = configOf<SieveConfig>(api, nodeId).expr;
      if (expr !== shown && document.activeElement !== input) {
        shown = expr;
        input.value = expr;
        check();
      }
    },
  };
}

export default sieveWidget;
