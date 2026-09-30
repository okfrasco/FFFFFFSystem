# Come si scrive un modulo

Un modulo è una cartella. Si registra da solo: appena esiste, compare nel menu dell'editor.

```
src/modules/<categoria>/<id>/
  index.ts        il modulo: manifest + process (export default)
  index.test.ts   il test a seed fisso
  NOTE.md         l'idea: da dove viene, cosa provare
  view.ts         grafica animata del nodo (facoltativa: senza, c'è quella generica)
  widget.ts       editor dentro il nodo (facoltativo)
  shader.frag     se è un visual
```

Per partire:

```bash
npm run nuovo -- <categoria> <id> [control|audio|frame]
npm run nuovo -- ideas pioggia            # generatore di controllo
npm run nuovo -- effects granulare        # effetto audio
npm run nuovo -- visual caleido           # visual con shader
```

- **`<id>`**: il nome della cartella, uguale al `manifest.id`, in camelCase.
- **`<categoria>`**: una tra phase, generators, logic, transform, harmony, groove, data, audio, effects, visual, io, ideas.
- **Idee non ancora rifinite**: vanno in `ideas/`, se sono di controllo o visual.
- **Moduli audio**: vanno sempre in `audio/`, `effects/` o `io/`, anche se sono ancora idee, perché sono le sole cartelle che l'AudioWorklet carica.

## Il contratto

Il contratto completo è in `src/core/types.ts`, e le regole in `SPEC.md`. In breve:

- **Manifest.** Contiene porte tipizzate (fase, controllo, audio, texture), parametri con range e tipo, e `seeded`.
  - Un parametro `continuous` si interpola nel morph, un parametro `discrete` si morpha evento per evento.
  - Ogni parametro accetta modulazione da un cavo, senza scrivere niente.
- **`process(ctx, inputs, outputs)`** viene chiamato dall'host al rate del modulo.
  - I parametri si leggono con `ctx.param(id)`.
  - I discreti che cambiano per evento si leggono con `ctx.discrete(id, chiaveEvento)`: la chiave serve al morph.
- **Casualità**: solo `ctx.rng`, mai `Math.random`. Così scene e morph sono riproducibili.
- **Stato**: `getState()` e `setState()`, serializzabili in JSON. Servono alle scene e alla modifica dal vivo: quando salvi il file, la versione nuova riparte dallo stato della vecchia.

## I tre rate

**`control`** (generatori, logica, trasformazioni) gira nel main thread a tick di 5 ms, calcolati 100 ms in anticipo.

- La fase si legge dall'ingresso; non c'è un rate interno. `stepCrossings(start, end, steps, t0, t1, swing)` restituisce gli step attraversati nel tick, con l'istante esatto di ciascuno.
- Gli eventi hanno tempo assoluto `t` e vanno in `outputs.control(id).events`: `trig` (con `value` facoltativo), `gate`, `note`.

**`audio`** (synth, effetti) gira nell'AudioWorklet a blocchi di `ctx.frames` campioni.

- Le memorie (linee di ritardo, buffer) si allocano al primo `process`: nel main il modulo viene istanziato solo per l'editor.
- `eventFrame(ctx, t)` dice in quale campione del blocco cade un evento.
- Un segnale stereo è un segnale a 2 voci.

**`frame`** (visual) gira nel renderer a ogni frame, con `ctx.gl`.

- Lo shader sta accanto al modulo e si importa con `import frag from './shader.frag?raw'`.
- `Pass`, `createTarget` e `targetSize` sono in `src/visual/gl.ts`.
- Le velocità vanno al secondo (`ctx.dt`), non per frame.

## La view (grafica animata del nodo)

`view.ts` esporta di default una `ViewFactory` (vedi `src/ui/editor/viewKit.ts`):

```ts
import { C, clear, ring, frac, type ViewFactory } from '../../../ui/editor/viewKit';

const view: ViewFactory = () => ({
  height: 48,
  draw(g, w, h, v) {
    clear(g, w, h);
    ring(g, h / 2, h / 2, h / 2 - 5, frac(v.input.value('phase')), C.phase);
  },
});
export default view;
```

- **Quando disegna**: 30 volte al secondo, all'istante che si sta sentendo.
- **Cosa legge**, tramite `v`:
  - parametri effettivi (`v.param`), stato interno (`v.state()`) e config (`v.config()`);
  - uscite e ingressi: eventi recenti, valore, storia, valori per voce, oscilloscopio audio, miniatura del visual.
- **Primitive** in `viewKit`: anello di fase, traccia, rullo di eventi, oscilloscopio, livello, miniatura.
- **Senza `view.ts`** il nodo usa la view generica: miniatura per le texture, oscilloscopio per l'audio, rullo per gli eventi, traccia per i valori, anello per le fasi.

## Il widget (editor dentro il nodo)

`widget.ts` esporta di default `(api, nodeId) => Widget`. Esempi pronti: la matrice di Markov e le celle di Gates. Gli aiuti comuni stanno in `src/ui/editor/widgetKit.ts`.

## Il test

`index.test.ts` verifica output deterministici a seed fisso. Gli aiuti sono in `tests/helpers/`:

- `simulate(...)`: fa girare una patch di controllo per N battute;
- `audioSim(...)`: fa girare un grafo audio a blocchi;
- `compact(...)`: rende gli eventi leggibili negli snapshot.

## Modifica dal vivo

Con `npm run dev` acceso:

- **Modulo di controllo o visual, widget, view**: salvi il file e cambia mentre suona. Lo stato passa alla versione nuova.
- **Modulo audio**: salvando, la pagina si ricarica (l'AudioWorklet non si ricarica a caldo). La patch resta, grazie al salvataggio automatico; poi si preme di nuovo Play.
