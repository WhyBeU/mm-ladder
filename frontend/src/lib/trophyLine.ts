// Index of the last entry equal to 9 ("clean 3-0") in a points-desc array.
// Returns -1 when no entry is 9. Caller must pass an already points-desc list.
export function trophyCutoffIndex(points: number[]): number {
  let last = -1;
  for (let i = 0; i < points.length; i++) {
    if (points[i] === 9) last = i;
  }
  return last;
}
