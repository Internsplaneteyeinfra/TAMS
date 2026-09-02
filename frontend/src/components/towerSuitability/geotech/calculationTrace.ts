/**
 * N — Shared calculation trace types for UI, report, and tests.
 */

export interface CalculationStep {
  step: number
  name: string
  formula: string
  inputs: Record<string, number | string | null>
  substitution?: string
  intermediate?: string | number | null
  result: number | string | null
  unit: string
  notes?: string
}

export function formatCalculationTrace(steps: CalculationStep[]): string[] {
  return steps.map((s) => {
    const parts = [`Step ${s.step}: ${s.name}`, `Formula: ${s.formula}`]
    if (Object.keys(s.inputs).length) {
      parts.push(`Inputs: ${JSON.stringify(s.inputs)}`)
    }
    if (s.substitution) parts.push(`Substitution: ${s.substitution}`)
    if (s.intermediate != null) parts.push(`Intermediate: ${s.intermediate}`)
    parts.push(`Result: ${s.result ?? '—'} ${s.unit}`)
    if (s.notes) parts.push(`Note: ${s.notes}`)
    return parts.join('\n')
  })
}
