/**
 * Prevent a host application's global shortcuts (games, canvas controls, dashboards)
 * from receiving keyboard events originating in Kijazo's Shadow DOM.
 *
 * For keyboard events in the editor: stop propagation at the shadow boundary,
 * without preventing default typing, Space, Enter, IME, or accessibility behavior.
 * For keyboard events outside the editor while it has ownership: intercept them
 * during window capture. Clicking/focusing outside relinquishes ownership.
 */
export function createKeyboardBoundary({ host, shadow, panel, view = window, doc = document }) {
  const types = ['keydown', 'keyup', 'keypress'];
  let ownsKeyboard = false;
  const inside = event => typeof event.composedPath === 'function' && event.composedPath().includes(host);
  function take() {
    ownsKeyboard = true;
    doc.documentElement?.setAttribute('data-kijazo-keyboard-active', '');
  }
  function release() {
    ownsKeyboard = false;
    doc.documentElement?.removeAttribute('data-kijazo-keyboard-active');
  }
  function stopInner(event) {
    // Do not call preventDefault: the textarea still needs to type spaces,
    // use Enter, select text, and handle input methods normally.
    event.stopPropagation();
  }
  function blockOutside(event) {
    if (!ownsKeyboard || panel.hidden || inside(event)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  function onPointer(event) {
    if (panel.hidden) return;
    if (inside(event)) take();
    else release();
  }
  function onFocus(event) {
    if (panel.hidden) return;
    if (inside(event)) take();
    else release();
  }
  for (const type of types) {
    shadow.addEventListener(type, stopInner);
    view.addEventListener(type, blockOutside, true);
  }
  doc.addEventListener('pointerdown', onPointer, true);
  doc.addEventListener('focusin', onFocus, true);
  return {
    take,
    release,
    get active() { return ownsKeyboard; },
    destroy() {
      release();
      for (const type of types) {
        shadow.removeEventListener(type, stopInner);
        view.removeEventListener(type, blockOutside, true);
      }
      doc.removeEventListener('pointerdown', onPointer, true);
      doc.removeEventListener('focusin', onFocus, true);
    },
  };
}
