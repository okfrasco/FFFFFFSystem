/** Stile dell'editor a nodi. I colori delle porte seguono il tipo di segnale. */

export const PORT_COLORS: Record<string, string> = {
  phase: '#5ad1ff',
  value: '#c6ff4d',
  gate: '#ffd23d',
  event: '#ff9d3d',
  audio: '#ff4d6d',
  texture: '#b77dff',
};

export const EDITOR_CSS = `
:root { color-scheme: dark; --bg: #0b0b0d; --panel: #141418; --line: #26262e; --text: #d8d8d8; --dim: #7a7a86; --accent: #fff; }
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: var(--bg); color: var(--text); font: 11px/1.35 ui-monospace, Menlo, monospace; overflow: hidden; }
.app { position: fixed; inset: 0; display: flex; flex-direction: column; }
.toolbar { display: flex; gap: 6px; align-items: center; padding: 6px 10px; border-bottom: 1px solid var(--line); background: #0f0f12; flex-wrap: wrap; }
.toolbar h1 { font-size: 11px; letter-spacing: .12em; margin: 0 10px 0 0; color: #fff; font-weight: 600; }
.toolbar button { font: inherit; background: #1d1d23; color: var(--text); border: 1px solid #2c2c35; padding: 5px 9px; cursor: pointer; }
.toolbar button:hover { border-color: #555; }
.toolbar button.play { background: #fff; color: #000; border-color: #fff; min-width: 64px; }
.toolbar button.play[data-on="1"] { background: #ff4d3d; border-color: #ff4d3d; color: #fff; }
.toolbar .pos { font-size: 16px; color: #fff; min-width: 64px; margin: 0 6px; font-variant-numeric: tabular-nums; }
.toolbar .sep { width: 1px; height: 20px; background: var(--line); margin: 0 4px; }
.toolbar .status { color: var(--dim); margin-left: auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 50vw; }
.toolbar .status.err { color: #ff6b5d; }
.canvas { position: relative; flex: 1; overflow: hidden; cursor: default;
  background-image: radial-gradient(#1c1c22 1px, transparent 1px); background-size: 24px 24px; }
.canvas.panning { cursor: grabbing; }
.world { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
svg.cables { position: absolute; left: 0; top: 0; width: 1px; height: 1px; overflow: visible; pointer-events: none; }
svg.cables path.hit { stroke: transparent; stroke-width: 12; fill: none; pointer-events: stroke; cursor: pointer; }
svg.cables path.wire { fill: none; stroke-width: 2; opacity: .85; }
svg.cables path.wire.mod { stroke-dasharray: 5 4; stroke-width: 1.5; }
svg.cables path.wire.sel { stroke-width: 3.5; opacity: 1; filter: drop-shadow(0 0 3px #fff8); }
svg.cables g.amount { pointer-events: all; cursor: ns-resize; }
svg.cables g.amount rect { fill: #0b0b0d; stroke: #444; }
svg.cables g.amount text { fill: #ddd; font: 10px ui-monospace, Menlo, monospace; }
.node { position: absolute; min-width: 190px; max-width: 280px; background: var(--panel); border: 1px solid var(--line); box-shadow: 0 6px 18px #0008; }
.node.sel { border-color: #fff; }
.node .head { display: flex; align-items: center; gap: 6px; padding: 5px 7px; background: #1c1c22; cursor: grab; user-select: none; }
.node .head .id { color: #fff; font-weight: 600; }
.node .head .mod { color: var(--dim); flex: 1; }
.node .head .x { color: var(--dim); cursor: pointer; padding: 0 2px; }
.node .head .x:hover { color: #ff6b5d; }
.node canvas.view { display: block; width: 100%; background: #0e0e11; border-bottom: 1px solid #1c1c22; }
.node .ports { display: flex; justify-content: space-between; padding: 4px 0; gap: 10px; }
.node .ports .col { display: flex; flex-direction: column; gap: 3px; }
.node .ports .col.out { align-items: flex-end; }
.port { display: flex; align-items: center; gap: 5px; color: #aaa; cursor: crosshair; user-select: none; }
.port .dot { width: 10px; height: 10px; border-radius: 50%; border: 2px solid currentColor; background: #0b0b0d; flex: none; }
.col.in .port { margin-left: -6px; }
.col.out .port { margin-right: -6px; }
.port.flash .dot { background: currentColor; box-shadow: 0 0 8px currentColor; }
.port .label { color: #aaa; }
.params { padding: 2px 7px 7px; display: flex; flex-direction: column; gap: 2px; }
.prow { display: grid; grid-template-columns: 9px 78px 1fr; gap: 5px; align-items: center; }
.prow .mt { width: 7px; height: 7px; border-radius: 50%; border: 1px solid #444; cursor: crosshair; }
.prow .mt.on { background: #c6ff4d; border-color: #c6ff4d; }
.prow .pl { color: #999; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.bar { position: relative; height: 15px; background: #0e0e11; border: 1px solid #25252c; cursor: ew-resize; user-select: none; }
.bar .fill { position: absolute; inset: 0 auto 0 0; background: #2f3a4a; }
.bar .modmark { position: absolute; top: -1px; bottom: -1px; width: 2px; background: #c6ff4d; display: none; }
.bar.modded .modmark { display: block; }
.bar .val { position: absolute; right: 4px; top: 0; line-height: 13px; color: #ddd; pointer-events: none; }
.prow select { font: inherit; background: #0e0e11; color: #ddd; border: 1px solid #25252c; height: 17px; }
.dragging-cable .target-ok { outline: 2px solid #c6ff4d; outline-offset: 1px; }
.widget { padding: 4px 7px 7px; }
.widget .wtitle { color: var(--dim); margin: 4px 0 3px; display: flex; gap: 6px; align-items: center; }
.widget .wtitle button { font: inherit; background: #1d1d23; color: #ccc; border: 1px solid #2c2c35; padding: 0 5px; cursor: pointer; }
.matrix { display: grid; gap: 1px; background: #0b0b0d; user-select: none; }
.matrix .cell { width: 15px; height: 15px; background: #2a2f38; position: relative; cursor: ns-resize; }
.matrix .cell.cur { outline: 1px solid #fff5; }
.matrix .cell.hit { box-shadow: inset 0 0 0 2px #fff; }
.matrix .cell.modded::after { content: ''; position: absolute; right: 1px; top: 1px; width: 3px; height: 3px; background: #c6ff4d; }
.matrix .lab { width: 15px; height: 15px; color: #666; font-size: 9px; text-align: center; line-height: 15px; }
.matrix .vcell { width: 15px; height: 15px; color: #ddd; font-size: 9px; text-align: center; line-height: 15px; background: #1d1d23; cursor: ns-resize; }
.matrix .acell { width: 15px; height: 15px; background: #1d1d23; position: relative; cursor: ns-resize; }
.matrix .acell i { position: absolute; left: 0; right: 0; bottom: 0; background: #ffd23d; }
.bars { display: flex; gap: 1px; height: 64px; align-items: stretch; background: #0e0e11; border: 1px solid #25252c; cursor: crosshair; user-select: none; }
.bars .b { flex: 1; position: relative; min-width: 6px; }
.bars .b i { position: absolute; left: 0; right: 0; background: #5ad1ff; }
.bars .b.zero { border-bottom: 1px solid #333; }
.gates { display: flex; gap: 2px; user-select: none; flex-wrap: wrap; }
.gates .g { width: 13px; height: 22px; background: #1d1d23; position: relative; cursor: pointer; }
.gates .g i { position: absolute; left: 0; right: 0; bottom: 0; background: #ffd23d; }
.gates .g.q { margin-left: 3px; }
.lsys input, .lsys textarea { width: 100%; font: inherit; background: #0e0e11; color: #ddd; border: 1px solid #25252c; padding: 3px; }
.lsys textarea { height: 52px; resize: vertical; }
.lsys .expanded { color: #777; word-break: break-all; margin-top: 3px; max-height: 3.2em; overflow: hidden; }
.addmenu { position: absolute; z-index: 10; width: 250px; background: #16161b; border: 1px solid #3a3a44; box-shadow: 0 10px 30px #000a; }
.addmenu input { width: 100%; font: inherit; background: #0e0e11; color: #fff; border: 0; border-bottom: 1px solid #333; padding: 7px; outline: none; }
.addmenu .list { max-height: 320px; overflow: auto; }
.addmenu .cat { color: #666; padding: 5px 7px 2px; text-transform: uppercase; letter-spacing: .1em; font-size: 9px; }
.addmenu .item { padding: 4px 10px; cursor: pointer; display: flex; justify-content: space-between; }
.addmenu .item span { color: #666; }
.addmenu .item.act { background: #2a2a33; color: #fff; }
.help { position: absolute; right: 10px; bottom: 10px; color: #555; text-align: right; pointer-events: none; line-height: 1.6; }

.viewer { position: absolute; width: 480px; height: 300px; z-index: 5; background: #000; border: 1px solid #333;
  resize: both; overflow: hidden; min-width: 160px; min-height: 100px; box-shadow: 0 10px 30px #000a; display: flex; flex-direction: column; }
.viewer.hidden { display: none; }
.viewer .vbar { display: flex; gap: 6px; align-items: center; padding: 3px 6px; background: #141418; cursor: move; user-select: none; color: #888; }
.viewer .vbar span { flex: 1; }
.viewer .vbar button { font: inherit; background: none; border: 0; color: #aaa; cursor: pointer; padding: 0 3px; }
.viewer canvas { flex: 1; width: 100%; min-height: 0; display: block; background: #000; }
.viewer:fullscreen .vbar { display: none; }
.viewer .popped { display: none; flex: 1; align-items: center; justify-content: center; color: #666; }
.viewer.is-popped canvas { display: none; }
.viewer.is-popped .popped { display: flex; }
.scenebar { display: flex; gap: 6px; align-items: center; padding: 6px 10px; border-top: 1px solid var(--line); background: #0f0f12; flex-wrap: wrap; }
.scenebar .lab { color: #666; letter-spacing: .12em; font-size: 10px; }
.scenebar .list { display: flex; gap: 4px; flex-wrap: wrap; }
.scenebar button, .scenebar select, .scenebar input[type=number] { font: inherit; background: #1d1d23; color: var(--text); border: 1px solid #2c2c35; padding: 4px 8px; cursor: pointer; }
.scenebar input[type=number] { width: 56px; cursor: text; }
.scenebar button.scene { background: #232330; border-color: #3a3a4a; color: #fff; min-width: 38px; }
.scenebar button:hover { border-color: #666; }
.scenebar input[type=range] { width: 220px; }
.scenebar .sep { width: 1px; height: 20px; background: var(--line); margin: 0 6px; }
.scenebar .prog { color: #c6ff4d; min-width: 36px; }
.scenebar label { color: #888; }
.node .head .seed { color: #777; cursor: pointer; font-size: 10px; }
.node .head .seed:hover { color: #fff; }
`;
