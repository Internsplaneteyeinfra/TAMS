import type { KmlFeature } from './fetchSiteSignals'

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function coordsToKml(latlngs: [number, number][]): string {
  return latlngs.map(([lat, lon]) => `${lon},${lat},0`).join(' ')
}

/** Build a simple KML document from drawn / loaded features. */
export function buildKmlDocument(
  features: KmlFeature[],
  docName = 'TAMS drawn site'
): string {
  const placemarks = features
    .map((feat, i) => {
      const name = escXml(feat.name || `${feat.type} ${i + 1}`)
      if (feat.type === 'Point' && feat.latlngs[0]) {
        const [lat, lon] = feat.latlngs[0]
        return `<Placemark><name>${name}</name><Point><coordinates>${lon},${lat},0</coordinates></Point></Placemark>`
      }
      if (feat.type === 'LineString' && feat.latlngs.length >= 2) {
        return `<Placemark><name>${name}</name><LineString><coordinates>${coordsToKml(
          feat.latlngs
        )}</coordinates></LineString></Placemark>`
      }
      if (feat.type === 'Polygon' && feat.latlngs.length >= 3) {
        return `<Placemark><name>${name}</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${coordsToKml(
          feat.latlngs
        )}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`
      }
      return ''
    })
    .filter(Boolean)
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escXml(docName)}</name>
    ${placemarks}
  </Document>
</kml>`
}

export function downloadKmlFile(features: KmlFeature[], filename = 'tams-drawn-site.kml'): void {
  const xml = buildKmlDocument(features, filename.replace(/\.kml$/i, ''))
  const blob = new Blob([xml], { type: 'application/vnd.google-earth.kml+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.kml') ? filename : `${filename}.kml`
  a.click()
  URL.revokeObjectURL(url)
}
