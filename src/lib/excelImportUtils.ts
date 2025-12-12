import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { getUserErrorMessage } from "./errorHandler";

// Common row structure
interface ExcelRowBase {
  entry_date: string;
  start_time: string;
  end_time: string;
  activity_type: string;
  activity_subtype?: string;
  notes?: string;
  department_code: string;
}

// Admin mode includes member email
interface AdminExcelRow extends ExcelRowBase {
  member_email: string;
}

// Member mode doesn't need email
interface MemberExcelRow extends ExcelRowBase {}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  data?: any;
}

/**
 * Convert Excel time decimal to HH:MM format
 * Excel stores times as fractions of a day (e.g., 0.375 = 9:00 AM, 0.5 = 12:00 PM)
 */
function excelTimeToHHMM(value: any): string {
  // If already a string in HH:MM format, return as-is
  if (typeof value === 'string') {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (timeRegex.test(value)) {
      // Ensure consistent HH:MM format (pad hours)
      const [hours, minutes] = value.split(':');
      return `${hours.padStart(2, '0')}:${minutes}`;
    }
    return value;
  }
  
  // If it's a number (Excel decimal time), convert it
  if (typeof value === 'number') {
    const totalMinutes = Math.round(value * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  
  return String(value);
}

/**
 * Convert Excel date serial number to DD/MM/YYYY or pass through string dates
 */
function excelDateToString(value: any): string {
  // If already a string, return as-is
  if (typeof value === 'string') {
    return value;
  }
  
  // If it's a number (Excel date serial), convert it
  if (typeof value === 'number') {
    // Excel date serial: days since 1900-01-01 (with a bug for 1900 leap year)
    const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
    const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
  
  return String(value);
}

/**
 * Parse Excel file to JSON array with proper time/date handling
 */
export async function parseExcelFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: true });
        
        // Convert Excel time decimals and dates to proper formats
        const processedData = jsonData.map((row: any) => ({
          ...row,
          start_time: row.start_time !== undefined ? excelTimeToHHMM(row.start_time) : undefined,
          end_time: row.end_time !== undefined ? excelTimeToHHMM(row.end_time) : undefined,
          entry_date: row.entry_date !== undefined ? excelDateToString(row.entry_date) : undefined,
        }));
        
        resolve(processedData);
      } catch (error) {
        reject(new Error('Failed to parse Excel file. Please ensure it is a valid Excel file.'));
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Validate row for member mode (no email needed) with user department check
 */
export async function validateMemberExcelRow(
  row: MemberExcelRow,
  userId: string,
  departmentId: string,
  deptsMap: Map<string, string>,
  userDeptCodes?: Set<string>
): Promise<ValidationResult> {
  const errors: string[] = [];

  // Required fields
  if (!row.entry_date) errors.push("entry_date is required");
  if (!row.start_time) errors.push("start_time is required");
  if (!row.end_time) errors.push("end_time is required");
  if (!row.activity_type) errors.push("activity_type is required");
  if (!row.department_code) errors.push("department_code is required");

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // Validate date format (DD/MM/YYYY or YYYY-MM-DD)
  const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const isoFormat = /^\d{4}-\d{2}-\d{2}$/;
  let normalizedDate = row.entry_date;
  
  const ddMatch = row.entry_date.match(ddmmyyyy);
  if (ddMatch) {
    // Convert DD/MM/YYYY to YYYY-MM-DD
    normalizedDate = `${ddMatch[3]}-${ddMatch[2].padStart(2, '0')}-${ddMatch[1].padStart(2, '0')}`;
  } else if (!isoFormat.test(row.entry_date)) {
    errors.push("entry_date must be in DD/MM/YYYY format");
  }

  // Validate time format
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(row.start_time)) {
    errors.push("start_time must be in HH:MM format (24-hour)");
  }
  if (!timeRegex.test(row.end_time)) {
    errors.push("end_time must be in HH:MM format (24-hour)");
  }

  // Validate activity type
  const validActivityTypes = ['class', 'quiz', 'invigilation', 'admin', 'other'];
  if (!validActivityTypes.includes(row.activity_type.toLowerCase())) {
    errors.push(`activity_type must be one of: ${validActivityTypes.join(', ')}`);
  }

  // Validate department exists
  const deptCodeUpper = row.department_code.toUpperCase();
  const deptId = deptsMap.get(deptCodeUpper);
  if (!deptId) {
    errors.push(`Department code '${row.department_code}' not found`);
  }

  // Validate user belongs to this department
  if (deptId && userDeptCodes && !userDeptCodes.has(deptCodeUpper)) {
    errors.push(`You are not a member of department '${row.department_code}'`);
  }

  // Validate time logic
  if (errors.length === 0) {
    const [startHour, startMin] = row.start_time.split(':').map(Number);
    const [endHour, endMin] = row.end_time.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (endMinutes <= startMinutes) {
      errors.push("end_time must be after start_time");
    }

    const durationMinutes = endMinutes - startMinutes;

    if (errors.length === 0) {
      return {
        isValid: true,
        errors: [],
        data: {
          user_id: userId,
          entry_date: normalizedDate,
          start_time: row.start_time,
          end_time: row.end_time,
          activity_type: row.activity_type.toLowerCase(),
          activity_subtype: row.activity_subtype || null,
          notes: row.notes || null,
          department_code: deptCodeUpper,
          status: 'submitted',
          source: 'bulk_upload',
        },
      };
    }
  }

  return { isValid: false, errors };
}

