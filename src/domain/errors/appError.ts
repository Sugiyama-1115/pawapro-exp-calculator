export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export interface ValidationIssue {
  code: string;
  file: string;
  line: number | null;
  column: string | null;
  message: string;
}
