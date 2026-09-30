# Sistema generativo — musica e visual

Host modulare per sistemi generativi musicali e visivi, pensato per live performance alla Autechre: un grafo di nodi guidato da una fase condivisa, con scene e morph continuo. È un "Max/MSP ad alto livello": i mattoni sono sistemi già musicali e visivi, non operatori elementari.

`SPEC.md` è la specifica completa (catalogo nodi, principi, priorità). È la fonte di verità: leggila prima di ogni task che tocca il contratto o aggiunge nodi.

## Stack (v0)

- TypeScript strict, Vite, Vitest
- Sistema autonomo: genera, suona, processa e fa i visual da solo (niente DAW nel v0; obiettivo futuro: plugin VST)
- Controllo e fase: TypeScript nel main thread, a frequenza di controllo
- Audio: DSP scritto da noi in TypeScript dentro un AudioWorklet (portabile in C++), non i nodi nativi di Web Audio
- MIDI: fuori dal v0; MIDI In/Out arriveranno come nodi
- Visual: WebGL2 + GLSL, un canvas, catena di render target
- UI: editor a nodi in DOM + SVG, senza librerie
- Niente dipendenze nuove senza chiedere

## Struttura

```
src/
  core/        tipi, grafo, scheduler, rng, scene e morph
  modules/     un file per nodo, raggruppati per categoria (phase/, generators/, logic/, transform/, harmony/, visual/, io/)
  shaders/     sorgenti GLSL dei nodi visual
  worklet/     processor dell'AudioWorklet (fa girare la parte audio del grafo)
  visual/      renderer WebGL2 dei nodi visual e utilità GL
  ui/          editor a nodi e host del browser
tests/         un test per ogni modulo
```

## Contratto del modulo

Ogni nodo esporta un manifest e una factory. Forma di riferimento (quella completa e aggiornata è in `src/core/types.ts` e in SPEC.md):

```ts
type PortType = 'phase' | 'control' | 'audio' | 'texture';

interface PortSpec { id: string; type: PortType; poly?: boolean }

interface ParamSpec {
  id: string;
  min: number; max: number; default: number;
  kind: 'continuous' | 'discrete';   // continuo = interpolato, discreto = morph probabilistico
  curve?: 'lin' | 'exp';
  options?: string[];                // per parametri a scelta
}

interface ModuleManifest {
  id: string; name: string; category: string;
  inputs: PortSpec[]; outputs: PortSpec[];
  params: ParamSpec[];
  seeded: boolean;
}

interface ModuleInstance {
  process(ctx: ProcessContext, inputs: Inputs, outputs: Outputs): void;
  getState(): unknown;               // serializzabile in JSON
  setState(state: unknown): void;
}
```

Se il contratto deve cambiare, proponi la modifica, aggiorna `SPEC.md` e tutti i moduli esistenti nello stesso task.

## Regole

- Ogni parametro di ogni nodo accetta modulazione da un segnale di controllo.
- Mai `Math.random` nei moduli: solo l'RNG con seed del core, così scene e morph sono riproducibili.
- La fase è una rampa 0→1; i generatori leggono la fase, non hanno un rate interno.
- Polifonia: ogni porta `poly` porta N voci, ogni voce conosce il proprio indice.
- Timing: lo scheduler usa il clock dell'AudioContext con lookahead e gli eventi portano timestamp esatti; niente `setTimeout` per il tempo musicale.
- Un modulo per file, con test Vitest che verifica output deterministici a seed fisso.
- Lavora a milestone: fermati alla fine di ognuna e riassumi cosa hai fatto e come provarlo.

## Comandi

- `npm run dev` avvia l'host in browser
- `npm test` esegue i test
- `RENDER=1 npx vitest run tests/render.test.ts` esporta la patch di esempio in `render/demo.wav` (senza browser)

## Stato (aggiornato al 2026-09-30)

Il prototipo v0 è completo: milestone M1–M8 fatte, tutte con test (`npm test`).

- **Core** (`src/core/`): contratto (`types.ts`), grafo con ricostruzione che conserva lo stato (`graph.ts`, `engine.ts`), scheduler con lookahead, RNG con seed, scene e morph (`scene.ts`, `morph.ts`), divisione della patch tra main, AudioWorklet e visual (`audioSplit.ts`, `frameSplit.ts`), render offline (`offline.ts`).
- **Nodi**: controllo (Transport, Ø Scale, Ø Split, Euclideo, Gates, Steps, Markov a matrice modulabile, L-system, Cadenza, LFO aliasato, AND, Coin Flip, Memoria, Accoppiamento, Quantize), audio (Voci, Oscillatore, Inviluppo, Filtro, VCA, Drum voice, Delay, Reverb, Mixer, Uscita, Envelope follower), visual (Noise field, Feedback, Colore, Schermo).
- **Editor** (`src/ui/editor/`): nodi e cavi in DOM + SVG, widget dentro i nodi, pannello visual, barra scene e morph.
- **Patch di esempio**: `patches/demo.json`, con le scene S1 e S2.

Decisioni prese con l'utente:
- sistema autonomo, niente DAW né MIDI nel v0;
- obiettivo finale: un plugin VST, quindi il core resta portabile;
- editor a nodi senza librerie;
- la matrice di Markov è fatta di parametri (modulabili e morphabili).

Prossimi passi possibili: i moduli come file che si registrano da soli (una raccolta di idee di synth, visual e generatori), altri nodi dal catalogo di SPEC.md, MIDI In/Out, il porting verso il plugin.
