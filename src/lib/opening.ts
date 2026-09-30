/** Decorative opening only: never keep the real UI hidden if initialization stalls. */
export function createOpeningSequence(
  finish: () => void,
  reducedMotion = false,
) {
  let ready = false;
  let elapsed = false;
  let ended = false;
  const complete = () => {
    if (ended) return;
    ended = true;
    clearTimeout(introTimer);
    clearTimeout(safetyTimer);
    finish();
  };
  const introTimer = setTimeout(() => {
    elapsed = true;
    if (ready) complete();
  }, 320);
  const safetyTimer = setTimeout(complete, 3500);
  return {
    setReady(value: boolean) {
      ready = value;
      if (ready && (elapsed || reducedMotion)) complete();
    },
    setReducedMotion(value: boolean) {
      reducedMotion = value;
      if (value && ready) complete();
    },
    skip() {
      if (ready) complete();
    },
    dispose() {
      ended = true;
      clearTimeout(introTimer);
      clearTimeout(safetyTimer);
    },
  };
}
