import ExcelJS from "exceljs";

export interface CategoryForTemplate {
  name: string;
}

export interface ReferenceData {
  programs: { name: string }[];
  subjects: { code: string; name: string }[];
  verticals: { name: string; code: string }[];
}

/**
 * Generate a sample timesheet Excel file with:
 * - Sheet 1 "Timesheet": the standard columns with a sample row
 * - Sheet 2 "Activity Types": list of valid activity type names
 * - Sheet 3 "Batch": Batch-1 to Batch-200 (hardcoded)
 * - Sheet 4 "Program": dynamic program names
 * - Sheet 5 "Subject": "CODE-Name" format
 * - Sheet 6 "Dept Code": vertical name + vertical code
 * Data validation dropdowns reference the respective sheets.
 */
export async function generateSampleTimesheetBlob(
  categories: CategoryForTemplate[],
  isAdmin: boolean,
  referenceData?: ReferenceData
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();

  // --- Sheet 1: Timesheet ---
  const ws = workbook.addWorksheet("Timesheet");

  // --- Sheet 2: Activity Types ---
  const refSheet = workbook.addWorksheet("Activity Types");
  refSheet.getColumn(1).header = "Activity Type";
  refSheet.getColumn(1).width = 30;
  categories.forEach((cat, i) => {
    refSheet.getCell(i + 2, 1).value = cat.name;
  });

  // --- Sheet 3: Batch (hardcoded Batch-1 to Batch-200) ---
  const batchSheet = workbook.addWorksheet("Batch");
  batchSheet.getColumn(1).header = "Name";
  batchSheet.getColumn(1).width = 15;
  for (let i = 1; i <= 200; i++) {
    batchSheet.getCell(i + 1, 1).value = `Batch-${i}`;
  }

  // --- Sheet 4: Program (dynamic) ---
  const programSheet = workbook.addWorksheet("Program");
  programSheet.getColumn(1).header = "Program";
  programSheet.getColumn(1).width = 35;
  const programs = referenceData?.programs || [];
  programs.forEach((p, i) => {
    programSheet.getCell(i + 2, 1).value = p.name;
  });

  // --- Sheet 5: Subject (dynamic, "CODE-Name" format) ---
  const subjectSheet = workbook.addWorksheet("Subject");
  subjectSheet.getColumn(1).header = "Subject Names and CODE";
  subjectSheet.getColumn(1).width = 45;
  const subjects = referenceData?.subjects || [];
  subjects.forEach((s, i) => {
    subjectSheet.getCell(i + 2, 1).value = `${s.code}-${s.name}`;
  });

  // --- Sheet 6: Dept Code (dynamic, 2 columns) ---
  const deptSheet = workbook.addWorksheet("Dept Code");
  deptSheet.getColumn(1).header = "Department/Vertical";
  deptSheet.getColumn(1).width = 35;
  deptSheet.getColumn(2).header = "Department Code";
  deptSheet.getColumn(2).width = 20;
  const verticals = referenceData?.verticals || [];
  verticals.forEach((v, i) => {
    deptSheet.getCell(i + 2, 1).value = v.name;
    deptSheet.getCell(i + 2, 2).value = v.code;
  });

  // Column indices differ between admin and member formats
  if (isAdmin) {
    const headers = [
      "faculty_email",
      "entry_date",
      "start_time",
      "end_time",
      "activity_type",
      "activity_subtype",
      "notes",
      "department_code",
    ];
    const widths = [25, 12, 10, 10, 20, 20, 30, 15];
    headers.forEach((h, i) => {
      const col = ws.getColumn(i + 1);
      col.header = h;
      col.width = widths[i];
    });

    ws.addRow([
      "faculty@example.com",
      "15/01/2025",
      "09:00",
      "11:00",
      categories.length > 0 ? categories[0].name : "",
      "",
      "Sample notes",
      "CS",
    ]);

    // Admin: activity_type=5, no batch/program/subject columns
    applyDropdownValidation(ws, 5, categories.length, "Activity Types");
    // department_code col 8 -> Dept Code sheet col B
    applyDropdownValidation(ws, 8, verticals.length, "Dept Code");
  } else {
    const headers = [
      "entry_date",
      "start_time",
      "end_time",
      "activity_type",
      "Batch",
      "Program",
      "Subjects",
      "notes",
      "department_code",
    ];
    const widths = [12, 10, 10, 20, 15, 20, 30, 30, 15];
    headers.forEach((h, i) => {
      const col = ws.getColumn(i + 1);
      col.header = h;
      col.width = widths[i];
    });

    ws.addRow([
      "15/01/2025",
      "09:00",
      "11:00",
      categories.length > 0 ? categories[0].name : "",
      "",
      "",
      "",
      "Sample notes",
      "",
    ]);

    // Member: activity_type=4, batch=5, program=6, subject=7, dept_code=9
    applyDropdownValidation(ws, 4, categories.length, "Activity Types");
    applyDropdownValidation(ws, 5, 200, "Batch");
    applyDropdownValidation(ws, 6, programs.length, "Program");
    applyDropdownValidation(ws, 7, subjects.length, "Subject");
    applyDropdownValidation(ws, 9, verticals.length, "Dept Code");
  }

  // Style all header rows
  [ws, refSheet, batchSheet, programSheet, subjectSheet, deptSheet].forEach((sheet) => {
    sheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/**
 * Apply data validation (dropdown list) on a column for rows 2–200,
 * referencing a named sheet's column A.
 */
function applyDropdownValidation(
  ws: ExcelJS.Worksheet,
  colIndex: number,
  itemCount: number,
  sheetName: string
) {
  if (itemCount === 0) return;

  const lastRow = itemCount + 1; // +1 for header row on ref sheet
  const formula = `'${sheetName}'!$A$2:$A$${lastRow}`;

  for (let row = 2; row <= 200; row++) {
    ws.getCell(row, colIndex).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [formula],
      showErrorMessage: true,
      errorTitle: `Invalid ${sheetName}`,
      error: `Please select a valid value from the dropdown.`,
    };
  }
}
