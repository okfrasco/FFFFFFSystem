/**
 * Transport — la fase madre del grafo.
 *
 * Due uscite srotolate: `bar` (1 = una battuta) e `beat` (1 = un beat).
 * Il tempo si integra tick per tick, quindi cambiare BPM (anche modulandolo)
 * non fa saltare la fase. Il metro cambia solo all'inizio della battuta
 * successiva, come in una DAW: i confini di battuta restano su un beat.
 *
 * Per ora il BPM è interno; la sync con Bitwig arriva con Transport In.
 */

import type { ModuleDefinition, ModuleInstance, ProcessContext, Inputs, Outputs } from '../../../core/types';

interface TransportState {
  /** Beat trascorsi (srotolati). */
  beats: number;
  /** Battuta e beat dell'ultimo cambio di metro. */
  barBase: number;
  beatBase: number;
  /** Beat per battuta in vigore. */
  bpb: number;
  started: boolean;
}

const initialState = (): TransportState => ({ beats: 0, barBase: 0, beatBase: 0, bpb: 4, started: false });

export const transport: ModuleDefinition = {
  manifest: {
    id: 'transport',
    name: 'Transport',
    category: 'phase',
    rate: 'control',
    inputs: [],
    outputs: [
      { id: 'bar', type: 'phase' },
      { id: 'beat', type: 'phase' },
      { id: 'tempo', type: 'control', signal: 'value' },
    ],
    params: [
      { id: 'bpm', label: 'BPM', min: 20, max: 300, default: 120, kind: 'continuous' },
      { id: 'meter', label: 'Beat per battuta', min: 1, max: 16, default: 4, kind: 'discrete' },
    ],
    seeded: false,
  },

  create(): ModuleInstance {
    let s = initialState();
    const barsAt = (beats: number): number => s.barBase + (beats - s.beatBase) / s.bpb;

    return {
      process(ctx: ProcessContext, _inputs: Inputs, outputs: Outputs): void {
        if (!s.started) {
          s.bpb = ctx.discrete('meter', 0);
          s.started = true;
        }
        const beatsStart = s.beats;
        const beatsEnd = beatsStart + (ctx.dt * ctx.param('bpm')) / 60;
        const barsStart = barsAt(beatsStart);
        let barsEnd = barsAt(beatsEnd);

        // Cambio di metro: solo se in questo tick si passa per un inizio di battuta.
        const nextBar = Math.floor(barsEnd);
        if (nextBar > Math.floor(barsStart)) {
          const want = ctx.discrete('meter', nextBar);
          if (want !== s.bpb) {
            s.beatBase = s.beatBase + (nextBar - s.barBase) * s.bpb;
            s.barBase = nextBar;
            s.bpb = want;
            barsEnd = barsAt(beatsEnd);
          }
        }
        s.beats = beatsEnd;

        const bar = outputs.phase('bar');
        bar.start[0] = barsStart;
        bar.end[0] = barsEnd;
        const beat = outputs.phase('beat');
        beat.start[0] = beatsStart;
        beat.end[0] = beatsEnd;
        outputs.control('tempo').values[0] = ctx.param('bpm');
      },
      getState: () => ({ ...s }),
      setState(state: unknown): void {
        s = { ...initialState(), ...(state as Partial<TransportState>) };
      },
    };
  },
};

export default transport;
