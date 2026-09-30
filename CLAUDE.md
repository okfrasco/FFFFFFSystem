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

## Da dove ripartire (aggiornato al 2026-09-30)

Leggi prima questa sezione: sostituisce la memoria delle sessioni passate.

**Dove siamo.** Il v0 (M1–M8) è completo. Si stanno facendo i nodi del catalogo di SPEC.md, una sezione alla volta, nell'ordine scelto dall'utente. Ultimo lavoro finito: la sezione "Audio" (commit "Audio: campioni, Granulare, Sampler/Slicer"). `npm test` dà 488 passati e 1 saltato (il render). Typecheck e build sono puliti.

**Prossimo passo proposto all'utente, senza risposta:** la sezione **"Visual"** di SPEC.md.
- Generatori: SDF, Particelle, Flow field, Reaction-diffusion, Automa texture, L-system geometry, Pattern, Scope, Tipografia, Ingresso.
- Effetti: Displace, Blur/Bloom, Edge, Glitch, Time echo, Composite, Mask.
- Ci sono già: Noise field, Feedback, Colore, Transform, Schermo.

Chiedi conferma prima di partire (vedi "Come lavorare con l'utente").

**Sezioni del catalogo ancora da fare**, dopo Visual:
- "Fase e clock", la parte mai fatta: Phasor, Step Access, Ø Ratio, Ø Pinch, Ø Reset, Ø Reverse/Mirror, Ø Shift, Ø Wrap, Ø Counter. Ci sono già Transport, Ø Scale, Ø Split, Ø Bend, Ø Swing, Ø Drift, Clock.
- "Convertitori e analisi": Onset, Pitch tracker, Bande, Luminosità, Movimento, Colore, Pixel probe, Uniform, CV audio, Note out/in. C'è già Envelope follower.
- "Voci e tabelle dati": Tabella immagine, Scroll, Texture → tabella, Spettro ↔ tabella, Spread, Voice Mix, Voice Router. C'è già Voci.
- "Scene, morph e arrangiamento" come nodi: Scena, Morph A→B, Morph XY, Grafo di scene, Timeline, Energia, Macro, Muta scena, Registratore. Scene e morph esistono già nella barra dell'editor.
- "I/O e integrazione": MIDI Out/In, Transport In, OSC, Video Out, Audio In/Out, Controller, Patch.

**Da confermare con l'utente (Sus Slash).** Le tabelle stanno in `harmony/theory.ts` (`SUS_VARIANTS`).
- Quartale e quintale: usano tutti i bassi, e i più tosti sono gli stessi del sus (♭2 e ♯4). È una scelta mia.
- La scala di sus♯5 è la minore naturale.

## Come lavorare con l'utente

- Scrive in italiano; rispondi in italiano.
- Lavora a sezioni del catalogo. Alla fine di ognuna:
  - test, typecheck, build e un giro nel browser;
  - commit;
  - resoconto con una tabella dei nodi e una lista "Da provare", poi proponi la sezione dopo e aspetta il suo ok.
- Vuole un sistema "il più visual possibile": ogni modulo nuovo ha una `view.ts` che mostra cosa fa, e un widget se c'è qualcosa da disegnare (curve, tabelle, matrici, campioni).
- Il progetto sta in `~/Downloads/FFFFFFSystem` per sua scelta. Git è solo locale, senza remoto: niente push, GitHub non è stato approvato. Nessuna dipendenza nuova senza chiedere.
- L'obiettivo finale è un VST: il core e i moduli restano portabili (niente DOM nei moduli, DSP nostro).

## Verifica

- **Test:** `npm test`.
  - I test dei moduli stanno accanto al modulo.
  - Aiuti in `tests/helpers/sim.ts` (grafo di controllo a battute) e `tests/helpers/audio.ts` (grafo audio a blocchi).
  - Per le altezze: `pitchOf`, `peakFreq`, `toneAt`; per il timbro, `brightness`.
- **Browser:** `npm run dev` (porta 5199), poi `node scripts/browser-check.mjs <patch.json> [secondi] [file.wav] [nodi]`.
  - Carica la patch, preme Play, stampa i livelli audio e le eccezioni, salva `browser-check.png`.
  - In dev l'app espone `window.ffffff = { host, engine }`.
