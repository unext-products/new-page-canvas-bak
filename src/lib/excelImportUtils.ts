import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { getUserErrorMessage } from "./errorHandler";
import { 
  validateAgainstThresholds, 
  validateDateAgainstHolidaysAndWorkingDays,
  isHolidayDate,
  isWorkingDayDate,
  type Thresholds,
  type ExtendedValidationContext,
  type Holiday,
  type WorkingDaysConfig
} from "./thresholdValidation";

// Common row structure - updated for new Excel format with batch, program, subject columns
interface ExcelRowBase {
  entry_date: string;
  start_time: string;
  end_time: string;
  activity_type: string;
  batch?: string;           // Column E - optional
  program: string;          // Column F - required (program code)
  subject?: string;         // Column G - optional (subject code)
  notes?: string;           // Column H
  department_code: string;  // Column I - vertical code (required)
  activity_subtype?: string; // backward compatibility
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

// Re-export types for consumers
export type { Thresholds, ExtendedValidationContext };

/**
 * Check if two time ranges overlap
 */
export function timesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  return toMin(startA) < toMin(endB) && toMin(endA) > toMin(startB);
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
 * Normalizes all header keys to lowercase to handle case variations (e.g., "Program" -> "program")
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
        
        // Normalize all keys to lowercase and convert Excel time decimals and dates
        const processedData = jsonData.map((row: any) => {
          // First, normalize all keys to lowercase
          const normalizedRow: any = {};
          for (const [key, value] of Object.entries(row)) {
            normalizedRow[key.toLowerCase()] = value;
          }
          
          // Handle "subjects" -> "subject" mapping (template may use plural)
          if (normalizedRow.subjects !== undefined && normalizedRow.subject === undefined) {
            normalizedRow.subject = normalizedRow.subjects;
          }
          
          return {
            ...normalizedRow,
            start_time: normalizedRow.start_time !== undefined ? excelTimeToHHMM(normalizedRow.start_time) : undefined,
            end_time: normalizedRow.end_time !== undefined ? excelTimeToHHMM(normalizedRow.end_time) : undefined,
            entry_date: normalizedRow.entry_date !== undefined ? excelDateToString(normalizedRow.entry_date) : undefined,
          };
        });
        
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
 * Helper to get today's date as YYYY-MM-DD string (local time)
 */
function getTodayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Validate row for member mode (no email needed) with user department check
 */
export async function validateMemberExcelRow(
  row: MemberExcelRow,
  userId: string,
  departmentId: string,
  deptsMap: Map<string, string>,
  userDeptCodes?: Set<string>,
  validationContext?: ExtendedValidationContext | null,
  userProgramsMap?: Map<string, { id: string; vertical_id: string; vertical_code?: string; name?: string }[]> | null,
  programsInVertical?: Map<string, { id: string; code: string }> | null,
  existingEntries?: { entry_date: string; start_time: string; end_time: string }[] | null
): Promise<ValidationResult> {
  const errors: string[] = [];

  // Trim all user-input fields to prevent whitespace mismatches
  if (row.activity_type) row.activity_type = row.activity_type.trim();
  if (row.department_code) row.department_code = row.department_code.trim();
  if (row.program) row.program = row.program.trim();
  if (row.batch) row.batch = row.batch.trim();
  if (row.subject) row.subject = row.subject.trim();

  // Required fields
  if (!row.entry_date) errors.push("entry_date is required");
  if (!row.start_time) errors.push("start_time is required");
  if (!row.end_time) errors.push("end_time is required");
  if (!row.activity_type) errors.push("activity_type is required");
  if (!row.department_code) errors.push("department_code (vertical) is required");
  if (!row.program) errors.push("program is required");

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

  // Validate activity type - use dynamic validation if available
  if (validationContext && validationContext.activityTypes.length > 0) {
    const activityLower = row.activity_type.toLowerCase();
    if (!validationContext.activityTypes.includes(activityLower)) {
      errors.push(`Invalid activity type '${row.activity_type}'. Valid types: ${validationContext.activityTypes.join(', ')}`);
    }
  } else {
    // Fallback to hardcoded list for backward compatibility
    const validActivityTypes = ['class', 'quiz', 'invigilation', 'admin', 'other'];
    if (!validActivityTypes.includes(row.activity_type.toLowerCase())) {
      errors.push(`activity_type must be one of: ${validActivityTypes.join(', ')}`);
    }
  }

  // Validate department (vertical) exists
  const deptCodeUpper = row.department_code.toUpperCase();
  const deptId = deptsMap.get(deptCodeUpper);
  if (!deptId) {
    errors.push(`Vertical code '${row.department_code}' not found`);
  }

  // Validate user belongs to this department/vertical
  if (deptId && userDeptCodes && !userDeptCodes.has(deptCodeUpper)) {
    errors.push(`You are not a member of vertical '${row.department_code}'`);
  }

  // Validate program (required) - check by code first, then by name
  let programId: string | null = null;
  const programValueUpper = row.program.toUpperCase();
  
  if (userProgramsMap) {
    // Get all matching programs by code or name
    let programEntries = userProgramsMap.get(programValueUpper);
    
    // If not found by code, try to find by name across all entries
    if (!programEntries) {
      for (const [, entries] of userProgramsMap.entries()) {
        const nameMatch = entries.find(e => e.name?.toUpperCase() === programValueUpper);
        if (nameMatch) {
          programEntries = entries.filter(e => e.name?.toUpperCase() === programValueUpper);
          break;
        }
      }
    }
    
    if (!programEntries || programEntries.length === 0) {
      errors.push(`You are not assigned to program '${row.program}'`);
    } else {
      // Find the program entry that matches the specified vertical
      const matchingProgram = programEntries.find(e => 
        !e.vertical_code || e.vertical_code === deptCodeUpper
      );
      
      if (matchingProgram) {
        programId = matchingProgram.id;
      } else {
        errors.push(`Program '${row.program}' does not belong to vertical '${row.department_code}'`);
      }
    }
  } else if (programsInVertical) {
    // Fallback: check if program exists in the selected vertical
    const progInfo = programsInVertical.get(programValueUpper);
    if (!progInfo) {
      errors.push(`Program '${row.program}' not found in vertical '${row.department_code}'`);
    } else {
      programId = progInfo.id;
    }
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
  }

  // Validate future date - cannot create entries for future dates
  if (errors.length === 0) {
    const todayStr = getTodayDateString();
    if (normalizedDate > todayStr) {
      errors.push(`Cannot create entries for future dates (${normalizedDate})`);
    }
  }

  // Validate against leave days (half-day leaves allow entries in the free half)
  if (errors.length === 0 && validationContext?.userLeaveDays) {
    const leaveType = validationContext.userLeaveDays.get(normalizedDate);
    if (leaveType) {
      const { isHalfDayLeave, isTimeBlockedByHalfDayLeave } = await import("@/lib/leaveUtils");
      if (isHalfDayLeave(leaveType)) {
        if (isTimeBlockedByHalfDayLeave(row.start_time, row.end_time, leaveType)) {
          errors.push(`Time ${row.start_time}-${row.end_time} falls in the blocked half of a half-day leave on ${normalizedDate}`);
        }
      } else {
        errors.push(`Cannot create entries on leave days (${normalizedDate})`);
      }
    }
  }

  // Validate against holidays and working days
  if (errors.length === 0 && validationContext) {
    const dateValidation = validateDateAgainstHolidaysAndWorkingDays(
      normalizedDate,
      validationContext.holidays,
      validationContext.workingDays
    );
    if (!dateValidation.valid && dateValidation.error) {
      errors.push(dateValidation.error);
    }
  }

  // Validate against thresholds (work hour window, etc.)
  if (errors.length === 0 && validationContext?.thresholds) {
    const thresholdResult = validateAgainstThresholds(row.start_time, row.end_time, validationContext.thresholds);
    if (!thresholdResult.valid && thresholdResult.error) {
      errors.push(thresholdResult.error);
    }
  }

  // Validate against existing DB entries for overlap
  if (errors.length === 0 && existingEntries) {
    const sameDate = existingEntries.filter(e => e.entry_date === normalizedDate);
    for (const existing of sameDate) {
      if (timesOverlap(row.start_time, row.end_time, existing.start_time, existing.end_time)) {
        errors.push(`Time ${row.start_time}-${row.end_time} overlaps with existing entry ${existing.start_time.substring(0,5)}-${existing.end_time.substring(0,5)}`);
        break;
      }
    }
  }

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
        vertical_code: deptCodeUpper,
        vertical_id: deptId || null,
        program_id: programId,
        batch_name: row.batch || null,
        subject_code: row.subject || null,
        status: 'submitted',
        source: 'bulk_upload',
      },
    };
  }

  return { isValid: false, errors };
}

