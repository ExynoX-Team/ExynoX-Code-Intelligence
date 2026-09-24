/**
 * General utility functions for ExynoX Code Intelligence
 */

/**
 * Formats a line range into a readable string (e.g., "42–67" or "15")
 */
export function formatLineRange(startLine: number, endLine: number): string {
  if (startLine === endLine) {
    return `${startLine}`;
  }
  return `${startLine}–${endLine}`;
}

/**
 * Extracts a file extension from a path
 */
export function getFileExtension(filePath: string): string {
  const parts = filePath.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Sanitizes a technical error for user display while retaining debugging details
 */
export function sanitizeErrorMessage(error: unknown): { message: string; technical?: string } {
  if (error instanceof Error) {
    return {
      message: 'Something went wrong while processing the repository.',
      technical: `${error.name}: ${error.message}\n${error.stack || ''}`
    };
  }
  return {
    message: 'An unexpected issue occurred.',
    technical: String(error)
  };
}
