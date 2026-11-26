// Keyboard and mouse, read every frame. Arrows / WASD fly the plane, W/S (or
// Shift/Ctrl) work the throttle, the mouse steers by position when it moves, and
// P pauses, M mutes, R restarts, Enter confirms. Keys are tracked as a set so
// holding two at once (bank + climb) just works.
export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_MUTE = 'mute';
export const ACTION_RESTART = 'restart';

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  ' ': ACTION_CONFIRM,
  p: ACTION_PAUSE,
  P: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  m: ACTION_MUTE,
  M: ACTION_MUTE,
  r: ACTION_RESTART,
  R: ACTION_RESTART,
};

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let mouseX = 0.5;
  let mouseY = 0.5;
  let mouseActive = false;
  let mouseDown = false;
  let lastMouseMove = 0;

  // Letter keys are stored lower-cased, so Shift+W still reads as "w".
  function storeKey(event) {
    return event.key.length === 1 ? event.key.toLowerCase() : event.key;
  }

  function onKeyDown(event) {
    const gameKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'w', 'a', 's', 'd'];
    if (gameKeys.includes(storeKey(event))) event.preventDefault();
    if (!event.repeat) pressed.add(KEY_ACTIONS[event.key] ?? storeKey(event));
    keys.add(storeKey(event));
  }

  function onKeyUp(event) {
    keys.delete(storeKey(event));
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = (event.clientX - rect.left) / Math.max(1, rect.width);
    mouseY = (event.clientY - rect.top) / Math.max(1, rect.height);
    mouseActive = true;
    lastMouseMove = performance.now();
  }

  function onMouseDown(event) {
    mouseDown = true;
    onMouseMove(event);
  }

  function onMouseUp() {
    mouseDown = false;
  }

  function onBlur() {
    keys.clear();
    mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  function axis(negative, positive) {
    let value = 0;
    if (keys.has(negative)) value -= 1;
    if (keys.has(positive)) value += 1;
    return value;
  }

  return {
    // -1..1 roll demand: keys win while held, otherwise the mouse position
    // (offset from centre) steers, fading out a second after the mouse stops.
    roll() {
      const key = axis('ArrowLeft', 'ArrowRight') + axis('a', 'd');
      const clampedKey = Math.max(-1, Math.min(1, key));
      if (clampedKey !== 0) return clampedKey;
      if (mouseActive && performance.now() - lastMouseMove < 1500) {
        return Math.max(-1, Math.min(1, (mouseX - 0.5) * 2.4));
      }
      return 0;
    },
    // -1..1 pitch demand: up is climb. Keys win; the mouse steers otherwise.
    pitch() {
      const key = axis('ArrowDown', 'ArrowUp') + axis('s', 'w');
      const clampedKey = Math.max(-1, Math.min(1, key));
      if (clampedKey !== 0) return clampedKey;
      if (mouseActive && performance.now() - lastMouseMove < 1500) {
        return Math.max(-1, Math.min(1, (0.5 - mouseY) * 2.0));
      }
      return 0;
    },
    throttleUp() {
      return keys.has('Shift') || keys.has('PageUp');
    },
    throttleDown() {
      return keys.has('Control') || keys.has('PageDown');
    },
    // Holding the mouse button is the brake: useful on short final.
    brake() {
      return mouseDown;
    },
    mouseSteering() {
      return mouseActive && performance.now() - lastMouseMove < 1500;
    },
    takePressed() {
      const out = new Set(pressed);
      pressed.clear();
      return out;
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    },
  };
}
