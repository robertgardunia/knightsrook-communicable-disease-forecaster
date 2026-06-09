import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { fetchLayers } from './lib/api'

const LAYER_LABELS: Record<string, string> = {
  idm_baseline: 'IDM Baseline',
  hydrogeology: 'Hydrogeology',
  transhumance: 'Transhumance',
  fly_kernel: 'Fly Kernel',
  cross_border: 'Cross-Border',
  surveillance: 'Surveillance Gaps',
}

export default function App() {
  const mapRef = useRef<HTMLDivElement>(null)
  const [layers, setLayers] = useState<string[]>([])
  const [active, setActive] = useState<Set<string>>(new Set(['idm_baseline']))

  useEffect(() => {
    fetchLayers().then(setLayers)
  }, [])

  useEffect(() => {
    if (!mapRef.current) return
    const map = new maplibregl.Map({
      container: mapRef.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [67.5, 33.0], // Pakistan-Afghanistan bloc
      zoom: 5,
    })
    map.addControl(new maplibregl.NavigationControl())
    return () => map.remove()
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      <aside style={{ width: 220, background: '#111', color: '#eee', padding: 16, overflowY: 'auto' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>
          Risk Layers
        </h2>
        {layers.map(id => (
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
          </label>
        ))}
      </aside>
      <div ref={mapRef} style={{ flex: 1 }} />
    </div>
  )
}
