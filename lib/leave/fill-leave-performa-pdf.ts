import {
  PDFDocument,
  PDFDropdown,
  PDFField,
  PDFForm,
  PDFOptionList,
  PDFTextField,
  StandardFonts,
} from "pdf-lib";

/**
 * AcroForm field names your leave performa PDF should define (any one alias per line works).
 * Leave blank in the generated file: home country, declarations, signatures (do not set or clear).
 *
 * Note: Names set in Jotform’s “Unique Name” apply only to the Jotform web form. The file you
 * upload as the leave template in Company documents must be a PDF whose **AcroForm** field names
 * match (verify in Acrobat → Prepare Form). Jotform date widgets often become multiple PDF fields
 * (e.g. month/day/year) — use plain text fields in the template for reliable fills.
 */
export type LeavePerformaFillInput = {
  requestor_full_name: string;
  /** Usually the date the performa is generated (YYYY-MM-DD). */
  requestor_date: string;
  requestor_iqama: string;
  /** Portal role(s) for requester (PDF “job title” field). */
  requestor_job_title: string;
  requestor_project: string;
  requestor_region: string;
  leave_type: string;
  guarantor_name: string;
  guarantor_iqama: string;
  guarantor_phone: string;
  guarantor_email: string;
  /** Portal role(s) for guarantor (PDF “designation” field). */
  guarantor_designation: string;
  guarantor_project: string;
  guarantor_region: string;
  leave_start_date: string;
  leave_end_date: string;
  leave_total_days: string;
};

function lastSegment(name: string): string {
  const parts = name.split(".");
  return parts[parts.length - 1] ?? name;
}

/** Resolve AcroForm field: exact name, dotted suffix, or bracketed terminal (e.g. fts_name[0]). */
function resolveField(form: PDFForm, aliases: string[]): PDFField | undefined {
  for (const alias of aliases) {
    const direct = form.getFieldMaybe(alias);
    if (direct) return direct;
  }
  const all = form.getFields();
  for (const alias of aliases) {
    const hit = all.find((f) => {
      const n = f.getName();
      if (n === alias) return true;
      if (n.endsWith(`.${alias}`)) return true;
      const last = lastSegment(n);
      if (last === alias) return true;
      if (last.startsWith(`${alias}[`)) return true;
      return false;
    });
    if (hit) return hit;
  }
  return undefined;
}

function setValueOnField(field: PDFField, value: string): boolean {
  const v = value ?? "";
  try {
    if (field instanceof PDFTextField) {
      field.setText(v);
      return true;
    }
    if (field instanceof PDFDropdown) {
      const opts = field.getOptions();
      if (opts.includes(v)) {
        field.select(v);
        return true;
      }
      const lower = v.toLowerCase();
      const match = opts.find((o) => o.toLowerCase() === lower);
      if (match) {
        field.select(match);
        return true;
      }
      return false;
    }
    if (field instanceof PDFOptionList) {
      const opts = field.getOptions();
      if (opts.includes(v)) {
        field.select(v);
        return true;
      }
      const lower = v.toLowerCase();
      const match = opts.find((o) => o.toLowerCase() === lower);
      if (match) {
        field.select(match);
        return true;
      }
      return false;
    }
  } catch {
    return false;
  }
  return false;
}

function setFirstMatch(form: PDFForm, aliases: string[], value: string): void {
  const v = value ?? "";
  const field = resolveField(form, aliases);
  if (field && setValueOnField(field, v)) return;
  for (const name of aliases) {
    try {
      form.getTextField(name).setText(v);
      return;
    } catch {
      /* wrong type or missing */
    }
  }
}

function clearFirstMatch(form: PDFForm, aliases: string[]): void {
  const field = resolveField(form, aliases);
  if (field instanceof PDFTextField) {
    try {
      field.setText("");
      return;
    } catch {
      /* fall through */
    }
  }
  for (const name of aliases) {
    try {
      form.getTextField(name).setText("");
      return;
    } catch {
      /* ignore */
    }
  }
}

/**
 * Fills a PDF template. Fields that are not present in the PDF are skipped.
 * Home country + signature blocks are explicitly cleared when those aliases exist.
 */
