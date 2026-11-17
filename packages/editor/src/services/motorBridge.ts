// Bridge to the Jogo Stickman World Engine (Motor de Mundo), which embeds this editor in a same-origin iframe opened
// with `?motor=1`. The engine sends the character to animate (`motor-abrir`); every file the editor would download
// (animation-only GLB, baked model, VRMA, project) goes to the engine instead (`ekza-arquivo`), which stores it in
// the game's asset bucket. Outside that iframe nothing here does anything. Messages only cross the same origin.

export interface MotorFile {
  readonly tipo: 'ekza-arquivo';
  readonly nome: string;
  readonly bytes: Uint8Array;
  readonly mime: string;
}

interface OpenRequest {
  readonly tipo: 'motor-abrir';
  readonly nome: string;
  readonly bytes: Uint8Array;
}

/** True inside the World Engine's iframe (same origin, `?motor=1`). */
export function inWorldEngine(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      window.parent !== window &&
      new URLSearchParams(window.location.search).has('motor') &&
      window.parent.location.origin === window.location.origin
    );
  } catch {
    return false; // a cross-origin parent throws on .location: not the engine
  }
}

/** Hands a file to the engine instead of downloading it. False outside the engine (the caller downloads). */
export function sendToWorldEngine(nome: string, bytes: Uint8Array, mime: string): boolean {
  if (!inWorldEngine()) return false;
  const message: MotorFile = { tipo: 'ekza-arquivo', nome, bytes: bytes.slice(), mime };
  window.parent.postMessage(message, window.location.origin);
  return true;
}

function isOpenRequest(data: unknown): data is OpenRequest {
  const m = data as Partial<OpenRequest> | null;
  return !!m && m.tipo === 'motor-abrir' && typeof m.nome === 'string' && m.bytes instanceof Uint8Array;
}

/** Opens files the engine sends and tells it the editor is ready. Returns the disposer. */
export function listenWorldEngine(open: (nome: string, bytes: Uint8Array) => Promise<void>): () => void {
  if (!inWorldEngine()) return () => {};
  const onMessage = (event: MessageEvent): void => {
    if (event.origin !== window.location.origin || event.source !== window.parent || !isOpenRequest(event.data)) return;
    void open(event.data.nome, event.data.bytes);
  };
  window.addEventListener('message', onMessage);
  window.parent.postMessage({ tipo: 'ekza-pronto' }, window.location.origin);
  return () => window.removeEventListener('message', onMessage);
}
