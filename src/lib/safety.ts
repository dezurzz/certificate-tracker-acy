import { z } from 'zod';

/**
 * Escapes characters that can lead to CSV Injection attacks
 * (e.g., =, +, -, @, tab, carriage return).
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
  
  // Basic XSS escaping for text inputs
  return clean
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
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
