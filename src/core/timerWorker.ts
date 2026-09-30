/// <reference lib="webworker" />
// Sveglia lo scheduler a intervalli regolari. Non decide il tempo musicale:
// quello viene dal clock dell'AudioContext (vedi scheduler.ts).

let timer: ReturnType<typeof setInterval> | undefined;

self.onmessage = (e: MessageEvent<{ interval: number }>) => {
  if (timer !== undefined) clearInterval(timer);
  timer = undefined;
  if (e.data.interval > 0) timer = setInterval(() => self.postMessage(0), e.data.interval);
};
