export interface ExtractedSegment {
  text: string;
  pageNumber: number | null;
}

export interface ExtractionResult {
  segments: ExtractedSegment[];
  fullText: string;
}

export async function extractTextFromFile(
  filePath: string,
  extension: string,
): Promise<ExtractionResult> {
  switch (extension) {
    case "txt":
    case "md":
      return extractPlainText(filePath);
    case "pdf":
      return extractPdf(filePath);
    case "docx":
      return extractDocx(filePath);
    case "csv":
      return extractCsv(filePath);
    case "json":
      return extractJson(filePath);
    default:
      throw new Error(`Unsupported file type: ${extension}`);
  }
}

async function extractPlainText(filePath: string): Promise<ExtractionResult> {
  const fs = await import("node:fs/promises");
  const text = await fs.readFile(filePath, "utf8");
  return {
    segments: [{ text, pageNumber: null }],
    fullText: text,
  };
}

async function extractPdf(filePath: string): Promise<ExtractionResult> {
  const fs = await import("node:fs/promises");
  const buffer = await fs.readFile(filePath);

  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
    const pdf = await loadingTask.promise;
    const segments: ExtractedSegment[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) {
        segments.push({ text, pageNumber: pageNum });
      }
    }

    const fullText = segments.map((segment) => segment.text).join("\n\n");
    return { segments, fullText };
  } catch {
    const pdfParse = (await import("pdf-parse")).default;
    const parsed = await pdfParse(buffer);
    const text = parsed.text?.trim() ?? "";
    return {
      segments: text ? [{ text, pageNumber: null }] : [],
      fullText: text,
    };
  }
}

async function extractDocx(filePath: string): Promise<ExtractionResult> {
  const fs = await import("node:fs/promises");
  const mammoth = await import("mammoth");
  const buffer = await fs.readFile(filePath);
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value.trim();
  return {
    segments: text ? [{ text, pageNumber: null }] : [],
    fullText: text,
  };
}

async function extractCsv(filePath: string): Promise<ExtractionResult> {
  const fs = await import("node:fs/promises");
  const { parse } = await import("csv-parse/sync");
  const raw = await fs.readFile(filePath, "utf8");
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  const lines = rows.map((row, index) => {
    const cells = Object.entries(row)
      .map(([key, value]) => `${key}: ${value}`)
      .join(" | ");
    return `Row ${index + 1}: ${cells}`;
  });

  const text = lines.join("\n");
  return {
    segments: text ? [{ text, pageNumber: null }] : [],
    fullText: text,
  };
}

async function extractJson(filePath: string): Promise<ExtractionResult> {
  const fs = await import("node:fs/promises");
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const text = JSON.stringify(parsed, null, 2);
  return {
    segments: [{ text, pageNumber: null }],
    fullText: text,
  };
}
