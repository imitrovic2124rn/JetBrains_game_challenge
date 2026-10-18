const bindings = [
  ['WASD / Arrow keys', 'Move'], ['MOUSE', 'Aim'], ['LMB / SPACE', 'Light swing / Fire'],
  ['RMB', 'Heavy overhead strike — melee only'],
  ['TAB', 'Hold to choose a weapon. Release to equip.'],
  ['R', 'Reload. Empty weapons reload automatically.'],
  ['G', 'Throw a stun grenade toward the cursor. Enemies only.'],
  ['CAPS LOCK', 'Show or hide extra HUD details'], ['ESC / P', 'Pause'],
  ['1 / 2 / 3', 'Filter / Hunter / Overload mask'], ['SHIFT', 'Dash — unlock with Phase Step'],
  ['E', 'Interact'], ['M', 'View mutations'], ['J', 'Achievements'],
];

// One menu shell; settings and the achievement archive reuse their existing controls.
export default class GameMenus {
  constructor({ canvas, onPause, onPlay, onReturn, onArchive }) {
    Object.assign(this, { canvas, onPause, onPlay, onReturn, onArchive });
    this.stack = []; this.ready = false;
    this.root = document.createElement('div'); this.root.className = 'game-menus';
    this.root.innerHTML = `<section class="menu-terminal" role="dialog" aria-modal="true" aria-labelledby="menu-title">
      <header><span class="debrief-code">ASH RELAY</span><h1 id="menu-title">The Last Signal</h1><p class="menu-description"></p></header>
      <div data-menu-view="main" class="menu-buttons"><button data-action="play" disabled>Loading…</button><button data-action="settings">Settings</button><button data-action="archive">Achievements</button><button data-action="quit">Quit</button></div>
      <div data-menu-view="pause" class="menu-buttons" hidden><button data-action="resume">Resume</button><button data-action="settings">Settings</button><button data-action="controls">Controls</button><button data-action="archive">Achievements</button><button data-action="abandon">Return to Main Menu</button></div>
      <div data-menu-view="settings" hidden><div class="menu-settings"></div><button data-action="controls">Controls</button><p class="settings-note">Settings and achievements are saved on this device.</p></div>
      <div data-menu-view="controls" hidden><dl class="controls-reference"></dl></div>
      <div data-menu-view="abandon" class="menu-buttons" hidden><p>Your current expedition and upgrades will be lost. Achievements and settings are kept.</p><button data-action="confirm-abandon">Abandon run</button><button data-action="back">Keep playing</button></div>
      <div data-menu-view="quit" hidden><p class="quit-copy">You can close this tab</p></div>
      <button class="menu-back" data-action="back" hidden>← Back</button>
    </section>`;
    const controls = this.root.querySelector('.controls-reference');
    for (const [key, description] of bindings) {
      const term = document.createElement('dt'), value = document.createElement('dd');
      term.textContent = key; value.textContent = description; controls.append(term, value);
    }
    this.root.querySelector('.menu-settings').append(document.querySelector('.graphics-control'), document.querySelector('.minimap-control'), document.querySelector('.hunter-vignette-control'), document.querySelector('.audio-settings'));
    this.root.addEventListener('click', event => {
      const button = event.target.closest('button[data-action]'); if (!button || button.disabled) return;
      const action = button.dataset.action;
      if (action === 'play') { if (this.ready) this.onPlay(); }
      else if (action === 'resume') this.close();
      else if (action === 'back') this.back();
      else if (action === 'archive') this.onArchive();
      else if (action === 'confirm-abandon') this.onReturn();
      else { this.push(action); if (action === 'quit') this.quit(); }
    });
    document.querySelector('.ui-layer').append(this.root); this.showMain();
  }
  get isOpen() { return !this.root.hidden; }
  setReady(error = false) {
    this.ready = !error; const play = this.root.querySelector('[data-action="play"]');
    play.disabled = error; play.textContent = error ? 'Unable to load. Refresh to try again.' : 'Play';
    if (!error && this.isOpen && this.stack.at(-1) === 'main') play.focus({ preventScroll: true });
  }
  showMain() { this.stack = ['main']; this.open(); }
  pause() { this.stack = ['pause']; this.open(); }
  open() { this.root.hidden = false; document.body.classList.add('menu-open'); this.onPause(true); this.render(); }
  close() {
    this.root.hidden = true; this.root.inert = false; this.stack.length = 0;
    document.body.classList.remove('menu-open'); this.onPause(false); this.canvas.focus({ preventScroll: true });
  }
  push(view) { this.stack.push(view); this.render(); }
  back() { if (this.stack.length > 1) { this.stack.pop(); this.render(); } else if (this.stack[0] === 'pause') this.close(); }
  archiveChanged(open) { this.root.inert = open && this.isOpen; if (!open && this.isOpen) this.render(); }
  render() {
    const view = this.stack.at(-1);
    for (const element of this.root.querySelectorAll('[data-menu-view]')) element.hidden = element.dataset.menuView !== view;
    this.root.querySelector('.menu-back').hidden = this.stack.length < 2 || view === 'abandon';
    this.root.querySelector('h1').textContent = { main: 'The Last Signal', pause: 'Paused', settings: 'Settings', controls: 'Controls', abandon: 'Return to Main Menu?', quit: 'Quit' }[view];
    this.root.querySelector('.menu-description').textContent = view === 'main' ? 'Recover three components. Restore the relay. Survive the last transmission.'
      : this.stack[0] === 'pause' ? 'Game paused.' : '';
    this.root.querySelector('.menu-description').hidden = !this.root.querySelector('.menu-description').textContent;
    const section = this.root.querySelector(`[data-menu-view="${view}"]`);
    (section.querySelector('button:not(:disabled), select') ?? this.root.querySelector('.menu-back')).focus({ preventScroll: true });
  }
  quit() {
    // Browsers normally reject closing user-opened tabs. Always leave an honest fallback.
    if (window.opener || window.history.length === 1) { try { window.close(); } catch { /* Back remains available. */ } }
  }
  handleKey(event) {
    if (!this.isOpen) return false;
    if (event.code === 'Escape' && !event.repeat) { event.preventDefault(); this.back(); }
    return true; // Native Tab, Space and Enter navigation stay intact in menus.
  }
}
