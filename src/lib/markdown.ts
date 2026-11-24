/**
 * Tiptap JSON -> Markdown (CommonMark/GFM), and a safe download filename.
 * Supports exactly what the editor can produce: paragraphs, headings 1-3, bullet/ordered lists
 * (nested), hard breaks; bold, italic, underline. Pure functions, no DOM.
 *
 * Decisions (also in ARCHITECTURE.md):
 * - Underline has no Markdown syntax, so it is written as inline HTML `<u>…</u>`.
 * - A hard break is a backslash at the end of the line (CommonMark), which survives editors that trim trailing spaces.
 * - Leading indentation is written as `&nbsp;` so it is not swallowed or turned into a code block.
 * - Empty paragraphs are dropped; the document title is not added to the body (it becomes the filename).
 * - Two adjacent lists of the same kind are separated by `<!-- -->` so they do not merge into one.
 */

type TNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type?: string }[];
  content?: TNode[];
};

type MarkKey = "underline" | "bold" | "italic";
const ORDER: MarkKey[] = ["underline", "bold", "italic"]; // outermost -> innermost
const OPEN: Record<MarkKey, string> = { underline: "<u>", bold: "**", italic: "*" };
const CLOSE: Record<MarkKey, string> = { underline: "</u>", bold: "**", italic: "*" };