/**
 * Validate row for admin mode (with email)
 */
export async function validateAdminExcelRow(
  row: AdminExcelRow,
  usersMap: Map<string, string>,
  deptsMap: Map<string, string>,
  validationContext?: ExtendedValidationContext | null
): Promise<ValidationResult> {
  const errors: string[] = [];

  // Trim all user-input fields to prevent whitespace mismatches
  if (row.member_email) row.member_email = row.member_email.trim();
  if (row.activity_type) row.activity_type = row.activity_type.trim();
  if (row.department_code) row.department_code = row.department_code.trim();
  if (row.program) row.program = row.program.trim();
  if (row.batch) row.batch = row.batch.trim();
  if (row.subject) row.subject = row.subject.trim();

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

  // Validate date format (DD/MM/YYYY or YYYY-MM-DD)
  const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const isoFormat = /^\d{4}-\d{2}-\d{2}$/;
  let normalizedDate = row.entry_date;
  
  const ddMatch = row.entry_date.match(ddmmyyyy);
  if (ddMatch) {
    // Convert DD/MM/YYYY to YYYY-MM-DD
    normalizedDate = `${ddMatch[3]}-${ddMatch[2].padStart(2, '0')}-${ddMatch[1].padStart(2, '0')}`;
  } else if (!isoFormat.test(row.entry_date)) {
    errors.push("entry_date must be in DD/MM/YYYY or YYYY-MM-DD format");
  }

  // Validate time format
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(row.start_time)) {
    errors.push("start_time must be in HH:MM format (24-hour)");
  }
  if (!timeRegex.test(row.end_time)) {
    errors.push("end_time must be in HH:MM format (24-hour)");
  }

  // Validate activity type - use dynamic validation if available
  if (validationContext && validationContext.activityTypes.length > 0) {
    const activityLower = row.activity_type.toLowerCase();
    if (!validationContext.activityTypes.includes(activityLower)) {
      errors.push(`Invalid activity type '${row.activity_type}'. Valid types: ${validationContext.activityTypes.join(', ')}`);
    }
  } else {
    // Fallback to hardcoded list for backward compatibility
    const validActivityTypes = ['class', 'quiz', 'invigilation', 'admin', 'other'];
    if (!validActivityTypes.includes(row.activity_type.toLowerCase())) {
      errors.push(`activity_type must be one of: ${validActivityTypes.join(', ')}`);
    }
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
  }

  // Validate future date - cannot create entries for future dates
  if (errors.length === 0) {
    const todayStr = getTodayDateString();
    if (normalizedDate > todayStr) {
      errors.push(`Cannot create entries for future dates (${normalizedDate})`);
    }
  }

  // Validate against leave days (for admin mode)
  if (errors.length === 0 && validationContext?.userLeaveDays) {
    const leaveType = validationContext.userLeaveDays.get(normalizedDate);
    if (leaveType) {
      const { isHalfDayLeave, isTimeBlockedByHalfDayLeave } = await import("@/lib/leaveUtils");
      if (isHalfDayLeave(leaveType)) {
        if (isTimeBlockedByHalfDayLeave(row.start_time, row.end_time, leaveType)) {
          errors.push(`Time ${row.start_time}-${row.end_time} falls in the blocked half of a half-day leave on ${normalizedDate}`);
        }
      } else {
        errors.push(`Cannot create entries on leave days (${normalizedDate})`);
      }
    }
  }

  // Validate against holidays and working days
  if (errors.length === 0 && validationContext) {
    const dateValidation = validateDateAgainstHolidaysAndWorkingDays(
      normalizedDate,
      validationContext.holidays,
      validationContext.workingDays
    );
    if (!dateValidation.valid && dateValidation.error) {
      errors.push(dateValidation.error);
    }
  }

  // Validate against thresholds (work hour window, etc.)
  if (errors.length === 0 && validationContext?.thresholds) {
    const thresholdResult = validateAgainstThresholds(row.start_time, row.end_time, validationContext.thresholds);
    if (!thresholdResult.valid && thresholdResult.error) {
      errors.push(thresholdResult.error);
    }
  }

  if (errors.length === 0 && userId && deptId) {
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
        department_code: row.department_code.toUpperCase(),
        vertical_code: row.department_code.toUpperCase(),
        vertical_id: deptId || null,
        program_id: null,
        batch_name: row.batch || null,
        subject_code: row.subject || null,
        status: 'submitted',
        source: 'bulk_upload',
      },
    };
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
  const [usersResponse, deptsResponse, verticalsResponse] = await Promise.all([
    supabase.from('profiles').select('id, full_name').eq('is_active', true),
    supabase.from('departments').select('id, code, name'),
    supabase.from('verticals').select('id, code, name'),
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
  
  // Also add verticals to the map (these take precedence if there's overlap)
  verticalsResponse.data?.forEach((vert) => {
    deptsMap.set(vert.code.toUpperCase(), vert.id);
  });

  return { usersMap, deptsMap };
}

/**
 * Fetch departments and verticals (for faculty mode)
 * Checks both departments and verticals tables since codes may exist in either
 */
export async function fetchDepartments(organizationId?: string): Promise<Map<string, string>> {
  // Fetch from both departments and verticals tables, scoped to organization
  let deptsQuery = supabase.from('departments').select('id, code');
  let vertsQuery = supabase.from('verticals').select('id, code');

  if (organizationId) {
    deptsQuery = deptsQuery.eq('organization_id', organizationId);
    vertsQuery = vertsQuery.eq('organization_id', organizationId);
  }

  const [deptsRes, verticalsRes] = await Promise.all([deptsQuery, vertsQuery]);
  
  const deptsMap = new Map<string, string>();
  
  // Add departments
  deptsRes.data?.forEach((dept) => {
    deptsMap.set(dept.code.toUpperCase(), dept.id);
  });
  
  // Add verticals (these take precedence if there's overlap)
  verticalsRes.data?.forEach((vert) => {
    deptsMap.set(vert.code.toUpperCase(), vert.id);
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