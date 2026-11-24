import { describe, expect, it } from "vitest";
import { docToMarkdown, markdownFilename } from "@/lib/markdown";
import { parsePlainText } from "@/lib/import-text";

type N = Record<string, unknown>;
const t = (text: string, ...marks: string[]): N => ({ type: "text", text, ...(marks.length ? { marks: marks.map((type) => ({ type })) } : {}) });
const p = (...content: N[]): N => ({ type: "paragraph", ...(content.length ? { content } : {}) });
const h = (level: number, ...content: N[]): N => ({ type: "heading", attrs: { level }, content });
const br: N = { type: "hardBreak" };
const li = (...content: N[]): N => ({ type: "listItem", content });
const ul = (...items: N[]): N => ({ type: "bulletList", content: items });
const ol = (items: N[], start = 1): N => ({ type: "orderedList", attrs: { start, type: null }, content: items });
const doc = (...content: N[]): N => ({ type: "doc", content });
const md = (...content: N[]) => docToMarkdown(doc(...content));

describe("headings and paragraphs", () => {
  it("writes headings 1-3 and paragraphs separated by blank lines", () => {
    expect(md(h(1, t("Title")), p(t("Hello world")), h(2, t("Sub")), h(3, t("Deep")), p(t("Another")))).toBe(
      "# Title\n\nHello world\n\n## Sub\n\n### Deep\n\nAnother\n",
    );
  });
  it("formats text inside headings", () => {
    expect(md(h(2, t("A "), t("bold", "bold"), t(" word")))).toBe("## A **bold** word\n");
  });
  it("escapes # in headings so a trailing # run is not read as a closing sequence", () => {
    expect(md(h(1, t("Learning C#")))).toBe("# Learning C\\#\n");
  });
  it("flattens hard breaks in a heading to spaces (a heading is one line)", () => {
    expect(md(h(1, t("one"), br, t("two")))).toBe("# one two\n");
  });
});

describe("inline formatting", () => {
  it("bold and italic", () => {
    expect(md(p(t("a "), t("b", "bold"), t(" "), t("c", "italic")))).toBe("a **b** *c*\n");
  });
  it("combined bold + italic uses ***", () => {
    expect(md(p(t("plain "), t("both", "bold", "italic"), t(" end")))).toBe("plain ***both*** end\n");
  });
  it("mark order in the file does not matter", () => {
    expect(md(p(t("x", "italic", "bold")))).toBe("***x***\n");
  });
  it("overlapping or nested bold/italic spans are written as HTML (ambiguous as * runs); isolated spans stay compact", () => {
    expect(md(p(t("x ", "bold"), t("y", "bold", "italic"), t(" z", "italic")))).toBe("<strong>x <em>y</em></strong> *z*\n");
  });
  it("uses inline HTML when * delimiters would not be valid (next to punctuation attached to a word)", () => {
    // `x1*\_*` is not emphasis in CommonMark, so the italic span is written as <em>.
    expect(md(p(t("x1"), t("_", "italic")))).toBe("x1<em>\\_</em>\n");
    expect(md(p(t("ok "), t("!", "bold"), t("1.")))).toBe("ok <strong>!</strong>1.\n");
  });
  it("keeps the compact form where it is valid, including inside a word", () => {
    expect(md(p(t("un"), t("believ", "bold"), t("able")))).toBe("un**believ**able\n");
  });
  it("is cautious about emoji/symbols next to delimiters because parsers disagree about them", () => {
    expect(md(p(t("!", "bold"), t("😀")))).toBe("<strong>!</strong>😀\n");
    expect(md(p(t("ok", "bold"), t("😀")))).toBe("**ok**😀\n");
  });
  it("does not let a closing and an opening delimiter touch (**a***b* would be ambiguous)", () => {
    expect(md(p(t("a", "bold"), t("b", "italic")))).toBe("**a**<em>b</em>\n");
  });
  it("moves surrounding whitespace outside the delimiters (** x ** would not be bold)", () => {
    expect(md(p(t("a"), t(" b ", "bold"), t("c")))).toBe("a **b** c\n");
    expect(md(p(t("bold ", "bold"), t("x")))).toBe("**bold** x\n");
  });
  it("underline is written as inline HTML <u>", () => {
    expect(md(p(t("see "), t("this", "underline"), t(" now")))).toBe("see <u>this</u> now\n");
  });
  it("underline combined with bold and italic nests <u> outermost", () => {
    expect(md(p(t("x", "underline", "bold")))).toBe("<u>**x**</u>\n");
    expect(md(p(t("x", "italic", "underline", "bold")))).toBe("<u>***x***</u>\n");
  });
  it("hard breaks become a trailing backslash and marks are closed per line", () => {
    expect(md(p(t("line1"), br, t("line2")))).toBe("line1\\\nline2\n");
    expect(md(p(t("x", "bold"), br, t("y", "bold")))).toBe("**x**\\\n**y**\n");
  });
  it("keeps blank lines made of several breaks, and drops a trailing break", () => {
    expect(md(p(t("a"), br, br, t("b")))).toBe("a\\\n&nbsp;\\\nb\n");
    expect(md(p(t("a"), br))).toBe("a\n");
    expect(md(p(br, t("b")))).toBe("&nbsp;\\\nb\n");
  });
});

