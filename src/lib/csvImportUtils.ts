import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";

export interface CSVRow {
  faculty_email: string;
  entry_date: string;
  start_time: string;
  end_time: string;
  activity_type: string;
  activity_subtype?: string;
  notes?: string;
  department_code: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  data?: {
    user_id: string;
    department_id: string;
    entry_date: string;
    start_time: string;
    end_time: string;
    duration_minutes: number;
    activity_type: string;
    activity_subtype: string | null;
    notes: string | null;
    status: "draft" | "submitted";
  };
  rowData?: CSVRow;
}

export function parseCSVFile(file: File): Promise<CSVRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (results) => {
        resolve(results.data as CSVRow[]);
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}

export async function validateCSVRow(
  row: CSVRow,
  usersMap: Map<string, string>,
  deptsMap: Map<string, string>
): Promise<ValidationResult> {
  const errors: string[] = [];

  // Validate required fields
  if (!row.faculty_email) errors.push("Missing faculty_email");
  if (!row.entry_date) errors.push("Missing entry_date");
  if (!row.start_time) errors.push("Missing start_time");
  if (!row.end_time) errors.push("Missing end_time");
  if (!row.activity_type) errors.push("Missing activity_type");
  if (!row.department_code) errors.push("Missing department_code");

  if (errors.length > 0) {
    return { isValid: false, errors, rowData: row };
  }

  // Validate email and lookup user
  const userId = usersMap.get(row.faculty_email.toLowerCase().trim());
  if (!userId) {
    errors.push(`User not found: ${row.faculty_email}`);
  }

  // Validate department code
  const deptId = deptsMap.get(row.department_code.toUpperCase().trim());
  if (!deptId) {
    errors.push(`Department not found: ${row.department_code}`);
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(row.entry_date)) {
    errors.push(`Invalid date format: ${row.entry_date} (expected YYYY-MM-DD)`);
  }

  // Validate time format
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(row.start_time)) {
    errors.push(`Invalid start_time format: ${row.start_time} (expected HH:MM)`);
  }
  if (!timeRegex.test(row.end_time)) {
    errors.push(`Invalid end_time format: ${row.end_time} (expected HH:MM)`);
  }

  // Calculate duration
  let durationMinutes = 0;
  if (timeRegex.test(row.start_time) && timeRegex.test(row.end_time)) {
    const [startHour, startMin] = row.start_time.split(":").map(Number);
    const [endHour, endMin] = row.end_time.split(":").map(Number);
    durationMinutes = endHour * 60 + endMin - (startHour * 60 + startMin);

    if (durationMinutes <= 0) {
      errors.push("start_time must be before end_time");
    }
  }

  // Validate activity type
  const validActivityTypes = ["class", "quiz", "invigilation", "admin", "other"];
  if (!validActivityTypes.includes(row.activity_type.toLowerCase().trim())) {
    errors.push(`Invalid activity_type: ${row.activity_type}`);
  }

  if (errors.length > 0) {
    return { isValid: false, errors, rowData: row };
  }

  return {
    isValid: true,
    errors: [],
    rowData: row,
    data: {
      user_id: userId!,
      department_id: deptId!,
      entry_date: row.entry_date,
      start_time: row.start_time,
      end_time: row.end_time,
      duration_minutes: durationMinutes,
      activity_type: row.activity_type.toLowerCase().trim(),
      activity_subtype: row.activity_subtype?.trim() || null,
      notes: row.notes?.trim() || null,
      status: "draft",
    },
  };
}

export async function bulkInsertTimesheets(entries: any[]) {
  const batchSize = 100;
  const results = { success: 0, failed: 0, errors: [] as any[] };

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);

    try {
      const { error } = await supabase.from("timesheet_entries").insert(batch);

      if (error) {
        results.failed += batch.length;
        results.errors.push({
          batch: i / batchSize + 1,
          error: error.message,
        });
      } else {
        results.success += batch.length;
      }
    } catch (err: any) {
      results.failed += batch.length;
      results.errors.push({
        batch: i / batchSize + 1,
        error: err.message,
      });
    }
  }

  return results;
}

export async function fetchUsersAndDepartments() {
  try {
    // Fetch auth users to get emails (admin only)
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
    const deptsResponse = await supabase.from("departments").select("id, code");

    if (authError) {
      console.error("Error fetching auth users:", authError);
    }

    const usersMap = new Map<string, string>();
    if (authData && 'users' in authData) {
      const authUsers = authData.users as any[];
      authUsers?.forEach((user: any) => {
        if (user.email) {
          usersMap.set(user.email.toLowerCase(), user.id);
        }
      });
    }

    const deptsMap = new Map<string, string>();
    deptsResponse.data?.forEach((dept) => {
      deptsMap.set(dept.code.toUpperCase(), dept.id);
    });

    return { usersMap, deptsMap };
  } catch (error) {
    console.error("Error in fetchUsersAndDepartments:", error);
    return { usersMap: new Map(), deptsMap: new Map() };
  }
}

export function generateCSVTemplate(): string {
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

  const exampleRow = [
    "faculty@university.edu",
    "2025-01-15",
    "09:00",
    "11:00",
    "class",
    "CS101 - Introduction",
    "Lecture on Python basics",
    "CS",
  ];

  const csvContent = [headers, exampleRow]
    .map((row) => row.map((cell) => `"${cell}"`).join(","))
    .join("\n");

  return csvContent;
}
