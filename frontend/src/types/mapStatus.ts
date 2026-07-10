export interface MapStatusSnapshot {
  coordinates: { lat: number; lng: number } | null
  zoom: number | null
  viewMode: '2d' | '3d'
}
