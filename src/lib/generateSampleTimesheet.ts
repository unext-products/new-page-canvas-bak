import ExcelJS from "exceljs";

export interface CategoryForTemplate {
  name: string;
}

/**
 * Generate a sample timesheet Excel file with:
 * - Sheet 1 "Timesheet": the standard columns with a sample row
 * - Sheet 2 "Activity Types": list of valid activity type names
 * - Data validation dropdown on the Activity Type column referencing Sheet 2
 */
export async function generateSampleTimesheetBlob(
  categories: CategoryForTemplate[],
  isAdmin: boolean
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();

  // --- Sheet 1: Timesheet (added first so it appears first) ---
  const ws = workbook.addWorksheet("Timesheet");

  // --- Sheet 2: Activity Types ---
  const refSheet = workbook.addWorksheet("Activity Types");
  refSheet.getColumn(1).header = "Activity Type";
  refSheet.getColumn(1).width = 30;
  categories.forEach((cat, i) => {
    refSheet.getCell(i + 2, 1).value = cat.name;
  });

  if (isAdmin) {
    // Admin 8-column format
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

    // Sample row
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

    // Activity type is column 5 (E) for admin
    applyDropdownValidation(ws, 5, categories.length);
  } else {
    // Member/Manager 9-column format
    const headers = [
      "entry_date",
      "start_time",
      "end_time",
      "activity_type",
      "batch",
      "program",
      "subject",
      "notes",
      "department_code",
    ];
    const widths = [12, 10, 10, 20, 15, 15, 15, 30, 15];
    headers.forEach((h, i) => {
      const col = ws.getColumn(i + 1);
      col.header = h;
      col.width = widths[i];
    });

    // Sample row
    ws.addRow([
      "15/01/2025",
      "09:00",
      "11:00",
      categories.length > 0 ? categories[0].name : "",
      "",
      "PROG01",
      "",
      "Sample notes",
      "CS",
    ]);

    // Activity type is column 4 (D) for member
    applyDropdownValidation(ws, 4, categories.length);
  }

  // Style header row
  ws.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
  });
  refSheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/**
 * Apply data validation (dropdown list) on a column for rows 2–200,
 * referencing the Activity Types sheet.
 */
function applyDropdownValidation(
  ws: ExcelJS.Worksheet,
  colIndex: number,
  categoryCount: number
) {
  if (categoryCount === 0) return;

  const lastRow = categoryCount + 1; // +1 for header row on ref sheet
  // ExcelJS uses formulae referencing for list validation
  const formula = `'Activity Types'!$A$2:$A$${lastRow}`;

  for (let row = 2; row <= 200; row++) {
    ws.getCell(row, colIndex).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [formula],
      showErrorMessage: true,
      errorTitle: "Invalid Activity Type",
      error: "Please select a valid activity type from the dropdown.",
    };
  }
}
