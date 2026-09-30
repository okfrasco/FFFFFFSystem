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
  core/        tipi, grafo, scheduler, rng, scene e morph, divisione della patch
  modules/     un modulo = una cartella: <categoria>/<id>/ con index.ts (export default),
               e se servono widget.ts, view.ts, shader.frag, index.test.ts, NOTE.md.
               Le cartelle si registrano da sole (modules/index.ts). Categorie:
               phase, generators, logic, transform, harmony, groove, data, audio, effects, visual, io, ideas.
               _internal/ = ponti e sonde, non compaiono nel menu.
  worklet/     processor dell'AudioWorklet (fa girare la parte audio del grafo)
  visual/      renderer WebGL2 dei nodi visual e utilità GL
  ui/          editor a nodi e host del browser
tests/         test del core, helper di simulazione, patch di esempio
scripts/       nuovo.mjs: scheletro di un modulo
```

Guida pratica per scrivere un modulo (cartella, rate, view, widget, test, modifica dal vivo): `src/modules/LEGGIMI.md`.

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
- Un modulo per cartella, con `index.test.ts` che verifica output deterministici a seed fisso. Per iniziarne uno: `npm run nuovo -- <categoria> <id> [control|audio|frame]`.
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

Dopo il v0 (M9):
- i moduli sono cartelle che si registrano da sole, con lo scheletro `npm run nuovo`;
- la modifica dal vivo di moduli, widget e view (i moduli audio ricaricano la pagina);
- ogni nodo ha una grafica animata: view dedicate per 18 moduli, generica per gli altri;
- oscilloscopi dal worklet e miniature dei visual.

Dopo M9:
- Clock (fase → trigger e gate);
- blocco groove: Ø Bend, Ø Swing, Ø Drift;
- più schermi: una finestra per ogni nodo Schermo, staccabile in una finestra del browser;
- modulatori: LFO, Random walk, Turing Machine;
- suono: Shaper (fold, satura, Chebyshev), Karplus-Strong;
- visual: Transform (kaleido, tile, specchi).

Con questi il primo giro di moduli concordato è completo.

Secondo giro: si prosegue con il catalogo di SPEC.md, una sezione alla volta (priorità dell'utente).
- Fatto: "Trasformazioni di controllo" (Math, Scale/Offset, Lag, Sample & Hold, Mod Mixer, Blend, Fold/Wrap, Quantize a scalini, Echo, Densità, Humanize) e S&H Random.
- Fatto: "Logica e trigger" (Porte logiche, Comparatore, Latch, N-Latch, Clock Divide/Multiply, Clock Quantize, Gate Length, Gate Repeat, Logic Delay, Counter, Shift Register, Condizione, Router).
- Fatto: "Ritmici" (Euclideo multistrato, Cicli, Burst, Ratchet, Spark, Setaccio).
- Fatto: "Algoritmici" (Automa 1D, Game of Life, Mappa logistica, Attrattore, Serie infinita, Sequenza numerica).
- Fatto: "Stile e genere" (Rhythm, Style Blend, Pattern, Motif, Acid). La libreria dei generi è in generators/rhythm/genres.ts: 8 generi, 16 step di probabilità per strumento più le linee di basso e di lead. Voci ha anche il legato.
- Fatto: "Continui" (Curve, Noise) e Curve map. L'editor di curve comune sta in ui/editor/curveWidget.ts.
- Fatto: "Groove e microtempo" (categoria groove/): Swing continuo, Tupla, Griglia polimetrica, Grid Blend, Offset per voce, Groove template, Snare displacement, Drift correlato, Accento → ritardo, Flam/Ghost. Gli spostamenti di eventi passano da `emitShifted` (core/eventQueue.ts): ritardo libero, anticipo al massimo 60 ms (MAX_EARLY, dentro il lookahead).
- Fatto: "Dati e lookup" (categoria data/): Accents, Pitches (piano roll), Probabilities (anche come filtro), Slopes (punti con curvatura), Array (registrabile, tabella nello stato), Tabella 2D, MIDI Clip (parser SMF in data/midiClip/smf.ts, note salvate nella patch). Steps e Gates restano in generators/. Aiuti per i widget a canvas in ui/editor/widgetKit.ts (canvasPanel, onDrag, inputPhase).
- Fatto: "Armonia e pitch": Campo armonico, Sus Slash (il motore dell'utente, tabelle in harmony/theory.ts: SUS_VARIANTS), Accordi, Voice leading, Tonnetz, Cerchio delle quinte (per quinte o per brightness modale), Tensione, Arp, Strum, Transpose/Octave, Tuning (preset e file .scl); Quantize legge il campo. Il campo viaggia su tre porte (chord, scale a 12 voci, change): vedi SPEC.md.

L'utente vuole un sistema "il più visual possibile" e ora si concentra sul fare tanti moduli (synth, effetti, generatori, visual): ogni modulo nuovo va fatto con una view che mostri cosa fa.

Prossimi passi possibili: nuovi moduli, altri nodi dal catalogo di SPEC.md, MIDI In/Out, il porting verso il plugin.

Idee in attesa (discusse, non ancora decise):
- **FM/PM.**
  - Oggi si fa con l'ingresso `pm` dell'Oscillatore, al campione.
  - Il feedback tra oscillatori non passa dal grafo: un ciclo ha 128 campioni di ritardo.
  - Opzione A: aggiungere all'Oscillatore Ratio, Feedback interno e un ingresso `fm` lineare.
  - Opzione B (preferita): un modulo "FM" a 4–6 operatori con una matrice di modulazione modulabile e morphabile (diagonale = feedback), con la view che disegna l'algoritmo come grafo.