describe("lists", () => {
  it("bulleted list", () => {
    expect(md(ul(li(p(t("a"))), li(p(t("b")))))).toBe("- a\n- b\n");
  });
  it("numbered list honours its start number", () => {
    expect(md(ol([li(p(t("a"))), li(p(t("b")))]))).toBe("1. a\n2. b\n");
    expect(md(ol([li(p(t("a"))), li(p(t("b")))], 3))).toBe("3. a\n4. b\n");
  });
  it("nested bulleted lists", () => {
    expect(md(ul(li(p(t("parent")), ul(li(p(t("c1"))), li(p(t("c2"))))), li(p(t("next")))))).toBe(
      "- parent\n  - c1\n  - c2\n- next\n",
    );
  });
  it("nested numbered list is indented by the marker width", () => {
    expect(md(ol([li(p(t("one")), ol([li(p(t("a"))), li(p(t("b")))])), li(p(t("two")))]))).toBe(
      "1. one\n   1. a\n   2. b\n2. two\n",
    );
  });
  it("mixes bullets inside numbers and goes three levels deep", () => {
    expect(md(ol([li(p(t("a")), ul(li(p(t("b")), ul(li(p(t("c")))))))]))).toBe("1. a\n   - b\n     - c\n");
  });
  it("formats text and breaks inside list items; continuation lines are indented", () => {
    expect(md(ul(li(p(t("x", "bold"), br, t("more")))))).toBe("- **x**\\\n  more\n");
  });
  it("an item with two paragraphs keeps the second indented under it", () => {
    expect(md(ul(li(p(t("a")), p(t("b")))))).toBe("- a\n\n  b\n");
  });
  it("an empty item and an item whose first paragraph is empty but has a nested list", () => {
    expect(md(ul(li(p()), li(p(t("x")))))).toBe("-\n- x\n");
    expect(md(ul(li(p(), ul(li(p(t("n")))))))).toBe("- \n  - n\n");
  });
  it("a nested ordered list that does not start at 1 is separated by a blank line (it cannot interrupt a paragraph)", () => {
    expect(md(ul(li(p(t("a")), ol([li(p(t("x")))], 3))))).toBe("- a\n\n  3. x\n");
    expect(md(ul(li(p(t("a")), ol([li(p(t("x")))], 1))))).toBe("- a\n  1. x\n");
  });
  it("a nested list whose first item is empty is separated from the paragraph above it", () => {
    expect(md(ul(li(p(t("a")), ul(li(p())))))).toBe("- a\n\n  -\n");
  });
  it("separates a list from neighbouring blocks with blank lines", () => {
    expect(md(p(t("before")), ul(li(p(t("a")))), p(t("after")))).toBe("before\n\n- a\n\nafter\n");
  });
  it("keeps two adjacent lists of the same kind apart", () => {
    expect(md(ul(li(p(t("a")))), ul(li(p(t("b")))))).toBe("- a\n\n<!-- -->\n\n- b\n");
    expect(md(ul(li(p(t("a")))), ol([li(p(t("b")))]))).toBe("- a\n\n1. b\n");
  });
});

