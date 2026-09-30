/**
 * Assioma e regole dell'L-system. Una regola per riga, nella forma F=F+F-F.
 * Si applica quando il campo perde il fuoco (o con Cmd/Ctrl+Invio).
 */

import { expandLSystem, type LSystemConfig } from './index';
import type { EditorApi, Widget } from '../../../ui/editor/api';
import { configOf } from '../../../ui/editor/widgetKit';

export function parseRules(text: string): Record<string, string> {
  const rules: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const i = line.indexOf('=');
    if (i < 1) continue;
    const key = line.slice(0, i).trim();
    if (key.length === 1) rules[key] = line.slice(i + 1).trim();
  }
  return rules;
}

export function lsystemWidget(api: EditorApi, nodeId: string): Widget {
  const el = document.createElement('div');
  el.className = 'widget lsys';
  el.innerHTML = `<div class="wtitle">assioma</div><input spellcheck="false">
    <div class="wtitle">regole · F suona, f . pausa, + − grado, [ ] ramo</div><textarea spellcheck="false"></textarea>
    <div class="expanded"></div>`;
  const axiom = el.querySelector('input') as HTMLInputElement;
  const rules = el.querySelector('textarea') as HTMLTextAreaElement;
  const expanded = el.querySelector('.expanded') as HTMLElement;
  for (const f of [axiom, rules]) f.addEventListener('pointerdown', (e) => e.stopPropagation());

  const cfg = () => configOf<LSystemConfig>(api, nodeId);
  let shown = '';
  let previewKey = '';
  const render = () => {
    const c = cfg();
    if (document.activeElement !== axiom) axiom.value = c.axiom;
    if (document.activeElement !== rules) rules.value = Object.entries(c.rules).map(([k, v]) => `${k}=${v}`).join('\n');
    shown = JSON.stringify(c);
  };
  const apply = () => {
    const next: LSystemConfig = { axiom: axiom.value.trim() || 'F', rules: parseRules(rules.value) };
    if (JSON.stringify(next) === JSON.stringify(cfg())) return;
    api.setConfig(nodeId, next);
    api.commit();
  };
  axiom.addEventListener('change', apply);
  rules.addEventListener('change', apply);
  for (const f of [axiom, rules] as HTMLElement[]) {
    f.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || f === axiom)) {
        e.preventDefault();
        apply();
      }
    });
  }

  render();
  return {
    el,
    handles: () => false,
    update() {
      const c = cfg();
      if (JSON.stringify(c) !== shown) render();
      const it = api.engine.graph.node(nodeId).params.getBase('iterations');
      const key = `${shown}|${it}`;
      if (key === previewKey) return;
      previewKey = key;
      const s = expandLSystem(c, it);
      expanded.textContent = `${s.length} simboli: ${s.slice(0, 96)}${s.length > 96 ? '…' : ''}`;
    },
  };
}

export default lsystemWidget;
