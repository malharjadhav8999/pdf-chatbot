// Import the implementation file directly. Importing the package root runs
// pdf-parse's debug code that tries to read a sample PDF from disk and crashes
// in a bundled/server environment.
// @ts-expect-error - no type declarations for the deep import path
import pdfParse from "pdf-parse/lib/pdf-parse.js";

/**
 * Extract plain text from a PDF buffer. Works for any PDF — legal docs,
 * research papers, manuals, invoices, etc.
 */
export async function extractPdfText(buffer: Buffer): Promise<{
  text: string;
  numPages: number;
}> {
  const data = await pdfParse(buffer);
  return {
    text: (data.text || "").trim(),
    numPages: data.numpages ?? 0,
  };
}