/**
 * Validate row for admin mode (with email)
 */
export async function validateAdminExcelRow(
  row: AdminExcelRow,
  usersMap: Map<string, string>,
  deptsMap: Map<string, string>
): Promise<ValidationResult> {
  const errors: string[] = [];

  // Required fields (including email for admin)
  if (!row.member_email) errors.push("member_email is required");
  if (!row.entry_date) errors.push("entry_date is required");
  if (!row.start_time) errors.push("start_time is required");
  if (!row.end_time) errors.push("end_time is required");
  if (!row.activity_type) errors.push("activity_type is required");
  if (!row.department_code) errors.push("department_code is required");

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // Validate user exists
  const userId = usersMap.get(row.member_email.toLowerCase());
  if (!userId) {
    errors.push(`Member email '${row.member_email}' not found`);
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(row.entry_date)) {
    errors.push("entry_date must be in YYYY-MM-DD format");
  }

  // Validate time format
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(row.start_time)) {
    errors.push("start_time must be in HH:MM format (24-hour)");
  }
  if (!timeRegex.test(row.end_time)) {
    errors.push("end_time must be in HH:MM format (24-hour)");
  }

  // Validate activity type
  const validActivityTypes = ['class', 'quiz', 'invigilation', 'admin', 'other'];
  if (!validActivityTypes.includes(row.activity_type.toLowerCase())) {
    errors.push(`activity_type must be one of: ${validActivityTypes.join(', ')}`);
  }

  // Validate department exists
  const deptId = deptsMap.get(row.department_code.toUpperCase());
  if (!deptId) {
    errors.push(`Department code '${row.department_code}' not found`);
  }

  // Validate time logic
  if (errors.length === 0 && userId && deptId) {
    const [startHour, startMin] = row.start_time.split(':').map(Number);
    const [endHour, endMin] = row.end_time.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (endMinutes <= startMinutes) {
      errors.push("end_time must be after start_time");
    }

    const durationMinutes = endMinutes - startMinutes;

    if (errors.length === 0) {
      return {
        isValid: true,
        errors: [],
        data: {
          user_id: userId,
          entry_date: row.entry_date,
          start_time: row.start_time,
          end_time: row.end_time,
          activity_type: row.activity_type.toLowerCase(),
          activity_subtype: row.activity_subtype || null,
          notes: row.notes || null,
          department_code: row.department_code.toUpperCase(),
          status: 'submitted',
          source: 'bulk_upload',
        },
      };
    }
  }

  return { isValid: false, errors };
}

