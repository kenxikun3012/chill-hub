// Converts the simple Markdown used in SPEC.md into a styled .docx
// Usage: node tools/md2docx.js SPEC.md "Chill Hub - Requirements Specification.docx"   (needs the `docx` npm package)
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, AlignmentType, LevelFormat, Footer, Header,
  PageNumber, TableLayoutType,
} = require('docx');

const [, , inPath, outPath] = process.argv;
const lines = fs.readFileSync(inPath, 'utf8').replace(/\r/g, '').split('\n');

const FONT = 'Calibri';
const ACCENT = '2E3A59';
const CONTENT_WIDTH = 11906 - 2 * 1300; // A4 width minus margins (DXA)

// **bold** and `code` inline formatting
function runs(text, base = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), ...base }));
    const t = m[0];
    if (t.startsWith('**')) out.push(new TextRun({ text: t.slice(2, -2), ...base, bold: true }));
    else out.push(new TextRun({ text: t.slice(1, -1), ...base, font: 'Consolas', size: 19, color: '7A2E2E' }));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...base }));
  return out;
}

const plain = (s) => s.replace(/\*\*|`/g, '');
const splitRow = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
const border = { style: BorderStyle.SINGLE, size: 4, color: 'C8CDD8' };
const borders = { top: border, bottom: border, left: border, right: border };

function buildTable(rows) {
  const header = rows[0];
  const body = rows.slice(2);
  const noHeader = header.every((c) => c === '');
  const ncol = header.length;
  const all = noHeader ? body : [header, ...body];

  // Column widths proportional to content length, clamped
  const weights = [];
  for (let c = 0; c < ncol; c++) {
    const max = Math.max(...all.map((r) => plain(r[c] || '').length));
    weights.push(Math.min(Math.max(max, 10), 70));
  }
  const total = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((w) => Math.floor((w / total) * CONTENT_WIDTH));
  widths[ncol - 1] += CONTENT_WIDTH - widths.reduce((a, b) => a + b, 0);

  const cell = (text, c, isHeader, isKeyCol) => new TableCell({
    width: { size: widths[c], type: WidthType.DXA },
    borders,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    shading: isHeader
      ? { type: ShadingType.CLEAR, fill: ACCENT, color: 'auto' }
      : isKeyCol ? { type: ShadingType.CLEAR, fill: 'EEF1F6', color: 'auto' } : undefined,
    children: [new Paragraph({
      spacing: { before: 0, after: 0 },
      children: runs(text, isHeader ? { bold: true, color: 'FFFFFF', size: 20 } : { size: 20, bold: isKeyCol || undefined }),
    })],
  });

  const tableRows = [];
  if (!noHeader) tableRows.push(new TableRow({ tableHeader: true, children: header.map((t, c) => cell(t, c, true, false)) }));
  for (const r of body) tableRows.push(new TableRow({ children: header.map((_, c) => cell(r[c] || '', c, false, noHeader && c === 0)) }));

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    rows: tableRows,
  });
}

const children = [];
let numberedInstance = 0;
let inNumbered = false;
let title = '';

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!/^\d+\.\s/.test(line)) inNumbered = false;

  if (line.trim() === '') continue;

  if (line.startsWith('|')) {
    const rows = [];
    while (i < lines.length && lines[i].startsWith('|')) rows.push(splitRow(lines[i++]));
    i--;
    children.push(buildTable(rows));
    children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    continue;
  }

  if (line.trim() === '---') {
    children.push(new Paragraph({
      spacing: { before: 120, after: 120 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'C8CDD8', space: 1 } },
      children: [],
    }));
    continue;
  }

  let m;
  if ((m = line.match(/^# (.*)/))) {
    title = plain(m[1]);
    children.push(new Paragraph({ heading: HeadingLevel.TITLE, spacing: { after: 240 }, children: runs(m[1]) }));
  } else if ((m = line.match(/^## (.*)/))) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: runs(m[1]) }));
  } else if ((m = line.match(/^### (.*)/))) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: runs(m[1]) }));
  } else if ((m = line.match(/^- (.*)/))) {
    children.push(new Paragraph({ numbering: { reference: 'bullets', level: 0 }, spacing: { after: 60 }, children: runs(m[1]) }));
  } else if ((m = line.match(/^\d+\.\s(.*)/))) {
    if (!inNumbered) { numberedInstance++; inNumbered = true; }
    children.push(new Paragraph({ numbering: { reference: 'numbers', level: 0, instance: numberedInstance }, spacing: { after: 60 }, children: runs(m[1]) }));
  } else {
    children.push(new Paragraph({ spacing: { after: 120 }, children: runs(line) }));
  }
}

const doc = new Document({
  creator: 'Chill Hub',
  title,
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal', next: 'Normal', run: { size: 44, bold: true, color: ACCENT, font: FONT } },
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 32, bold: true, color: ACCENT, font: FONT }, paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0, keepNext: true, keepLines: true } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, color: '44546A', font: FONT }, paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1, keepNext: true, keepLines: true } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
      { reference: 'numbers', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1300, bottom: 1300, left: 1300, right: 1300 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: title, size: 16, color: '8A93A6' })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], size: 16, color: '8A93A6' })] })] }) },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(outPath, buf); console.log('wrote', outPath); });