describe("Unicode and special characters", () => {
  it("passes Unicode through unchanged (accents, CJK, emoji, RTL, combining marks)", () => {
    const text = "Café naïve 日本語 😀🎉 مرحبا e\u0301 ñ ₹ Ω — “quotes”";
    expect(md(p(t(text)))).toBe(text + "\n");
  });
  it("escapes characters that would otherwise be formatting or HTML", () => {
    expect(md(p(t("*star* _under_ `code` [link](x) <b>html</b> back\\slash")))).toBe(
      "\\*star\\* \\_under\\_ \\`code\\` \\[link\\](x) \\<b>html\\</b> back\\\\slash\n",
    );
  });
  it("never lets typed HTML through as markup", () => {
    expect(md(p(t("<script>alert(1)</script>")))).toBe("\\<script>alert(1)\\</script>\n");
  });
  it("escapes ~~ and entity-looking text but leaves ordinary & and ~ alone", () => {
    expect(md(p(t("a ~~b~~ &amp; R&D ~5")))).toBe("a \\~\\~b\\~\\~ \\&amp; R&D ~5\n");
  });
  it("escapes line-start constructs so text is not turned into blocks", () => {
    expect(md(p(t("# not a heading")))).toBe("\\# not a heading\n");
    expect(md(p(t("> not a quote")))).toBe("\\> not a quote\n");
    expect(md(p(t("- not a bullet")))).toBe("\\- not a bullet\n");
    expect(md(p(t("+ not a bullet")))).toBe("\\+ not a bullet\n");
    expect(md(p(t("1. not a list")))).toBe("1\\. not a list\n");
    expect(md(p(t("2) not a list")))).toBe("2\\) not a list\n");
    expect(md(p(t("---")))).toBe("\\---\n");
    expect(md(p(t("===")))).toBe("\\===\n");
    expect(md(p(t("~~~js")))).toBe("\\~\\~~js\n"); // already escaped by the ~~ rule, so it cannot open a fence
  });
  it("escapes thematic-break variants, including dashes separated by spaces", () => {
    expect(md(p(t("- - -")))).toBe("\\- - -\n");
    expect(md(p(t("---  ---")))).toBe("\\---  ---\n");
    expect(md(p(t("--")))).toBe("--\n");
  });
  it("applies line-start escaping after a hard break and inside list items", () => {
    expect(md(p(t("ok"), br, t("# x")))).toBe("ok\\\n\\# x\n");
    expect(md(ul(li(p(t("- x")))))).toBe("- \\- x\n");
  });
  it("does not escape these when they are not at the start of the line", () => {
    expect(md(p(t("a # b > c - d 1. e")))).toBe("a # b > c - d 1. e\n");
  });
  it("preserves leading indentation as &nbsp; so it is not read as a code block", () => {
    expect(md(p(t("    indented")))).toBe("&nbsp;&nbsp;&nbsp;&nbsp;indented\n");
    expect(md(p(t("\ttab")))).toBe("&nbsp;&nbsp;&nbsp;&nbsp;tab\n");
  });
});