/**
 * Bulk insert timesheet entries
 */
export async function bulkInsertTimesheets(
  entries: any[]
): Promise<{ success: number; failed: number; errors: any[] }> {
  const batchSize = 100;
  let success = 0;
  let failed = 0;
  const errors: any[] = [];

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    
    const { data, error } = await supabase
      .from('timesheet_entries')
      .insert(batch)
      .select();

    if (error) {
      failed += batch.length;
      errors.push({ batch: i / batchSize + 1, error: getUserErrorMessage(error, "import timesheet") });
    } else {
      success += data?.length || 0;
    }
  }

  return { success, failed, errors };
}

/**
 * Fetch users and departments for validation
 */
export async function fetchUsersAndDepartments(): Promise<{
  usersMap: Map<string, string>;
  deptsMap: Map<string, string>;
}> {
  const [usersResponse, deptsResponse] = await Promise.all([
    supabase.from('profiles').select('id, full_name').eq('is_active', true),
    supabase.from('departments').select('id, code, name'),
  ]);

  const usersMap = new Map<string, string>();
  const deptsMap = new Map<string, string>();

  // Map users by email - using Supabase RPC or edge function
  // Note: In production, you may want to create an RPC function to fetch user emails
  // For now, we'll use a workaround by calling the admin API
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-list-users`, {
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
    });
    
    if (response.ok) {
      const { users } = await response.json();
      users?.forEach((user: any) => {
        if (user.email) {
          usersMap.set(user.email.toLowerCase(), user.id);
        }
      });
    }
  } catch (error) {
    console.error('Failed to fetch users:', error);
  }

  deptsResponse.data?.forEach((dept) => {
    deptsMap.set(dept.code.toUpperCase(), dept.id);
  });

  return { usersMap, deptsMap };
}

/**
 * Fetch departments only (for faculty mode)
 */
export async function fetchDepartments(): Promise<Map<string, string>> {
  const { data } = await supabase.from('departments').select('id, code');
  
  const deptsMap = new Map<string, string>();
  data?.forEach((dept) => {
    deptsMap.set(dept.code.toUpperCase(), dept.id);
  });

  return deptsMap;
}

/**
 * Generate Excel template for member (no email column)
 */
export function generateMemberExcelTemplate(): Blob {
  const templateData = [
    {
      entry_date: '15/01/2025',
      start_time: '09:00',
      end_time: '11:00',
      activity_type: 'class',
      activity_subtype: 'CS101 Lecture',
      notes: 'Introduction to Programming',
      department_code: 'CS',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Timesheet');

  // Set column widths
  worksheet['!cols'] = [
    { wch: 12 }, // entry_date
    { wch: 10 }, // start_time
    { wch: 10 }, // end_time
    { wch: 15 }, // activity_type
    { wch: 20 }, // activity_subtype
    { wch: 30 }, // notes
    { wch: 15 }, // department_code
  ];

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
}

/**
 * Generate Excel template for admin (with email column)
 */
export function generateAdminExcelTemplate(): Blob {
  const templateData = [
    {
      faculty_email: 'faculty@example.com',
      entry_date: '15/01/2025',
      start_time: '09:00',
      end_time: '11:00',
      activity_type: 'class',
      activity_subtype: 'CS101 Lecture',
      notes: 'Introduction to Programming',
      department_code: 'CS',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Timesheet');

  // Set column widths
  worksheet['!cols'] = [
    { wch: 25 }, // faculty_email
    { wch: 12 }, // entry_date
    { wch: 10 }, // start_time
    { wch: 10 }, // end_time
    { wch: 15 }, // activity_type
    { wch: 20 }, // activity_subtype
    { wch: 30 }, // notes
    { wch: 15 }, // department_code
  ];

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
}

/**
 * Detect file type by extension
 */
export function getFileType(filename: string): 'csv' | 'excel' | 'unknown' {
  if (filename.endsWith('.csv')) return 'csv';
  if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) return 'excel';
  return 'unknown';
}