/**
 * Maps technical error messages to user-friendly messages
 * while preserving technical details for logging
 */

interface ErrorInfo {
  userMessage: string;
  technicalMessage: string;
  shouldLog: boolean;
}

export function handleError(error: any, context: string = "operation"): ErrorInfo {
  const technicalMessage = error?.message || String(error);
  
  // Log technical details server-side (in development)
  if (import.meta.env.DEV) {
    console.error(`Error in ${context}:`, error);
  }

  // Map common error patterns to user-friendly messages
  let userMessage: string;

  // Database constraint violations
  if (technicalMessage.includes("duplicate key") || technicalMessage.includes("unique constraint")) {
    userMessage = "This record already exists. Please use a different value.";
  }
  // Foreign key violations
  else if (technicalMessage.includes("foreign key constraint") || technicalMessage.includes("violates foreign key")) {
    userMessage = "Cannot complete this action. Related records may be in use.";
  }
  // Permission/RLS errors
  else if (technicalMessage.includes("permission denied") || technicalMessage.includes("policy")) {
    userMessage = "You don't have permission to perform this action.";
  }
  // Network/connection errors
  else if (technicalMessage.includes("fetch") || technicalMessage.includes("network")) {
    userMessage = "Connection error. Please check your internet and try again.";
  }
  // Validation errors (these are already user-friendly from zod)
  else if (technicalMessage.includes("validation") || technicalMessage.includes("Invalid")) {
    userMessage = technicalMessage; // Keep validation messages as-is
  }
  // Auth errors
  else if (technicalMessage.includes("auth") || technicalMessage.includes("unauthorized")) {
    userMessage = "Authentication error. Please sign in again.";
  }
  // User creation errors
  else if (context.includes("create user") || context.includes("user creation")) {
    userMessage = "Failed to create user. Please check the email address and try again.";
  }
  // User update errors
  else if (context.includes("update user") || context.includes("user update")) {
    userMessage = "Failed to update user information. Please try again.";
  }
  // Department errors
  else if (context.includes("department")) {
    userMessage = "Failed to process department. Please try again.";
  }
  // Timesheet errors
  else if (context.includes("timesheet") || context.includes("entry")) {
    userMessage = "Failed to process timesheet entry. Please try again.";
  }
  // Approval errors
  else if (context.includes("approval")) {
    userMessage = "Failed to process approval. Please try again.";
  }
  // Generic fallback
  else {
    userMessage = `Failed to complete ${context}. Please try again.`;
  }

  return {
    userMessage,
    technicalMessage,
    shouldLog: true,
  };
}

/**
 * Gets a user-friendly error message for display in toast notifications
 */
export function getUserErrorMessage(error: any, context: string = "operation"): string {
  return handleError(error, context).userMessage;
}

/**
 * Logs error details in development mode
 */
export function logError(error: any, context: string = "operation"): void {
  if (import.meta.env.DEV) {
    const errorInfo = handleError(error, context);
    console.error(`[${context}]`, {
      userMessage: errorInfo.userMessage,
      technicalMessage: errorInfo.technicalMessage,
      error,
    });
  }
}
