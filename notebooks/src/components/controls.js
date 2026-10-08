// Native controls for Framework's view(): a <label> whose `value` is its control's, and whose control's "input"
// events bubble up to it. No Inputs import, so nothing is fetched from npm.
export function select(options, { label = "", value } = {}) {
  const wrap = document.createElement("label");
  wrap.style.marginInlineEnd = "1em";
  const control = document.createElement("select");
  for (const o of options) control.append(new Option(String(o), String(o), false, o === value));
  wrap.append(`${label} `, control);
  Object.defineProperty(wrap, "value", { get: () => control.value });
  return wrap;
}

export function range([min, max], { label = "", step = 1, value = min } = {}) {
  const wrap = document.createElement("label");
  wrap.style.marginInlineEnd = "1em";
  const control = Object.assign(document.createElement("input"), { type: "range", min, max, step, value });
  const shown = document.createElement("output");
  shown.value = String(value);
  control.addEventListener("input", () => {
    shown.value = control.value;
  });
  wrap.append(`${label} `, control, " ", shown);
  Object.defineProperty(wrap, "value", { get: () => Number(control.value) });
  return wrap;
}