describe("empty and degenerate documents", () => {
  it("returns an empty string for empty documents", () => {
    expect(docToMarkdown({ type: "doc" })).toBe("");
    expect(docToMarkdown({ type: "doc", content: [] })).toBe("");
    expect(md(p())).toBe("");
    expect(md(p(), p(), h(1))).toBe("");
    expect(md(p(t("   ")))).toBe("");
  });
  it("is safe on invalid input", () => {
    for (const v of [null, undefined, "text", 5, [], {}]) expect(docToMarkdown(v)).toBe("");
  });
  it("drops empty paragraphs between content without leaving extra blank lines", () => {
    expect(md(p(t("a")), p(), p(), p(t("b")))).toBe("a\n\nb\n");
  });
  it("converts a plain-text import faithfully (integration with the .txt importer)", () => {
    const converted = parsePlainText("Line one\nLine two\n\nSecond paragraph 😀");
    expect(docToMarkdown(converted)).toBe("Line one\\\nLine two\n\nSecond paragraph 😀\n");
  });
});

describe("a realistic mixed document", () => {
  it("serialises headings, formatting, lists and breaks together", () => {
    const out = md(
      h(1, t("Project plan")),
      p(t("We will "), t("ship", "bold"), t(" the "), t("beta", "italic"), t(" soon"), br, t("Details below.")),
      h(2, t("Tasks")),
      ol([li(p(t("Design")), ul(li(p(t("Wireframes"))))), li(p(t("Build", "bold")))]),
    );
    expect(out).toBe(
      "# Project plan\n\nWe will **ship** the *beta* soon\\\nDetails below.\n\n## Tasks\n\n1. Design\n   - Wireframes\n2. **Build**\n",
    );
  });
});

describe("markdownFilename", () => {
  it("uses the title and appends .md", () => {
    expect(markdownFilename("My Plan")).toBe("My Plan.md");
    expect(markdownFilename("  Spaced    out   ")).toBe("Spaced out.md");
  });
  it("replaces path separators and reserved characters", () => {
    expect(markdownFilename('a/b\\c:d*e?f"g<h>i|j')).toBe("a-b-c-d-e-f-g-h-i-j.md");
  });
  it("cannot be used for path traversal or hidden files", () => {
    expect(markdownFilename("../../etc/passwd")).toBe("etc-passwd.md");
    expect(markdownFilename("..\\..\\windows\\system32")).toBe("windows-system32.md");
    expect(markdownFilename("  .hidden  ")).toBe("hidden.md");
    expect(markdownFilename("-rf")).toBe("rf.md");
    expect(markdownFilename("///")).toBe("document.md");
  });
  it("strips control, bidirectional and zero-width characters that could disguise an extension", () => {
    expect(markdownFilename("evil\u202Efdp.exe")).toBe("evilfdp.exe.md");
    expect(markdownFilename("a\u200Bb\uFEFFc")).toBe("abc.md");
    expect(markdownFilename("a\u0000b\nc\u007F")).toBe("abc.md");
  });
  it("has no trailing dots or spaces (Windows) and never ends up empty", () => {
    expect(markdownFilename("report...")).toBe("report.md");
    expect(markdownFilename("")).toBe("document.md");
    expect(markdownFilename("   ")).toBe("document.md");
    expect(markdownFilename("...")).toBe("document.md");
  });
  it("avoids Windows device names", () => {
    expect(markdownFilename("CON")).toBe("_CON.md");
    expect(markdownFilename("nul.txt")).toBe("_nul.txt.md");
    expect(markdownFilename("COM1")).toBe("_COM1.md");
    expect(markdownFilename("console")).toBe("console.md");
  });
  it("keeps Unicode and normalises it, and limits length to 100 characters plus extension", () => {
    expect(markdownFilename("日本語メモ 🎉")).toBe("日本語メモ 🎉.md");
    expect(markdownFilename("e\u0301")).toBe("\u00e9.md");
    const long = markdownFilename("あ".repeat(300));
    expect(Array.from(long)).toHaveLength(103);
    expect(long.endsWith(".md")).toBe(true);
  });
});
