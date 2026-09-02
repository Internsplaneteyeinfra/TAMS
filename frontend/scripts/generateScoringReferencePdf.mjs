/**
 * Generate Tower Suitability Scoring Reference PDF from HTML.
 * Usage: node scripts/generateScoringReferencePdf.mjs
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const htmlPath = join(root, 'sample-reports', 'Tower_Suitability_Scoring_Reference.html')
const pdfPath = join(root, 'sample-reports', 'Tower_Suitability_Scoring_Reference.pdf')

async function withPuppeteer() {
  const puppeteer = await import('puppeteer')
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  try {
    const page = await browser.newPage()
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle0' })
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '8mm', right: '8mm' },
    })
    console.log(`[scoring-pdf] Wrote ${pdfPath}`)
  } finally {
    await browser.close()
  }
}

async function main() {
  readFileSync(htmlPath, 'utf8') // ensure exists
  try {
    await withPuppeteer()
  } catch (e) {
    console.warn('[scoring-pdf] Puppeteer not available, installing temporarily…')
    const { execSync } = await import('child_process')
    execSync('npm install puppeteer@23 --no-save', { cwd: root, stdio: 'inherit' })
    await withPuppeteer()
  }
}

main().catch((err) => {
  console.error('[scoring-pdf] Failed:', err.message)
  process.exit(1)
})
