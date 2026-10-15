// src/keyboardPrimer.js
//
// iPhone only opens the keyboard when focus() is called during a tap.
// Our answer bar often does not exist yet at that moment (new screen, new level),
// so we focus a tiny invisible input during the tap, and the real answer bar takes
// over as soon as it appears. The keyboard never closes in between.

const ID = "keyboard-primer";
let timer = null;

export function primeKeyboard() {
  try {
    let el = document.getElementById(ID);
    if (!el) {
      el = document.createElement("input");
      el.id = ID;
      el.type = "text";
      el.tabIndex = -1;
      el.setAttribute("aria-hidden", "true");
      el.setAttribute("autocomplete", "off");
      el.setAttribute("autocorrect", "off");
      el.setAttribute("autocapitalize", "none");
      Object.assign(el.style, {
        position: "fixed",
        top: "0",
        left: "0",
        width: "1px",
        height: "1px",
        opacity: "0",
        border: "0",
        padding: "0",
        fontSize: "16px",
        pointerEvents: "none",
      });
      document.body.appendChild(el);
    }
    el.focus({ preventScroll: true });
    window.clearTimeout(timer);
    // Safety net: never leave the helper behind
    timer = window.setTimeout(releaseKeyboardPrimer, 8000);
  } catch (e) {
    // keyboard helper is optional
  }
}

export function releaseKeyboardPrimer() {
  window.clearTimeout(timer);
  document.getElementById(ID)?.remove();
}
