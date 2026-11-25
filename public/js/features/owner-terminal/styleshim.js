// The app's content security policy refuses inline <style> text, and xterm.js
// writes its colours, cursor and cell sizes into style elements it creates. This
// shim hands those rules to constructed style sheets instead, which the policy
// allows, so the terminal keeps its colours without the policy being loosened.
// It imports nothing and takes the document as an argument, so tests can fake it.

export function installStyleShim(doc, SheetClass = globalThis.CSSStyleSheet) {
  const sheets = new Set();
  const original = doc.createElement;
  doc.createElement = function createElement(tag, ...rest) {
    const el = original.call(this, tag, ...rest);
    if (String(tag).toLowerCase() !== "style") return el;
    let sheet = null;
    let text = "";
    const ensure = () => {
      if (!sheet) {
        sheet = new SheetClass();
        sheets.add(sheet);
        doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
      }
      return sheet;
    };
    const write = (value) => {
      text = String(value ?? "");
      ensure().replaceSync(text);
    };
    for (const name of ["textContent", "innerHTML", "innerText"]) Object.defineProperty(el, name, { configurable: true, get: () => text, set: write });
    Object.defineProperty(el, "sheet", { configurable: true, get: ensure });
    return el;
  };
  return function uninstall() {
    delete doc.createElement;
    doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter((s) => !sheets.has(s));
    sheets.clear();
  };
}
