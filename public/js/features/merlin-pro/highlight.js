// A small shell syntax tokenizer for the script editor. It imports nothing and
// touches no DOM, so the editor and the Node tests use the same code.
const KEYWORDS = new Set(["if", "then", "else", "elif", "fi", "for", "while", "until", "do", "done", "case", "esac", "in", "function", "select", "time"]);
const BUILTINS = new Set(["echo", "printf", "cd", "exit", "return", "export", "local", "set", "unset", "source", "read", "test", "shift", "trap", "eval", "exec", "nvram", "cru", "service", "logger", "iptables", "ip6tables", "sleep", "kill", "mkdir", "rm", "mv", "cp", "ln", "chmod", "sed", "awk", "grep", "head", "tail", "sort", "wc"]);
const BEFORE_COMMENT = /[\s;|&()]/;

// Returns [{ type, text }] for one line. type: shebang, comment, string, variable, keyword, builtin, number, operator, plain.
export function tokenizeLine(line) {
  const out = [];
  const push = (type, text) => {
    const last = out[out.length - 1];
    if (last && last.type === type && type === "plain") last.text += text;
    else out.push({ type, text });
  };
  if (line.startsWith("#!")) return [{ type: "shebang", text: line }];
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === "#" && (i === 0 || BEFORE_COMMENT.test(line[i - 1]))) {
      push("comment", line.slice(i));
      break;
    }
    if (ch === "'") {
      const end = line.indexOf("'", i + 1);
      const stop = end === -1 ? line.length : end + 1;
      push("string", line.slice(i, stop));
      i = stop;
    } else if (ch === '"') {
      let j = i + 1;
      while (j < line.length && line[j] !== '"') j += line[j] === "\\" ? 2 : 1;
      const stop = Math.min(j + 1, line.length);
      push("string", line.slice(i, stop));
      i = stop;
    } else if (ch === "$") {
      const m = line.slice(i).match(/^\$(?:\{[^}]*\}?|\([^)]*\)?|[A-Za-z_][A-Za-z0-9_]*|[0-9@*#?$!-])/);
      if (m) {
        push("variable", m[0]);
        i += m[0].length;
      } else {
        push("plain", ch);
        i += 1;
      }
    } else if (/[A-Za-z0-9_./-]/.test(ch)) {
      const word = line.slice(i).match(/^[A-Za-z0-9_./-]+/)[0];
      const type = KEYWORDS.has(word) ? "keyword" : BUILTINS.has(word) ? "builtin" : /^\d+$/.test(word) ? "number" : "plain";
      push(type, word);
      i += word.length;
    } else if ("|&;<>()=!".includes(ch)) {
      push("operator", ch);
      i += 1;
    } else {
      push("plain", ch);
      i += 1;
    }
  }
  return out;
}

export const tokenize = (text) => String(text).split("\n").map(tokenizeLine);
