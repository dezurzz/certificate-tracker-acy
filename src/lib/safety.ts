import { z } from 'zod';

/**
 * Trims the text and neutralises a leading spreadsheet-formula character (CSV injection: =, +, -, @, tab, CR).
 * It deliberately does NOT HTML-escape: the UI never renders stored text as HTML, so escaping only corrupted
 * names such as "MEDCO E&P".
 */
export function sanitizeString(val: string): string {
  if (!val) return '';
  const clean = val.trim();
  
  // CSV Injection indicators
  const injectionChars = ['=', '+', '-', '@', '\t', '\r'];
  if (injectionChars.includes(clean.charAt(0))) {
    // Prepend a single quote to neutralize formula evaluation in Excel/CSV readers
    return `'${clean}`;
  }
  
  // No HTML escaping here: React escapes text on output, and escaping on input stored "&amp;" / "&#x27;" in the database
  return clean;
}

/**
 * Schema for manual Training Batch Creation / Editing.
 * Provides strict backend-level safety guarantees.
 */
export const trainingSchema = z.object({
  program_name: z.string().min(2, "Program name must be at least 2 characters").max(100),
  batch_code: z.string().min(2, "Batch code must be at least 2 characters").max(50),
  start_date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid start date format",
  }),
  end_date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid end date format",
  }),
  pic: z.string().min(2, "PIC name must be at least 2 characters").max(50),
  location: z.string().max(100).default('Jakarta Training Center'),
  status: z.enum(['Completed', 'Processing', 'Pending']).default('Processing')
}).refine(data => new Date(data.end_date) >= new Date(data.start_date), {
  message: "End date must be on or after the start date",
  path: ["end_date"]
});
