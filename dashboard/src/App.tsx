import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { fetchLayer, fetchLayers } from './lib/api'

const LAYER_LABELS: Record<string, string> = {
  idm_baseline:  'IDM Baseline',
  hydrogeology:  'Hydrogeology',
  transhumance:  'Transhumance',
  fly_kernel:    'Fly Kernel',
  cross_border:  'Cross-Border',
  surveillance:  'Surveillance Gaps',
}

// Risk score choropleth: low=pale-yellow → high=deep-red
const RISK_COLOR = [
  'interpolate', ['linear'], ['get', 'risk_score'],
  0,    '#ffffb2',
  0.25, '#fecc5c',
  0.5,  '#fd8d3c',
  0.75, '#f03b20',
  1,    '#bd0026',
]

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<maplibregl.Map | null>(null)
  const [mapReady,   setMapReady]   = useState(false)
  const [layerIds,   setLayerIds]   = useState<string[]>([])
  const [active,     setActive]     = useState<Set<string>>(new Set(['idm_baseline']))
  const [loading,    setLoading]    = useState<Set<string>>(new Set())

  // Initialise map once
  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: [67.5, 33.0],
      zoom: 5,
    })
    map.addControl(new maplibregl.NavigationControl())
    map.on('load', () => {
      mapRef.current = map
      setMapReady(true)
    })
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // Fetch layer list once map is ready
  useEffect(() => {
    if (!mapReady) return
    fetchLayers().then(setLayerIds)
  }, [mapReady])

  // Add/remove layers when active set changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    layerIds.forEach(id => {
      const srcId    = `src-${id}`
      const fillId   = `fill-${id}`
      const lineId   = `line-${id}`
      const isActive = active.has(id)
      const hasSource = !!map.getSource(srcId)

      if (isActive && !hasSource) {
        setLoading(prev => new Set(prev).add(id))
        fetchLayer(id).then((geojson: any) => {
          if (!mapRef.current) return
          if (!mapRef.current.getSource(srcId)) {
            mapRef.current.addSource(srcId, { type: 'geojson', data: geojson })
            mapRef.current.addLayer({
              id: fillId,
              type: 'fill',
              source: srcId,
              paint: {
                'fill-color': RISK_COLOR as any,
                'fill-opacity': 0.7,
              },
            })
            mapRef.current.addLayer({
              id: lineId,
              type: 'line',
              source: srcId,
              paint: { 'line-color': '#666', 'line-width': 0.6 },
            })
          }
          setLoading(prev => { const n = new Set(prev); n.delete(id); return n })
        })
      } else if (!isActive && hasSource) {
        if (map.getLayer(lineId)) map.removeLayer(lineId)
        if (map.getLayer(fillId)) map.removeLayer(fillId)
        map.removeSource(srcId)
      }
    })
  }, [active, mapReady, layerIds])

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      <aside style={{ width: 220, background: '#111', color: '#eee', padding: 16, overflowY: 'auto' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>
          Risk Layers
        </h2>
        {layerIds.map(id => (
          <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer', fontSize: 13 }}>
            <input
              type="checkbox"
              checked={active.has(id)}
              onChange={() => setActive(prev => {
                const next = new Set(prev)
                next.has(id) ? next.delete(id) : next.add(id)
                return next
              })}
            />
            {LAYER_LABELS[id] ?? id}
            {loading.has(id) && <span style={{ fontSize: 11, opacity: 0.6 }}>…</span>}
          </label>
        ))}
        <div style={{ marginTop: 20, borderTop: '1px solid #333', paddingTop: 12 }}>
          <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 6 }}>Risk score</div>
          <div style={{ height: 12, background: 'linear-gradient(to right, #ffffb2, #fecc5c, #fd8d3c, #f03b20, #bd0026)', borderRadius: 2 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, opacity: 0.5, marginTop: 2 }}>
            <span>0</span><span>1</span>
          </div>
        </div>
      </aside>
      <div ref={containerRef} style={{ flex: 1 }} />
    </div>
  )
}
