// The app's content security policy refuses inline style text and style
// attributes. xterm.js writes its colours, cursor and cell sizes into style
// elements it creates, and marks a few cells with a style attribute. This shim
// hands both to the style object model instead, which the policy allows:
//   - a style element is replaced by an inert template whose text goes into a
//     constructed style sheet
//   - setAttribute("style", ...) sets the element's cssText
// so the terminal keeps its colours without the policy being loosened. It lasts
// only while a terminal is open. It imports nothing and takes the document (and
// the pieces to patch) as arguments, so tests can fake them.

export function installStyleShim(doc, SheetClass = globalThis.CSSStyleSheet, elementProto = globalThis.Element?.prototype) {
  const sheets = new Set();
  const original = doc.createElement;
  doc.createElement = function createElement(tag, ...rest) {
    if (String(tag).toLowerCase() !== "style") return original.call(this, tag, ...rest);
    // A real style element is refused as soon as it is inserted, even empty, so
    // xterm is handed an inert template element that behaves like one.
    const el = original.call(this, "template");
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
    Object.defineProperty(el, "textContent", {
      configurable: true,
      get: () => text,
      set: (value) => {
        text = String(value ?? "");
        ensure().replaceSync(text);
      },
    });
    Object.defineProperty(el, "sheet", { configurable: true, get: ensure });
    return el;
  };

  const originalSetAttribute = elementProto?.setAttribute;
  if (originalSetAttribute)
    elementProto.setAttribute = function setAttribute(name, value) {
      if (String(name).toLowerCase() === "style" && this.style) {
        this.style.cssText = String(value);
        return;
      }
      return originalSetAttribute.call(this, name, value);
    };

  return function uninstall() {
    delete doc.createElement;
    if (originalSetAttribute) elementProto.setAttribute = originalSetAttribute;
    doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter((s) => !sheets.has(s));
    sheets.clear();
  };
}