export async function fillLeavePerformaPdf(templateBytes: Uint8Array, data: LeavePerformaFillInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
  let form: PDFForm;
  try {
    form = pdfDoc.getForm();
  } catch {
    return templateBytes;
  }

  if (form.hasXFA()) {
    try {
      form.deleteXFA();
    } catch {
      /* keep going; some PDFs still fill */
    }
  }

  setFirstMatch(form, ["fts_requestor_full_name", "requestor_full_name", "Requestor_Full_Name", "full_name"], data.requestor_full_name);
  setFirstMatch(form, ["fts_requestor_date", "requestor_date", "Requestor_Date", "date"], data.requestor_date);
  setFirstMatch(form, ["fts_requestor_iqama", "requestor_iqama", "Requestor_Iqama", "iqama_no"], data.requestor_iqama);
  setFirstMatch(form, ["fts_requestor_job_title", "requestor_job_title", "Job_Title", "job_title"], data.requestor_job_title);
  setFirstMatch(form, ["fts_requestor_project", "requestor_project", "Project", "project"], data.requestor_project);
  setFirstMatch(form, ["fts_requestor_region", "requestor_region", "Region", "region"], data.requestor_region);
  setFirstMatch(form, ["fts_leave_type", "leave_type", "Leave_Type", "type_of_leave"], data.leave_type);

  clearFirstMatch(form, ["fts_home_phone", "home_phone", "Home_Phone"]);
  clearFirstMatch(form, ["fts_home_city", "home_city", "Home_City"]);
  clearFirstMatch(form, ["fts_home_country", "home_country", "Home_Country"]);
  clearFirstMatch(form, ["fts_home_address", "home_address", "Home_Address"]);

  setFirstMatch(form, ["fts_guarantor_name", "guarantor_name", "Guarantor_Name"], data.guarantor_name);
  setFirstMatch(form, ["fts_guarantor_iqama", "guarantor_iqama", "Guarantor_Iqama"], data.guarantor_iqama);
  setFirstMatch(form, ["fts_guarantor_phone", "guarantor_phone", "Guarantor_Phone"], data.guarantor_phone);
  setFirstMatch(form, ["fts_guarantor_email", "guarantor_email", "Guarantor_Email"], data.guarantor_email);
  setFirstMatch(form, ["fts_guarantor_designation", "guarantor_designation", "Guarantor_Designation"], data.guarantor_designation);
  setFirstMatch(form, ["fts_guarantor_project", "guarantor_project", "Guarantor_Project"], data.guarantor_project);
  setFirstMatch(form, ["fts_guarantor_region", "guarantor_region", "Guarantor_Region"], data.guarantor_region);

  setFirstMatch(form, ["fts_leave_start_date", "leave_start_date", "Leave_Start_Date", "start_date"], data.leave_start_date);
  setFirstMatch(form, ["fts_leave_end_date", "leave_end_date", "Leave_End_Date", "end_date"], data.leave_end_date);
  setFirstMatch(
    form,
    ["fts_leave_total_days", "leave_total_days", "Total_No_of_Leave_Days", "total_days"],
    data.leave_total_days
  );

  clearFirstMatch(form, ["fts_requestor_sig_date", "requestor_sig_date", "Requestor_Signature_Date"]);
  clearFirstMatch(form, ["fts_requestor_sig_name", "requestor_sig_name", "Requestor_Signature_Name"]);
  clearFirstMatch(form, ["fts_requestor_signature", "requestor_signature", "Requestor_Signature"]);
  clearFirstMatch(form, ["fts_guarantor_sig_date", "guarantor_sig_date", "Guarantor_Signature_Date"]);
  clearFirstMatch(form, ["fts_guarantor_sig_name", "guarantor_sig_name", "Guarantor_Signature_Name"]);
  clearFirstMatch(form, ["fts_guarantor_signature", "guarantor_signature", "Guarantor_Signature"]);

  try {
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    form.updateFieldAppearances(font);
  } catch {
    /* values still stored; some viewers show without custom appearances */
  }

  const bytes = await pdfDoc.save();
  return bytes;
}
