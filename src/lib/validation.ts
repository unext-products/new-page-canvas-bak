import { z } from "zod";

// User validation schemas
export const userCreateSchema = z.object({
  full_name: z.string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters"),
  email: z.string()
    .trim()
    .email("Invalid email address")
    .max(255, "Email must be less than 255 characters"),
  phone: z.string()
    .trim()
    .max(20, "Phone must be less than 20 characters")
    .regex(/^[0-9+\-() ]*$/, "Invalid phone number format")
    .optional()
    .or(z.literal("")),
  role: z.enum(["admin", "hod", "faculty"], {
    required_error: "Role is required",
  }),
  department_id: z.string().uuid().optional().or(z.literal("")),
  is_active: z.boolean().default(true),
});

export const userUpdateSchema = z.object({
  full_name: z.string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters"),
  phone: z.string()
    .trim()
    .max(20, "Phone must be less than 20 characters")
    .regex(/^[0-9+\-() ]*$/, "Invalid phone number format")
    .optional()
    .or(z.literal("")),
  role: z.enum(["admin", "hod", "faculty"]).optional(),
  department_id: z.string().uuid().optional().or(z.literal("")),
  is_active: z.boolean().optional(),
});

// Department validation schemas
export const departmentSchema = z.object({
  name: z.string()
    .trim()
    .min(1, "Department name is required")
    .max(100, "Name must be less than 100 characters"),
  code: z.string()
    .trim()
    .min(1, "Department code is required")
    .max(10, "Code must be less than 10 characters")
    .regex(/^[A-Z0-9_-]+$/, "Code must contain only uppercase letters, numbers, hyphens, and underscores"),
});

// Timesheet validation schemas
export const timesheetEntrySchema = z.object({
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
  activity_type: z.enum(["class", "quiz", "invigilation", "admin", "other"]),
  activity_subtype: z.string()
    .trim()
    .max(100, "Activity subtype must be less than 100 characters")
    .optional()
    .or(z.literal("")),
  notes: z.string()
    .trim()
    .max(1000, "Notes must be less than 1000 characters")
    .optional()
    .or(z.literal("")),
}).refine(
  (data) => {
    const [startHour, startMin] = data.start_time.split(":").map(Number);
    const [endHour, endMin] = data.end_time.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return endMinutes > startMinutes;
  },
  {
    message: "End time must be after start time",
    path: ["end_time"],
  }
);

// Approval validation schemas
export const approvalNotesSchema = z.object({
  approver_notes: z.string()
    .trim()
    .max(500, "Approver notes must be less than 500 characters")
    .optional()
    .or(z.literal("")),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type DepartmentInput = z.infer<typeof departmentSchema>;
export type TimesheetEntryInput = z.infer<typeof timesheetEntrySchema>;
export type ApprovalNotesInput = z.infer<typeof approvalNotesSchema>;
