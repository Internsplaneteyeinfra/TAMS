import { parseKmlDocument, type ParsedKml } from './fetchSiteSignals'

function u16(view: DataView, offset: number) {
  return view.getUint16(offset, true)
}

function u32(view: DataView, offset: number) {
  return view.getUint32(offset, true)
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser cannot unpack KMZ. Use a .kml file instead.')
  }
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  const buf = await new Response(stream).arrayBuffer()
  return new Uint8Array(buf)
}

/**
 * Minimal ZIP reader for KMZ (Google Earth zip of one or more .kml files).
 * Supports store (0) and deflate (8) entries — enough for typical KMZ exports.
 */
async function extractKmlFromKmz(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  const found: { name: string; data: Uint8Array }[] = []

  let offset = 0
  while (offset + 30 <= bytes.length) {
    if (u32(view, offset) !== 0x04034b50) break
    const method = u16(view, offset + 8)
    const compSize = u32(view, offset + 18)
    const uncompSize = u32(view, offset + 22)
    const nameLen = u16(view, offset + 26)
    const extraLen = u16(view, offset + 28)
    const nameStart = offset + 30
    const nameEnd = nameStart + nameLen
    const dataStart = nameEnd + extraLen
    const dataEnd = dataStart + compSize
    if (dataEnd > bytes.length) break

    const name = new TextDecoder().decode(bytes.subarray(nameStart, nameEnd))
    if (!name.endsWith('/') && /\.kml$/i.test(name)) {
      const compressed = bytes.subarray(dataStart, dataEnd)
      let data: Uint8Array
      if (method === 0) {
        data = compressed
      } else if (method === 8) {
        data = await inflateRaw(compressed)
        if (uncompSize && data.length !== uncompSize && uncompSize < 50_000_000) {
          // Some writers lie about size; keep inflated bytes.
        }
      } else {
        offset = dataEnd
        continue
      }
      found.push({ name, data })
    }
    offset = dataEnd
  }

  if (!found.length) {
    throw new Error('This KMZ has no .kml file inside. Export again from Google Earth or GIS.')
  }

  found.sort((a, b) => {
    const aDoc = /(?:^|\/)doc\.kml$/i.test(a.name) ? 0 : 1
    const bDoc = /(?:^|\/)doc\.kml$/i.test(b.name) ? 0 : 1
    if (aDoc !== bDoc) return aDoc - bDoc
    const aDepth = a.name.split('/').length
    const bDepth = b.name.split('/').length
    if (aDepth !== bDepth) return aDepth - bDepth
    return a.name.localeCompare(b.name)
  })

  return new TextDecoder('utf-8', { fatal: false }).decode(found[0].data)
}

/** Read plain KML text or extract the first .kml from a KMZ archive. */
export async function readKmlTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  const isKmz =
    name.endsWith('.kmz') ||
    file.type === 'application/vnd.google-earth.kmz' ||
    file.type === 'application/zip'

  if (!isKmz) return file.text()
  return extractKmlFromKmz(await file.arrayBuffer())
}

export async function parseKmlOrKmzFile(file: File): Promise<ParsedKml | null> {
  const text = await readKmlTextFromFile(file)
  return parseKmlDocument(text)
}

/** True when asset voltage matches the selected neighbor kV class. */
export function assetMatchesNeighborKv(
  asset: { voltageKv?: number | null; voltagesKv?: number[] },
  targetKv: number | null
): boolean {
  if (targetKv == null) return true
  const pool =
    asset.voltagesKv && asset.voltagesKv.length
      ? asset.voltagesKv
      : asset.voltageKv != null
        ? [asset.voltageKv]
        : []
  if (!pool.length) return false
  return pool.some((kv) => Math.abs(kv - targetKv) <= 25)
}
