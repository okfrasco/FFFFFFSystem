/** Menu per aggiungere un nodo: ricerca per nome, id o categoria. */

import type { Registry } from '../../core/registry';
import type { ModuleCategory } from '../../core/types';

const CATEGORY_LABEL: Record<ModuleCategory, string> = {
  phase: 'Fase',
  generators: 'Generatori',
  logic: 'Logica',
  transform: 'Trasformazioni',
  harmony: 'Armonia',
  audio: 'Audio',
  effects: 'Effetti',
  visual: 'Visual',
  groove: 'Groove',
  io: 'I/O',
  ideas: 'Idee',
};
const ORDER = Object.keys(CATEGORY_LABEL) as ModuleCategory[];

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function openAddMenu(
  container: HTMLElement,
  at: { x: number; y: number },
  registry: Registry,
  pick: (moduleId: string) => void,
): void {
  container.querySelector('.addmenu')?.remove();
  const menu = document.createElement('div');
  menu.className = 'addmenu';
  menu.style.left = `${Math.min(at.x, container.clientWidth - 260)}px`;
  menu.style.top = `${Math.min(at.y, container.clientHeight - 360)}px`;
  menu.innerHTML = '<input placeholder="aggiungi nodo…" spellcheck="false"><div class="list"></div>';
  const input = menu.querySelector('input') as HTMLInputElement;
  const list = menu.querySelector('.list') as HTMLElement;
  container.append(menu);

  const all = [...registry.values()].map((d) => d.manifest);
  let items: string[] = [];
  let active = 0;

  const close = () => {
    menu.remove();
    window.removeEventListener('pointerdown', outside, true);
  };
  const outside = (e: PointerEvent) => {
    if (!menu.contains(e.target as Node)) close();
  };
  const choose = (id: string | undefined) => {
    close();
    if (id) pick(id);
  };

  const render = () => {
    const q = fold(input.value.trim());
    list.innerHTML = '';
    items = [];
    for (const cat of ORDER) {
      const mods = all.filter(
        (m) => m.category === cat && (!q || fold(`${m.name} ${m.id} ${CATEGORY_LABEL[cat]}`).includes(q)),
      );
      if (!mods.length) continue;
      const h = document.createElement('div');
      h.className = 'cat';
      h.textContent = CATEGORY_LABEL[cat];
      list.append(h);
      for (const m of mods) {
        const it = document.createElement('div');
        it.className = 'item';
        it.innerHTML = `<b></b><span></span>`;
        (it.children[0] as HTMLElement).textContent = m.name;
        (it.children[1] as HTMLElement).textContent = m.id;
        const idx = items.length;
        it.addEventListener('pointerenter', () => setActive(idx));
        it.addEventListener('click', () => choose(m.id));
        list.append(it);
        items.push(m.id);
      }
    }
    setActive(0);
  };
  const setActive = (i: number) => {
    active = Math.max(0, Math.min(items.length - 1, i));
    list.querySelectorAll('.item').forEach((el, k) => el.classList.toggle('act', k === active));
    list.querySelectorAll('.item')[active]?.scrollIntoView({ block: 'nearest' });
  };

  input.addEventListener('input', render);
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'ArrowDown') setActive(active + 1);
    else if (e.key === 'ArrowUp') setActive(active - 1);
    else if (e.key === 'Enter') choose(items[active]);
    else if (e.key === 'Escape') close();
    else return;
    e.preventDefault();
  });
  menu.addEventListener('pointerdown', (e) => e.stopPropagation());
  window.addEventListener('pointerdown', outside, true);
  render();
  input.focus();
}
