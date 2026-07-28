/**
 * Download Tower Site Suitability analysis as a self-contained HTML pamphlet.
 * Opens cleanly in any browser; Print → Save as PDF for archival.
 */

import type { SuitabilityResult, SuitabilitySuggestions, SuitabilityVerdict } from './scoring'

const FACTOR_EMOJI: Record<string, string> = {
  slope: '⛰️',
  elevation: '📶',
  road: '🛣️',
  water: '💧',
  clearance: '🏘️',
  corridor: '⚡',
  wind: '💨',
  landcover: '🌿',
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function decisionMeta(v: SuitabilityVerdict): {
  label: string
  emoji: string
  color: string
  bg: string
  border: string
} {
  if (v === 'preferred') {
    return {
      label: 'Accepted',
      emoji: '✅',
      color: '#047857',
      bg: '#d1fae5',
      border: '#6ee7b7',
    }
  }
  if (v === 'unsuitable') {
    return {
      label: 'Rejected',
      emoji: '❌',
      color: '#b91c1c',
      bg: '#fee2e2',
      border: '#fca5a5',
    }
  }
  return {
    label: 'Review',
    emoji: '⚠️',
    color: '#b45309',
    bg: '#fef3c7',
    border: '#fcd34d',
  }
}

function scoreClass(score: number): string {
  if (score >= 7) return 'good'
  if (score >= 4.5) return 'mid'
  return 'bad'
}

function remainingWhySection(suggestions: SuitabilitySuggestions, decisionLabel: string): string {
  const { remainingToPerfect, remainingPct, currentScore, items, pointsToAccepted } = suggestions

  if (remainingToPerfect < 0.15) {
    return `
      <p class="lead">🎉 Your screening score is essentially at the ceiling (<strong>10 / 10</strong>). The remaining gap is negligible.</p>
      <p>Next steps are <strong>field investigations</strong> (boreholes, SBC, earth resistivity) — open satellite data cannot close that last engineering certainty.</p>
    `
  }

  const topGaps = items.slice(0, 5)
  const gapList =
    topGaps.length === 0
      ? '<li>No material factor gaps remain on this screening model.</li>'
      : topGaps
          .map(
            (it) => `
        <li>
          <strong>${esc(FACTOR_EMOJI[it.factorId] || '📌')} ${esc(it.factorLabel)}</strong>
          — missing <strong>−${it.gapPoints.toFixed(2)}</strong> weighted points
          (score ${it.currentScore.toFixed(1)}/10).
          <br/><span class="muted">${esc(it.whyNotIdeal)}</span>
        </li>`
          )
          .join('')

  const statusLine =
    currentScore >= 7
      ? `Verdict is <strong>${esc(decisionLabel)}</strong>, but you are still <strong>${remainingToPerfect.toFixed(1)} points (${remainingPct}%)</strong> short of a perfect 10/10.`
      : `Verdict is <strong>${esc(decisionLabel)}</strong>. You need <strong>+${pointsToAccepted.toFixed(1)}</strong> points to reach Accepted (≥7), and <strong>${remainingToPerfect.toFixed(1)} points (${remainingPct}%)</strong> remain until a perfect 10/10.`

  return `
    <p class="lead">📉 ${statusLine}</p>
    <p>That remaining <strong>${remainingPct}%</strong> is not “noise” — it is the weighted shortfall from factors that scored below 10. Closing them improves constructability, access, and risk before you commit to foundation design.</p>
    <h3>🔎 Why the remaining ${remainingPct}% is not yet ideal</h3>
    <ol class="gap-list">${gapList}</ol>
    <p class="note">💡 Tip: Fix the largest weighted gaps first — they move the final score the most.</p>
  `
}

export interface ReportDownloadInput {
  siteLabel: string
  lat: number
  lon: number
  result: SuitabilityResult
  suggestions: SuitabilitySuggestions
  kmlOutlineCount?: number
  generatedAt?: Date
}

export function buildSuitabilityReportHtml(input: ReportDownloadInput): string {
  const { siteLabel, lat, lon, result, suggestions, kmlOutlineCount = 0 } = input
  const when = (input.generatedAt ?? new Date()).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  const decision = decisionMeta(result.verdict)
  const weightedSum = result.factors.reduce((s, f) => s + f.score * f.weight, 0)

  const factorRows = result.factors
    .map((f) => {
      const contrib = f.score * f.weight
      const emoji = FACTOR_EMOJI[f.id] || '📌'
      return `
        <tr>
          <td>
            <div class="factor-name">${emoji} ${esc(f.label)}</div>
            <div class="factor-src">${esc(f.source)}</div>
          </td>
          <td class="mono right">${esc(f.rawLabel)}</td>
          <td class="right score-${scoreClass(f.score)}"><strong>${f.score.toFixed(1)}</strong></td>
          <td class="right muted">${(f.weight * 100).toFixed(0)}%</td>
          <td class="right mono cyan">${contrib.toFixed(2)}</td>
        </tr>`
    })
    .join('')

  const factorNotes = result.factors
    .map((f) => {
      const emoji = FACTOR_EMOJI[f.id] || '📌'
      return `
        <div class="note-card">
          <div class="note-head">
            <span>${emoji} <strong>${esc(f.label)}</strong></span>
            <span class="mono cyan">${esc(f.rawLabel)}</span>
          </div>
          <p>${esc(f.note)}</p>
        </div>`
    })
    .join('')

  const improveCards =
    suggestions.items.length === 0
      ? `<p class="muted">✨ No material gaps left on screening factors.</p>`
      : suggestions.items
          .map(
            (item, idx) => `
        <div class="improve-card">
          <div class="improve-head">
            <span><strong>${idx + 1}. ${esc(FACTOR_EMOJI[item.factorId] || '📌')} ${esc(item.factorLabel)}</strong></span>
            <span class="badge-amber">−${item.gapPoints.toFixed(2)} pts</span>
          </div>
          <p class="tiny muted">Score ${item.currentScore.toFixed(1)} / ${item.maxScore}</p>
          <p><span class="tag-bad">🚫 Why not ideal:</span> ${esc(item.whyNotIdeal)}</p>
          <p><span class="tag-good">🛠️ Improve:</span> ${esc(item.howToImprove)}</p>
        </div>`
          )
          .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Tower Site Suitability Report — ${esc(siteLabel)}</title>
  <style>
    :root {
      --ink: #0f172a;
      --muted: #64748b;
      --line: #e2e8f0;
      --cyan: #0891b2;
      --paper: #ffffff;
      --soft: #f8fafc;
      --good: #059669;
      --mid: #d97706;
      --bad: #dc2626;
      --amber: #b45309;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      color: var(--ink);
      background: linear-gradient(165deg, #ecfeff 0%, #f8fafc 35%, #fff7ed 100%);
      line-height: 1.55;
    }
    .page {
      max-width: 880px;
      margin: 28px auto;
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 20px;
      box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
      overflow: hidden;
    }
    .hero {
      padding: 28px 32px 24px;
      background: linear-gradient(135deg, #0e172a 0%, #164e63 55%, #0f766e 100%);
      color: #f8fafc;
    }
    .brand {
      font-size: 12px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #a5f3fc;
      font-weight: 700;
      margin: 0 0 8px;
    }
    h1 {
      margin: 0;
      font-size: 28px;
      letter-spacing: -0.02em;
      font-weight: 800;
    }
    .subtitle { margin: 8px 0 0; color: #cbd5e1; font-size: 14px; }
    .meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 18px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 999px;
      background: rgba(255,255,255,0.12);
      border: 1px solid rgba(255,255,255,0.18);
      font-size: 12px;
      font-weight: 600;
    }
    .body { padding: 28px 32px 36px; }
    .verdict-bar {
      display: grid;
      grid-template-columns: 1.2fr repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 22px;
    }
    @media (max-width: 720px) {
      .verdict-bar { grid-template-columns: 1fr 1fr; }
    }
    .card {
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 14px 16px;
      background: var(--soft);
    }
    .card .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); font-weight: 700; margin: 0 0 6px; }
    .card .value { font-size: 22px; font-weight: 800; margin: 0; }
    .card .hint { font-size: 12px; color: var(--muted); margin: 4px 0 0; }
    .verdict {
      border: 2px solid ${decision.border};
      background: ${decision.bg};
      color: ${decision.color};
    }
    .verdict .value { color: var(--ink); font-size: 28px; }
    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 18px;
      font-weight: 800;
      margin: 28px 0 12px;
      letter-spacing: -0.01em;
    }
    .disclaimer {
      border: 1px solid #fcd34d;
      background: #fffbeb;
      color: #92400e;
      border-radius: 12px;
      padding: 12px 14px;
      font-size: 13px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      border: 1px solid var(--line);
      border-radius: 12px;
      overflow: hidden;
    }
    thead { background: #0f172a; color: #e2e8f0; }
    th { text-align: left; padding: 11px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
    th.right, td.right { text-align: right; }
    td { padding: 11px 12px; border-top: 1px solid var(--line); vertical-align: top; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    .factor-name { font-weight: 700; }
    .factor-src { font-size: 11px; color: var(--muted); margin-top: 2px; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .muted { color: var(--muted); }
    .cyan { color: var(--cyan); font-weight: 700; }
    .score-good { color: var(--good); }
    .score-mid { color: var(--mid); }
    .score-bad { color: var(--bad); }
    tfoot td {
      background: #0f172a;
      color: #fff;
      font-weight: 800;
      border-top: none;
      font-size: 14px;
    }
    .note-card, .improve-card {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px 14px;
      margin-bottom: 10px;
      background: #fff;
    }
    .note-head, .improve-head {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: baseline;
      margin-bottom: 6px;
    }
    .note-card p, .improve-card p { margin: 6px 0 0; font-size: 13px; }
    .tiny { font-size: 11px !important; }
    .badge-amber {
      background: #fff7ed;
      color: var(--amber);
      border: 1px solid #fdba74;
      border-radius: 8px;
      padding: 2px 8px;
      font-size: 12px;
      font-weight: 800;
      white-space: nowrap;
    }
    .tag-bad { color: #b91c1c; font-weight: 700; }
    .tag-good { color: #047857; font-weight: 700; }
    .suggest-summary {
      background: linear-gradient(90deg, #fff7ed, #ecfeff);
      border: 1px solid #fdba74;
      border-radius: 12px;
      padding: 12px 14px;
      margin-bottom: 12px;
      font-size: 14px;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin: 14px 0 18px;
    }
    @media (max-width: 640px) { .metrics { grid-template-columns: 1fr; } }
    .metrics .card .value { font-size: 20px; }
    .remain-box {
      margin-top: 8px;
      border: 2px solid #fb923c;
      background: linear-gradient(180deg, #fff7ed 0%, #ffffff 100%);
      border-radius: 16px;
      padding: 18px 18px 12px;
    }
    .remain-box h2 {
      margin: 0 0 10px;
      font-size: 18px;
      color: #9a3412;
    }
    .remain-box .lead { font-size: 15px; margin: 0 0 10px; }
    .remain-box h3 { margin: 16px 0 8px; font-size: 15px; color: #9a3412; }
    .gap-list { margin: 0; padding-left: 20px; }
    .gap-list li { margin-bottom: 10px; }
    .remain-box .note {
      margin-top: 12px;
      padding: 10px 12px;
      background: #ecfdf5;
      border: 1px solid #6ee7b7;
      border-radius: 10px;
      color: #065f46;
      font-size: 13px;
    }
    .footer {
      margin-top: 28px;
      padding-top: 16px;
      border-top: 1px dashed var(--line);
      font-size: 12px;
      color: var(--muted);
      display: flex;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .print-hint {
      margin: 0 auto 20px;
      max-width: 880px;
      text-align: center;
      font-size: 13px;
      color: #475569;
    }
    @media print {
      body { background: #fff; }
      .print-hint { display: none; }
      .page { margin: 0; border: none; box-shadow: none; border-radius: 0; }
      .hero { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <p class="print-hint">📄 Pamphlet report · Use <strong>Ctrl+P</strong> → <strong>Save as PDF</strong> for a printable archive.</p>
  <article class="page">
    <header class="hero">
      <p class="brand">⚡ Grid Command · Tower Asset Management</p>
      <h1>🏗️ Tower Site Suitability Report</h1>
      <p class="subtitle">Satellite &amp; open-data screening pamphlet — original maintained analysis export</p>
      <div class="meta-row">
        <span class="chip">📍 ${esc(siteLabel)}</span>
        <span class="chip">🗺️ ${lat.toFixed(5)}, ${lon.toFixed(5)}</span>
        <span class="chip">🗓️ ${esc(when)}</span>
        ${
          kmlOutlineCount > 0
            ? `<span class="chip">📎 KML · ${kmlOutlineCount} outline${kmlOutlineCount === 1 ? '' : 's'}</span>`
            : ''
        }
      </div>
    </header>

    <div class="body">
      <div class="verdict-bar">
        <div class="card verdict">
          <p class="label">${decision.emoji} Decision</p>
          <p class="value">${decision.emoji} ${esc(decision.label)}</p>
          <p class="hint">${result.finalScore.toFixed(1)} / 10 screening score</p>
        </div>
        <div class="card">
          <p class="label">📊 Weighted Σ</p>
          <p class="value">${weightedSum.toFixed(2)}</p>
          <p class="hint">Σ (score × weight)</p>
        </div>
        <div class="card">
          <p class="label">📏 Rule</p>
          <p class="value" style="font-size:16px;padding-top:4px;">≥7 Acc · &lt;4.5 Rej</p>
          <p class="hint">Mid band = Review</p>
        </div>
        <div class="card">
          <p class="label">🎯 Confidence</p>
          <p class="value">~${result.confidencePct}%</p>
          <p class="hint">Open-data screening</p>
        </div>
      </div>

      <div class="disclaimer">⚠️ <strong>Disclaimer:</strong> ${esc(result.disclaimer)}</div>

      <h2 class="section-title">🧮 Score calculation</h2>
      <table>
        <thead>
          <tr>
            <th>Factor</th>
            <th class="right">Value</th>
            <th class="right">Score</th>
            <th class="right">Wt</th>
            <th class="right">Contrib</th>
          </tr>
        </thead>
        <tbody>
          ${factorRows}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4">🏆 Final weighted score</td>
            <td class="right">${result.finalScore.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      <h2 class="section-title">📝 Factor notes</h2>
      ${factorNotes}

      <h2 class="section-title">💡 Suggestions — gap to 10/10</h2>
      <div class="suggest-summary">${esc(suggestions.summary)}</div>
      <div class="metrics">
        <div class="card">
          <p class="label">Current</p>
          <p class="value">${suggestions.currentScore.toFixed(1)} <span style="font-size:13px;color:var(--muted);font-weight:700">/ 10</span></p>
        </div>
        <div class="card" style="border-color:#fdba74;background:#fff7ed;">
          <p class="label">Remaining</p>
          <p class="value" style="color:var(--amber);">${suggestions.remainingToPerfect.toFixed(1)} <span style="font-size:13px;font-weight:700">(${suggestions.remainingPct}%)</span></p>
        </div>
        <div class="card">
          <p class="label">To Accepted</p>
          <p class="value" style="color:var(--cyan);">${
            suggestions.pointsToAccepted > 0
              ? `+${suggestions.pointsToAccepted.toFixed(1)}`
              : 'Met ✓'
          }</p>
        </div>
      </div>
      ${improveCards}

      <div class="remain-box">
        <h2>📉 Why the remaining ${suggestions.remainingPct}% is not yet good</h2>
        ${remainingWhySection(suggestions, decision.label)}
      </div>

      <div class="footer">
        <span>© Grid Command · Tower Site Suitability</span>
        <span>Original maintained report export · ${esc(when)}</span>
      </div>
    </div>
  </article>
</body>
</html>`
}

function safeFilename(label: string): string {
  const base = label
    .trim()
    .replace(/[^\w\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  return base || 'tower-site'
}

/** Trigger browser download of the HTML pamphlet for the current analysis. */
export function downloadSuitabilityReport(input: ReportDownloadInput): void {
  const html = buildSuitabilityReportHtml(input)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  a.href = url
  a.download = `tower-suitability-report-${safeFilename(input.siteLabel)}-${stamp}.html`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
