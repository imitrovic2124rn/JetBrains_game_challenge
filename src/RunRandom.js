// Independent seeded streams keep rejection attempts in one system from moving another.
export function randomSource(seed) {
  return ()=>{seed=seed+0x6D2B79F5|0;let n=Math.imul(seed^seed>>>15,1|seed);
    n=n+Math.imul(n^n>>>7,61|n)^n;return((n^n>>>14)>>>0)/4294967296;};
}
export function newRunSeed(previous) {
  const value=globalThis.crypto?.getRandomValues
    ?crypto.getRandomValues(new Uint32Array(1))[0]:(Date.now()^Math.floor(Math.random()*4294967296))>>>0;
  return value===previous?(value+1)>>>0:value;
}