- **Costo:** per i moduli audio pesanti, misura il rapporto con il tempo reale (render di 2 s con `audioSim` e `performance.now()`). Restare sotto ~10% con 8 voci.

## Lezioni e trappole

- **Fase:** dentro un tick la fase è lineare. Uno swing applicato alla fase colloca gli step entro ~1 ms.
- **Eventi e livelli:**
  - un ingresso che ha portato eventi non va mai letto come valore (il Clock tiene alto il livello);
  - i cambi simultanei si applicano insieme.
- **Anticipo:** gli eventi si anticipano al massimo di 60 ms (`MAX_EARLY`, con `emitShifted` in `core/eventQueue.ts`). Il ponte verso il worklet consegna gli eventi anticipati al loro istante.
- **Morph:** nei moduli senza eventi, i discreti si leggono con `ctx.discrete(id, 0)`: una chiave che cambia a ogni tick fa sfarfallare il morph.
- **Parametri esponenziali:** un parametro `curve: 'exp'` torna come 4.000000000000001. Arrotondalo quando serve un valore esatto (MIDI Clip lo fa).
- **Audio nell'editor:**
  - i moduli audio girano solo nel worklet; nel main esistono solo per l'editor, quindi le loro view vedono oscilloscopi e parametri, non lo stato;
  - le memorie grandi si allocano al primo `process`.
- **Autocorrelazione:** con segnali a fasi sovrapposte (grani) sbaglia l'ottava. Usa `peakFreq`/`toneAt`.
- **Bash:**
  - negli heredoc non quotati, niente backtick;
  - in JS, `pos += f()` somma il `pos` di prima se `f` lo fa avanzare.
- **Campioni:** la patch porta solo l'id (`core/samples.ts`). L'audio sta in IndexedDB del browser e non viaggia con la patch né con il repo: su un altro computer va ricaricato nei nodi.

## Stato: cosa c'è

- **Core** (`src/core/`):
  - contratto (`types.ts`) e grafo con ricostruzione che conserva lo stato (`graph.ts`, `engine.ts`);
  - scheduler con lookahead (tick 5 ms, 100 ms avanti) e RNG con seed;
  - scene e morph (`scene.ts`, `morph.ts`);
  - divisione della patch tra main, AudioWorklet e visual (`audioSplit.ts`, `frameSplit.ts`);
  - render offline (`offline.ts`), FFT (`fft.ts`), campioni (`samples.ts`).
- **Editor** (`src/ui/editor/`):
  - nodi e cavi in DOM + SVG, barra scene e morph, più schermi (staccabili);
  - una view animata per ogni nodo;
  - widget comuni: `curveWidget`, `matrixWidget`, `sampleWidget`, `widgetKit` (canvasPanel, onDrag, inputPhase).
- **Moduli** (`src/modules/<categoria>/<id>/`):
  - prima del catalogo: M1–M9 e il primo giro di moduli concordato;
  - sezioni del catalogo fatte: "Trasformazioni di controllo", "Logica e trigger", "Ritmici", "Algoritmici", "Stile e genere", "Continui", "Groove e microtempo", "Dati e lookup", "Armonia e pitch", "Audio";
  - l'elenco completo dei nodi è nel menu dell'editor, o in `src/modules/*/*/`.
- **Convenzioni nate strada facendo:**
  - Il campo armonico viaggia su tre porte: `chord`, `scale` a 12 voci, `change` (vedi SPEC.md).
  - Transport ha l'uscita `tempo` (BPM) per Delay e Buffer.
  - La libreria dei generi è in `generators/rhythm/genres.ts`.
- **Patch di esempio:** `patches/demo.json`, con le scene S1 e S2.

Decisioni prese con l'utente:
- Sistema autonomo, senza DAW; MIDI arriverà come nodi.
- Editor a nodi senza librerie.
- Le matrici (Markov, FM) sono fatte di parametri, quindi modulabili e morphabili.
- Sus Slash è il motore armonico dell'utente.
- FM a operatori con matrice: fatto (audio/fm).
