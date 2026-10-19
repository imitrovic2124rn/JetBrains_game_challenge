// Importing the game also waits for its styles, including Vite's production CSS.
// Keep this entry independent so module, stylesheet and initialization failures
// leave the HTML loading screen usable, even before the game can create its UI.
try {
  const { ready } = await import('./main.js');
  await ready;

  const root = document.getElementById('game-root');
  root.inert = false;
  root.removeAttribute('aria-hidden');
  root.removeAttribute('aria-busy');
  document.documentElement.dataset.startup = 'ready';
  document.getElementById('startup-screen').remove();
  document.querySelector('.game-menus [data-action="play"]').focus({ preventScroll: true });
} catch (error) {
  document.documentElement.dataset.startup = 'error';
  console.error('Unable to start Ash Relay:', error);
}