/** Escapes characters that would otherwise be read as inline Markdown or HTML. */
function escapeText(s: string, inHeading: boolean): string {
  let out = s
    .replace(/\r?\n/g, " ")
    .replace(/[\\`*_[\]<]/g, "\\$&")
    .replace(/~~/g, "\\~\\~")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/gi, "\\&$1;");
  if (inHeading) out = out.replace(/#/g, "\\#"); // avoids a trailing "#" run being read as a closing sequence
  return out;
}

/** Block-level constructs are only special at the start of a line. */
function fixLineStart(line: string): string {
  if (line === "") return "";
  const lead = line.match(/^[ \t]+/)?.[0] ?? "";
  if (lead) return lead.replace(/\t/g, "    ").replace(/ /g, "&nbsp;") + line.slice(lead.length);
  if (/^#{1,6}(\s|$)/.test(line)) return "\\" + line; // heading
  if (/^>/.test(line)) return "\\" + line; // blockquote
  if (/^[-+](\s|$)/.test(line) || /^(-[ \t]*){3,}$/.test(line)) return "\\" + line; // bullet / thematic break (also "- - -", "---  ---")
  if (/^=+\s*$/.test(line)) return "\\" + line; // setext underline
  if (/^~{3,}/.test(line)) return "\\" + line; // code fence
  const ol = line.match(/^(\d{1,9})([.)])(\s|$)/);
  if (ol) return `${ol[1]}\\${ol[2]}${line.slice(ol[1].length + 1)}`; // ordered list
  return line;
}

const hasMark = (n: TNode, k: MarkKey) => !!n.marks?.some((m) => m.type === k);

// CommonMark only treats `*`/`**` as emphasis when the delimiter run is "flanking" correctly: it must not touch
// whitespace on its inside, and next to punctuation it must be preceded/followed by whitespace or punctuation.
// (Example: `x*\_*` is NOT emphasis.) null = start/end of the line, which counts as whitespace.
type Edge = string | null;
// Parsers disagree about non-ASCII symbols (emoji, currency signs): the CommonMark spec counts Unicode symbols (S)
// as punctuation, some implementations only count punctuation (P). Keep `*` only if the result is valid either way.
const PUNCT_WITH_SYMBOLS = /[\p{P}\p{S}]/u;
const PUNCT_STRICT = /[!-/:-@[-`{-~]|\p{P}/u; // ASCII punctuation/symbols, or Unicode P
const isWs = (c: Edge) => c === null || /\s/u.test(c);
const flanking = (prev: Edge, next: Edge, punct: RegExp, side: "left" | "right") => {
  const isP = (c: Edge) => c !== null && punct.test(c);
  return side === "left"
    ? !isWs(next) && (!isP(next) || isWs(prev) || isP(prev))
    : !isWs(prev) && (!isP(prev) || isWs(next) || isP(next));
};
const validDelimiter = (prev: Edge, next: Edge, side: "left" | "right") =>
  flanking(prev, next, PUNCT_WITH_SYMBOLS, side) && flanking(prev, next, PUNCT_STRICT, side);
const lastChar = (s: string): string => Array.from(s).pop() ?? "";
const firstChar = (s: string): string => (s ? String.fromCodePoint(s.codePointAt(0)!) : "");

type Item = { k: "text"; s: string } | { k: "open" | "close"; mark: MarkKey; span: number };

/**
 * Serialises a run of text nodes (no hard breaks) with marks. Marks are kept open across adjacent nodes that
 * share them, whitespace is moved outside the delimiters (`** x **` would not be bold), and any bold/italic span
 * whose `*` delimiters would not be valid Markdown (mid-word, next to punctuation) is written as inline HTML
 * `<strong>`/`<em>` instead, which CommonMark always accepts. Underline is always `<u>`.
 */
function renderRuns(nodes: TNode[], inHeading: boolean): string {
  const items: Item[] = [];
  let open: { mark: MarkKey; span: number }[] = [];
  let nextSpan = 0;

  const closeTo = (keep: number) => {
    if (open.length <= keep) return;
    let trailing = "";
    for (let last = items[items.length - 1]; last && last.k === "text"; last = items[items.length - 1]) {
      const ws = last.s.match(/\s*$/)![0];
      trailing = ws + trailing;
      last.s = last.s.slice(0, last.s.length - ws.length);
      if (last.s === "") items.pop();
      else break;
    }
    for (let i = open.length - 1; i >= keep; i--) items.push({ k: "close", mark: open[i].mark, span: open[i].span });
    if (trailing) items.push({ k: "text", s: trailing });
    open = open.slice(0, keep);
  };

  for (const n of nodes) {
    const text = n.text ?? "";
    if (!text) continue;
    if (/^\s+$/.test(text)) {
      items.push({ k: "text", s: text.replace(/\r?\n/g, " ") });
      continue;
    }
    const want = ORDER.filter((k) => hasMark(n, k));
    let keep = 0;
    while (keep < open.length && keep < want.length && open[keep].mark === want[keep]) keep++;
    closeTo(keep);
    const lead = text.match(/^\s*/)![0];
    if (lead) items.push({ k: "text", s: lead.replace(/\r?\n/g, " ") });
    for (let i = keep; i < want.length; i++) {
      const entry = { mark: want[i], span: nextSpan++ };
      items.push({ k: "open", ...entry });
      open.push(entry);
    }
    items.push({ k: "text", s: escapeText(text.slice(lead.length), inHeading) });
  }
  closeTo(0);

  // Decide, per bold/italic span, whether `*` delimiters are valid; otherwise use HTML tags.
  // Neighbouring delimiters count as punctuation (they are `*`, `<` or `>`), whichever form they end up in.
  const edge = (from: number, step: 1 | -1): Edge => {
    for (let i = from; i >= 0 && i < items.length; i += step) {
      const it = items[i];
      if (it.k !== "text") return "*";
      if (it.s) return step === 1 ? firstChar(it.s) : lastChar(it.s);
    }
    return null;
  };
  const useHtml = new Set<number>();
  items.forEach((it, i) => {
    if (it.k === "text" || it.mark === "underline") return;
    const ok = validDelimiter(edge(i - 1, -1), edge(i + 1, 1), it.k === "open" ? "left" : "right");
    if (!ok) useHtml.add(it.span);
  });
  // Bold/italic spans that overlap or nest (other than the exact pair `***x***`) make `*` runs ambiguous for parsers,
  // so every span involved is written as HTML. Isolated spans keep the compact `*` form.
  const spans = new Map<number, { open: number; close: number; mark: MarkKey }>();
  items.forEach((it, i) => {
    if (it.k === "text") return;
    const entry = spans.get(it.span) ?? { open: -1, close: -1, mark: it.mark };
    if (it.k === "open") entry.open = i;
    else entry.close = i;
    spans.set(it.span, entry);
  });
  const star = [...spans.entries()].filter(([id, v]) => v.mark !== "underline" && !useHtml.has(id));
  for (let x = 0; x < star.length; x++) {
    for (let y = x + 1; y < star.length; y++) {
      const [idA, A] = star[x];
      const [idB, B] = star[y];
      const overlap = A.open < B.close && B.open < A.close;
      const exactPair = Math.abs(A.open - B.open) === 1 && Math.abs(A.close - B.close) === 1;
      if (overlap && !exactPair) {
        useHtml.add(idA);
        useHtml.add(idB);
      }
    }
  }
  // A closing and an opening delimiter with no text between them would merge into one ambiguous `*` run
  // (`**a***b*`), so write the opening ones as HTML.
  items.forEach((it, i) => {
    if (it.k !== "close" || it.mark === "underline" || items[i + 1]?.k !== "open") return;
    for (let j = i + 1; items[j]?.k === "open"; j++) useHtml.add((items[j] as { span: number }).span);
  });

  return items
    .map((it) => {
      if (it.k === "text") return it.s;
      const html = it.mark === "underline" || useHtml.has(it.span);
      if (!html) return it.k === "open" ? OPEN[it.mark] : CLOSE[it.mark];
      const tag = it.mark === "underline" ? "u" : it.mark === "bold" ? "strong" : "em";
      return it.k === "open" ? `<${tag}>` : `</${tag}>`;
    })
    .join("");
}

function paragraph(n: TNode): string {
  const lines: TNode[][] = [[]];
  for (const c of n.content ?? []) {
    if (c.type === "hardBreak") lines.push([]);
    else if (c.type === "text") lines[lines.length - 1].push(c);
  }
  const rendered = lines.map((l) => fixLineStart(renderRuns(l, false).replace(/[ \t]+$/, "")));
  while (rendered.length && rendered[rendered.length - 1] === "") rendered.pop(); // a trailing break has no effect
  if (rendered.length === 0) return "";
  return rendered.map((l) => (l === "" ? "&nbsp;" : l)).join("\\\n");
}

function heading(n: TNode): string {
  const raw = Number(n.attrs?.level);
  const level = Number.isInteger(raw) ? Math.min(6, Math.max(1, raw)) : 1;
  // A heading is one line: hard breaks become spaces.
  const flat = (n.content ?? []).map((c) => (c.type === "hardBreak" ? ({ type: "text", text: " " } as TNode) : c));
  const text = renderRuns(flat.filter((c) => c.type === "text"), true).trim();
  return text ? `${"#".repeat(level)} ${text}` : "";
}

type ListKind = "bulletList" | "orderedList";

function list(n: TNode): string {
  const ordered = n.type === "orderedList";
  const startRaw = Number(n.attrs?.start);
  const start = Number.isInteger(startRaw) && startRaw >= 0 ? startRaw : 1;
  const items = (n.content ?? []).filter((c) => c.type === "listItem");
  return items
    .map((item, i) => {
      const marker = ordered ? `${start + i}. ` : "- ";
      const body = renderBlocks(item.content ?? [], true);
      if (body === "") return marker.trimEnd();
      const pad = " ".repeat(marker.length);
      return body
        .split("\n")
        .map((line, j) => (j === 0 ? marker + line : line === "" ? "" : pad + line))
        .join("\n");
    })
    .join("\n");
}

function renderBlocks(nodes: TNode[], inItem: boolean): string {
  // `tight`: may directly follow a paragraph line without a blank line (inside a list item).
  const parts: { text: string; kind: "p" | ListKind; tight: boolean }[] = [];
  for (const n of nodes) {
    if (n.type === "paragraph") {
      const text = paragraph(n);
      // An empty paragraph is dropped, except as the first line of a list item that has more content.
      if (text || inItem) parts.push({ text, kind: "p", tight: false });
    } else if (n.type === "heading") {
      const text = heading(n);
      if (text) parts.push({ text, kind: "p", tight: false });
    } else if (n.type === "bulletList" || n.type === "orderedList") {
      const text = list(n);
      // CommonMark: a list may interrupt a paragraph only if it is not ordered with a start other than 1, and its
      // first item is not empty (a lone `-` under a paragraph would make a heading).
      const startRaw = Number(n.attrs?.start);
      const startsAtOne = n.type !== "orderedList" || !Number.isInteger(startRaw) || startRaw === 1;
      const firstItemEmpty = /^([-+*]|\d+[.)])\s*$/.test(text.split("\n", 1)[0]);
      if (text) parts.push({ text, kind: n.type, tight: startsAtOne && !firstItemEmpty });
    } else if (n.content) {
      const text = renderBlocks(n.content, inItem); // unknown wrapper node: keep its content
      if (text) parts.push({ text, kind: "p", tight: false });
    }
  }
  let out = "";
  parts.forEach((part, i) => {
    if (i === 0) {
      out = part.text;
      return;
    }
    const prev = parts[i - 1];
    if (part.kind !== "p" && prev.kind === part.kind) out += "\n\n<!-- -->\n\n" + part.text; // keep two lists apart
    else if (inItem && prev.kind === "p" && part.kind !== "p" && (part.tight || prev.text === "")) out += "\n" + part.text; // nested list right under its item (an empty first line has no paragraph to interrupt)
    else out += "\n\n" + part.text;
  });
  return out;
}

/** Converts a Tiptap document (as produced by `editor.getJSON()`) to Markdown. Empty document -> "". */
export function docToMarkdown(doc: unknown): string {
  if (!doc || typeof doc !== "object") return "";
  const md = renderBlocks((doc as TNode).content ?? [], false);
  return md === "" ? "" : md + "\n";
}

const RESERVED_WINDOWS_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/**
 * Safe download name derived from a title: no path separators or reserved characters, no control or
 * bidirectional/zero-width characters (which can disguise an extension), no leading dot or dash, no trailing
 * dot/space, no Windows device names, at most 100 characters; Unicode letters are kept. Always ends in `.md`.
 */
export function markdownFilename(title: string): string {
  let base = title
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁠-⁤⁦-⁩﻿]/g, "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.\s-]+/, "");
  base = Array.from(base).slice(0, 100).join("").replace(/[.\s]+$/, "");
  if (!base) base = "document";
  if (RESERVED_WINDOWS_NAME.test(base)) base = `_${base}`;
  return `${base}.md`;
}
