// Native controls for Framework's view(): a <label> whose `value` is its control's, and whose control's "input"
// events bubble up to it. No Inputs import, so nothing is fetched from npm.

// A label and its control wrap as one unit on a narrow screen, never apart.
const UNIT =
  "display: inline-flex; align-items: center; gap: 0.35em; margin: 0 1em 0.4em 0; white-space: nowrap; max-width: 100%";

export function select(options, { label = "", value } = {}) {
  const wrap = document.createElement("label");
  wrap.style.cssText = UNIT;
  const control = document.createElement("select");
  control.style.cssText = "min-width: 0; max-width: 100%";
  control.name = label || "select"; // a form field needs an id or a name (DevTools); ids would repeat on a page
  for (const o of options) control.append(new Option(String(o), String(o), false, o === value));
  wrap.append(label, control);
  Object.defineProperty(wrap, "value", { get: () => control.value });
  return wrap;
}

export function range([min, max], { label = "", step = 1, value = min } = {}) {
  const wrap = document.createElement("label");
  wrap.style.cssText = UNIT;
  const control = Object.assign(document.createElement("input"), { type: "range", min, max, step, value });
  control.name = label || "range";
  control.style.cssText = "width: 9em; min-width: 0; flex: 0 1 auto";
  const shown = document.createElement("output");
  shown.value = String(value);
  control.addEventListener("input", () => {
    shown.value = control.value;
  });
  wrap.append(label, control, shown);
  Object.defineProperty(wrap, "value", { get: () => Number(control.value) });
  return wrap;
}

// One checkbox: its value is whether it is checked.
export function checkbox(label, { value = false } = {}) {
  const wrap = document.createElement("label");
  wrap.style.cssText = UNIT;
  const control = Object.assign(document.createElement("input"), { type: "checkbox", checked: value });
  control.name = label;
  wrap.append(control, label);
  Object.defineProperty(wrap, "value", { get: () => control.checked });
  return wrap;
}

// A row of checkboxes: its value is the array of the checked options, in option order.
export function checkboxes(options, { label = "", value = [] } = {}) {
  const wrap = document.createElement("fieldset");
  wrap.style.cssText = "border: none; padding: 0; margin: 0 0 0.5em";
  const legend = document.createElement("legend");
  legend.textContent = label;
  legend.style.cssText = "padding: 0; font-weight: 600";
  wrap.append(legend);
  const boxes = options.map((o) => {
    const box = Object.assign(document.createElement("input"), {
      type: "checkbox",
      checked: value.includes(o),
    });
    box.name = `${label} ${o}`;
    const item = document.createElement("label");
    item.style.cssText = "display: inline-block; margin-inline-end: 1em; white-space: nowrap";
    item.append(box, ` ${o}`);
    wrap.append(item);
    return box;
  });
  Object.defineProperty(wrap, "value", { get: () => options.filter((_, i) => boxes[i].checked) });
  return wrap;
}

// Wraps a wide element (a table) so it scrolls inside the column instead of widening the page on a phone.
export function scroller(el) {
  const wrap = document.createElement("div");
  wrap.style.cssText = "max-width: 100%; overflow-x: auto";
  wrap.append(el);
  return wrap;
}

// A one-line note in place of a chart that has nothing to draw (no htl: `html` would pull it from npm).
export function note(text) {
  const p = document.createElement("p");
  p.append(Object.assign(document.createElement("em"), { textContent: text }));
  return p;
}
