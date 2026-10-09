/**
 * What moving a certificate to a status does to its print/send fields. Shared by the database layer (what gets
 * saved) and the board (the optimistic card update), so both always agree. Pure and dependency-free.
 *
 * Workflow: Pending -> Processing (QC) -> Printing -> Completed.
 *  - Pending / Processing: not printed, not sent, so every print/send field is CLEARED (null, not undefined:
 *    `undefined` is dropped from an update and the old value would stay).
 *  - Printing: printed now, not sent.
 *  - Completed: printed and sent now.
 */
export interface CertPrintFields {
  printed_at: string | null;
  printed_by: string | null;
  sent_at: string | null;
  sent_by: string | null;
}

export function printFieldsFor(status: string, by: string, nowIso: string): CertPrintFields {
  if (status === 'Printing') return { printed_at: nowIso, printed_by: by, sent_at: null, sent_by: null };
  if (status === 'Completed') return { printed_at: nowIso, printed_by: by, sent_at: nowIso, sent_by: by };
  return { printed_at: null, printed_by: null, sent_at: null, sent_by: null };
}
