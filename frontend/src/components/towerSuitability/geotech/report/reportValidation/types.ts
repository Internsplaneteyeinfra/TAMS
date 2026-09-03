/**
 * Report validation result types.
 */

export type ReportValidationSeverity = 'critical' | 'warning' | 'info'

export interface ReportValidationIssue {
  code: string
  severity: ReportValidationSeverity
  message: string
  section?: string
}

export interface ReportValidationResult {
  passed: boolean
  criticalCount: number
  warningCount: number
  issues: ReportValidationIssue[]
  summary: Record<string, 'PASS' | 'FAIL' | 'WARN'>
}

export class ReportValidationError extends Error {
  readonly result: ReportValidationResult

  constructor(result: ReportValidationResult) {
    const msgs = result.issues
      .filter((i) => i.severity === 'critical')
      .map((i) => i.message)
      .slice(0, 5)
    super(`Report validation failed: ${msgs.join('; ')}`)
    this.name = 'ReportValidationError'
    this.result = result
  }
}
