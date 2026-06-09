import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import maplibregl, { GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { fetchLayer, fetchLayers } from './lib/api'

// ── constants ────────────────────────────────────────────────────────────────

const LAYER_LABELS: Record<string, string> = {
  idm_baseline: 'IDM Baseline',
  hydrogeology: 'Hydrogeology',
  transhumance: 'Transhumance',
  fly_kernel:   'Fly Kernel',
  cross_border: 'Cross-Border',
  surveillance: 'Surveillance Gaps',
}

const RISK_COLOR = [
  'interpolate', ['linear'], ['coalesce', ['get', 'risk_score'], 0],
  0,    '#ffffb2',
  0.25, '#fecc5c',
  0.5,  '#fd8d3c',
  0.75, '#f03b20',
  1,    '#bd0026',
]

const SPAN_OPTIONS = [
  { label: '1M',  months: 1  },
  { label: '3M',  months: 3  },
  { label: '6M',  months: 6  },
  { label: '1Y',  months: 12 },
]

const PROJECTION_MONTHS = 24
const PLAY_INTERVAL_MS  = 700
const FADE_MS           = 350

// ── date helpers ─────────────────────────────────────────────────────────────

function addMonths(date: Date, n: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + n)
  return d
}

function toYMD(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function parseYMD(s: string): Date {
  return new Date(s + 'T00:00:00Z')
}

function fmtDisplay(ymd: string, dataEnd: string | null): string {
  const d = parseYMD(ymd)
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
    + (dataEnd && ymd > dataEnd ? ' ›' : '')
}

function generateSteps(startYMD: string, endYMD: string, projectionMonths: number, spanMonths: number): string[] {
  const steps: string[] = []
  const limit = addMonths(parseYMD(endYMD), projectionMonths)
  let cur = parseYMD(startYMD)
  while (cur <= limit) {
    steps.push(toYMD(cur))
    cur = addMonths(cur, spanMonths)
  }
  return steps
}

function nearestStepIdx(steps: string[], ymd: string): number {
  if (!steps.length) return 0
  let best = 0
  let bestDiff = Infinity
  steps.forEach((s, i) => {
    const diff = Math.abs(parseYMD(s).getTime() - parseYMD(ymd).getTime())
    if (diff < bestDiff) { bestDiff = diff; best = i }
  })
  return best
}

// ── component ────────────────────────────────────────────────────────────────

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<maplibregl.Map | null>(null)
  const popupRef     = useRef<maplibregl.Popup | null>(null)

  // Stable refs used inside loadLayer to avoid re-creating the callback on every state change
  const frameCache      = useRef<Record<string, any>>({})
  const pendingSet      = useRef<Set<string>>(new Set())
  const abortMap        = useRef<Map<string, AbortController>>(new Map())
  const stepsRef        = useRef<string[]>([])
  const dataBootedRef   = useRef(false)

  const playTimer       = useRef<ReturnType<typeof setInterval> | null>(null)
  const insertBeforeRef = useRef<string | null>(null)

  const [mapReady,   setMapReady]   = useState(false)
  const [layerIds,   setLayerIds]   = useState<string[]>([])
  const [active,     setActive]     = useState<Set<string>>(new Set(['idm_baseline']))
  const [showLayers, setShowLayers] = useState(false)
  const [dataStart,  setDataStart]  = useState<string | null>(null)
  const [dataEnd,    setDataEnd]    = useState<string | null>(null)
  const [spanMonths, setSpanMonths] = useState(1)
  const [stepIdx,    setStepIdx]    = useState(0)
  const [playing,    setPlaying]    = useState(false)
  const [looping,    setLooping]    = useState(true)

  // Derived
  const steps = useMemo(
    () => dataStart && dataEnd ? generateSteps(dataStart, dataEnd, PROJECTION_MONTHS, spanMonths) : [],
    [dataStart, dataEnd, spanMonths],
  )

  // Keep stepsRef in sync so loadLayer (stable, [] deps) always sees latest steps
  useEffect(() => { stepsRef.current = steps }, [steps])

  const currentDate  = steps[stepIdx] ?? null
  const isProjection = dataEnd && currentDate ? currentDate > dataEnd : false

  // ── map init ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container:           containerRef.current,
      style:               'https://tiles.openfreemap.org/styles/positron',
      center:              [67.5, 33.0],
      zoom:                5,
      attributionControl:  false,
      preserveDrawingBuffer: true,  // needed so canvas.toDataURL() works for crossfade snapshots
    })
    map.addControl(new maplibregl.NavigationControl(), 'top-right')

    const popup = new maplibregl.Popup({
      closeButton: false, closeOnClick: false,
      className: 'cdf-popup',
      maxWidth: '240px',
    })
    popupRef.current = popup

    map.on('load', () => {
      const styleLayers = map.getStyle().layers
      const firstSymId = styleLayers.find(l => l.type === 'symbol')?.id ?? null
      const bl = styleLayers.find(l => (l as any)['source-layer'] === 'boundary') as any

      if (bl?.source && firstSymId) {
        map.addLayer({
          id: 'cdf-admin1', type: 'line',
          source: bl.source, 'source-layer': 'boundary',
          filter: ['==', ['get', 'admin_level'], 4],
          paint: { 'line-color': '#555', 'line-width': 0.7, 'line-opacity': 0.4 },
        }, firstSymId)
        map.addLayer({
          id: 'cdf-admin0', type: 'line',
          source: bl.source, 'source-layer': 'boundary',
          filter: ['==', ['get', 'admin_level'], 2],
          paint: { 'line-color': '#333', 'line-width': 1.8, 'line-opacity': 0.65 },
        }, firstSymId)
        insertBeforeRef.current = 'cdf-admin1'
      } else {
        insertBeforeRef.current = firstSymId
      }

      mapRef.current = map
      setMapReady(true)
    })
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // ── fetch layer list ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapReady) return
    fetchLayers().then(setLayerIds)
  }, [mapReady])

  // ── load / update layer data ──────────────────────────────────────────────

  // Stable callback — uses refs, never re-creates on state changes
  const loadLayer = useCallback(async (id: string, date: string | null) => {
    const map = mapRef.current
    if (!map) return

    const cacheKey = `${id}:${date ?? 'latest'}`
    let geojson = frameCache.current[cacheKey]

    if (!geojson) {
      if (pendingSet.current.has(cacheKey)) return  // already in-flight

      // Cancel previous pending request for this layer
      abortMap.current.get(id)?.abort()
      const controller = new AbortController()
      abortMap.current.set(id, controller)

      pendingSet.current.add(cacheKey)
      try {
        geojson = await fetchLayer(id, date ?? undefined, controller.signal)
        if (!geojson) return
        frameCache.current[cacheKey] = geojson
      } catch {
        return  // AbortError or network error — silently ignore
      } finally {
        pendingSet.current.delete(cacheKey)
      }
    }

    // Bootstrap date range from first IDM baseline response
    if (id === 'idm_baseline' && geojson?.meta?.data_start && !dataBootedRef.current) {
      dataBootedRef.current = true
      setDataStart(geojson.meta.data_start)
      setDataEnd(geojson.meta.data_end)
    }

    const srcId  = `src-${id}`
    const fillId = `fill-${id}`

    if (map.getSource(srcId)) {
      // Crossfade via canvas snapshot: freeze current frame as CSS overlay,
      // swap data instantly underneath, then fade the frozen screenshot out.
      // This avoids the "getting lighter" artifact from opacity-based blending.
      const canvas  = map.getCanvas()
      const dataUrl = canvas.toDataURL()
      const container = containerRef.current

      if (container && dataUrl.length > 200) {
        const overlay = document.createElement('img')
        overlay.src = dataUrl
        overlay.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;'
        container.appendChild(overlay)
        ;(map.getSource(srcId) as GeoJSONSource).setData(geojson)
        // Start fade after one rAF so the new data has begun rendering
        requestAnimationFrame(() => {
          overlay.style.transition = `opacity ${FADE_MS}ms ease`
          overlay.style.opacity = '0'
          setTimeout(() => { if (overlay.parentElement) overlay.remove() }, FADE_MS + 100)
        })
      } else {
        ;(map.getSource(srcId) as GeoJSONSource).setData(geojson)
      }
    } else {
      // First load: create source and fill layer
      const before = insertBeforeRef.current ?? undefined
      map.addSource(srcId, { type: 'geojson', data: geojson })
      map.addLayer({
        id: fillId, type: 'fill', source: srcId,
        paint: { 'fill-color': RISK_COLOR as any, 'fill-opacity': 0.72 },
      }, before)

      map.on('mouseenter', fillId, (e) => {
        if (!e.features?.length) return
        map.getCanvas().style.cursor = 'pointer'
        const p = e.features[0].properties as any
        const score = typeof p.risk_score === 'number' ? (p.risk_score * 100).toFixed(1) : '—'
        popupRef.current
          ?.setLngLat(e.lngLat)
          .setHTML(`
            <div style="font:13px sans-serif;line-height:1.5">
              <strong>${p.district}</strong><br>
              ${p.province}, ${p.country}<br>
              <hr style="margin:4px 0;border-color:#333">
              Risk score: <strong>${score}%</strong><br>
              Cases (WPV1): <strong>${p.total_cases}</strong><br>
              Last case: ${p.last_case ?? '—'}
            </div>
          `)
          .addTo(map)
      })
      map.on('mouseleave', fillId, () => {
        map.getCanvas().style.cursor = ''
        popupRef.current?.remove()
      })
    }

    // Prefetch next 2 frames (sequential fire-and-forget, respects pending set)
    if (date) {
      const stepsNow = stepsRef.current
      const idx = stepsNow.indexOf(date)
      for (let ahead = 1; ahead <= 2; ahead++) {
        const nextDate = stepsNow[idx + ahead]
        if (!nextDate) break
        const nk = `${id}:${nextDate}`
        if (!frameCache.current[nk] && !pendingSet.current.has(nk)) {
          pendingSet.current.add(nk)
          fetchLayer(id, nextDate)
            .then(d => { if (d) frameCache.current[nk] = d })
            .catch(() => {})
            .finally(() => pendingSet.current.delete(nk))
        }
      }
    }
  }, [])  // Stable — reads only refs, no state deps

  // Refresh map data when active layers, date, or readiness changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    // Remove layers that were deactivated
    layerIds.forEach(id => {
      if (!active.has(id) && map.getSource(`src-${id}`)) {
        if (map.getLayer(`fill-${id}`)) map.removeLayer(`fill-${id}`)
        map.removeSource(`src-${id}`)
      }
    })

    // Load / update active layers
    active.forEach(id => {
      if (layerIds.includes(id)) loadLayer(id, currentDate)
    })
  }, [active, mapReady, layerIds, currentDate, loadLayer])

  // ── span change: keep current date position ───────────────────────────────

  const prevStepRef = useRef<string | null>(null)
  useEffect(() => {
    const prev = prevStepRef.current
    if (steps.length && prev) {
      setStepIdx(nearestStepIdx(steps, prev))
    } else if (steps.length && dataEnd) {
      setStepIdx(nearestStepIdx(steps, dataEnd))
    }
  }, [steps])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { prevStepRef.current = currentDate })

  // ── auto-play ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (playTimer.current) clearInterval(playTimer.current)
    if (!playing || !steps.length) return

    playTimer.current = setInterval(() => {
      setStepIdx(prev => {
        const next = prev + 1
        if (next >= steps.length) {
          if (looping) return 0
          setPlaying(false)
          return prev
        }
        return next
      })
    }, PLAY_INTERVAL_MS)

    return () => { if (playTimer.current) clearInterval(playTimer.current) }
  }, [playing, steps.length, looping])

  // ── render ────────────────────────────────────────────────────────────────

  const projectionFrac = useMemo(() => {
    if (!dataEnd || !steps.length) return 1
    const endIdx = nearestStepIdx(steps, dataEnd)
    return endIdx / (steps.length - 1)
  }, [steps, dataEnd])

  const progressPct = steps.length > 1 ? (stepIdx / (steps.length - 1)) * 100 : 0

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#1a1a2e' }}>

      {/* Map */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Layer toggle */}
      <button
        onClick={() => setShowLayers(v => !v)}
        style={{
          position: 'absolute', top: 12, left: 12,
          background: showLayers ? 'rgba(255,255,255,0.18)' : 'rgba(15,15,25,0.78)',
          color: '#eee', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 6, padding: '6px 12px', cursor: 'pointer',
          fontSize: 12, letterSpacing: 1, textTransform: 'uppercase',
          backdropFilter: 'blur(4px)',
        }}
      >
        ☰ Layers
      </button>

      {/* Layers panel */}
      {showLayers && (
        <div style={{
          position: 'absolute', top: 48, left: 12,
          background: 'rgba(12,12,20,0.9)', color: '#ddd',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, padding: '12px 16px', minWidth: 180,
          backdropFilter: 'blur(6px)',
        }}>
          {layerIds.map(id => (
            <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={active.has(id)}
                onChange={() => setActive(prev => {
                  const n = new Set(prev)
                  n.has(id) ? n.delete(id) : n.add(id)
                  return n
                })}
              />
              {LAYER_LABELS[id] ?? id}
            </label>
          ))}
        </div>
      )}

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 88, left: 12,
        background: 'rgba(12,12,20,0.82)', color: '#ccc',
        borderRadius: 6, padding: '8px 12px', fontSize: 11,
        backdropFilter: 'blur(4px)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ marginBottom: 4, opacity: 0.7 }}>Risk score</div>
        <div style={{ height: 10, width: 140, background: 'linear-gradient(to right, #ffffb2, #fecc5c, #fd8d3c, #f03b20, #bd0026)', borderRadius: 2 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', width: 140, marginTop: 2, opacity: 0.6 }}>
          <span>0</span><span>1</span>
        </div>
      </div>

      {/* Time bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 72,
        background: 'rgba(8,8,16,0.92)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px',
        backdropFilter: 'blur(8px)',
      }}>

        {/* Playback controls */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {/* Step back — arrow with leading bar */}
          <CtrlBtn onClick={() => { setPlaying(false); setStepIdx(i => Math.max(0, i - 1)) }} title="Step back">⏮</CtrlBtn>
          {/* Play / Pause toggle */}
          <CtrlBtn
            onClick={() => setPlaying(v => !v)}
            title={playing ? 'Pause' : 'Play'}
            active={playing}
            style={{ fontSize: 15 }}
          >
            {playing ? '⏸' : '▶'}
          </CtrlBtn>
          {/* Step forward — arrow with trailing bar */}
          <CtrlBtn onClick={() => { setPlaying(false); setStepIdx(i => Math.min(steps.length - 1, i + 1)) }} title="Step forward">⏭</CtrlBtn>
          {/* Loop toggle */}
          <CtrlBtn
            onClick={() => setLooping(v => !v)}
            title={looping ? 'Loop on' : 'Loop off'}
            active={looping}
            style={{ fontSize: 14 }}
          >↺</CtrlBtn>
        </div>

        {/* Timeline scrubber */}
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          {/* Year labels */}
          <YearTicks steps={steps} projectionFrac={projectionFrac} />

          {/* Track + fill + scrubber dot */}
          <div style={{ position: 'relative', height: 6, borderRadius: 3, marginTop: 2 }}>
            {/* Track: dark gray base */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 3,
              background: 'rgba(255,255,255,0.1)',
            }} />
            {/* Projection zone: amber tint on right portion */}
            <div style={{
              position: 'absolute', top: 0, bottom: 0, borderRadius: '0 3px 3px 0',
              left: `${(projectionFrac * 100).toFixed(1)}%`,
              background: 'rgba(245,166,35,0.18)',
            }} />
            {/* Fill: bright blue or amber showing progress */}
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3,
              width: `${progressPct.toFixed(1)}%`,
              background: isProjection ? '#f5a623' : '#4a9eff',
              transition: 'width 160ms linear',
            }} />
            {/* Scrubber dot */}
            <div style={{
              position: 'absolute', top: '50%',
              left: `${progressPct.toFixed(1)}%`,
              transform: 'translate(-50%, -50%)',
              width: 12, height: 12, borderRadius: '50%',
              background: isProjection ? '#f5a623' : '#4a9eff',
              border: '2px solid rgba(255,255,255,0.9)',
              boxShadow: '0 0 4px rgba(0,0,0,0.5)',
              transition: 'left 160ms linear',
              pointerEvents: 'none',
            }} />
          </div>

          {/* Invisible range input covers the track for mouse interaction */}
          <input
            type="range"
            min={0} max={Math.max(0, steps.length - 1)} value={stepIdx}
            onChange={e => { setPlaying(false); setStepIdx(Number(e.target.value)) }}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              opacity: 0, cursor: 'pointer', margin: 0,
            }}
          />
        </div>

        {/* Date display */}
        <div style={{ flexShrink: 0, textAlign: 'right', minWidth: 130 }}>
          <div style={{
            fontSize: 16, fontWeight: 700,
            color: isProjection ? '#f5a623' : '#e8e8f0',
            letterSpacing: 0.5, fontVariantNumeric: 'tabular-nums',
          }}>
            {currentDate ? fmtDisplay(currentDate, dataEnd).replace(' ›', '') : '—'}
          </div>
          {isProjection && (
            <div style={{ fontSize: 10, color: '#f5a623', opacity: 0.75, marginTop: 1, letterSpacing: 1 }}>
              FORECAST
            </div>
          )}
        </div>

        {/* Span selector */}
        <div style={{ flexShrink: 0, display: 'flex', gap: 3 }}>
          {SPAN_OPTIONS.map(opt => (
            <button
              key={opt.months}
              onClick={() => setSpanMonths(opt.months)}
              style={{
                background:   spanMonths === opt.months ? 'rgba(74,158,255,0.3)' : 'transparent',
                color:        spanMonths === opt.months ? '#4a9eff' : '#888',
                border:       `1px solid ${spanMonths === opt.months ? '#4a9eff' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 4, padding: '3px 7px', cursor: 'pointer', fontSize: 11,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── sub-components ────────────────────────────────────────────────────────────

function CtrlBtn({ onClick, children, title, active = false, style: extraStyle = {} }: {
  onClick: () => void
  children: React.ReactNode
  title?: string
  active?: boolean
  style?: React.CSSProperties
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background:   active ? 'rgba(74,158,255,0.25)' : 'rgba(255,255,255,0.05)',
        color:        active ? '#4a9eff' : '#ccc',
        border:       `1px solid ${active ? 'rgba(74,158,255,0.4)' : 'rgba(255,255,255,0.12)'}`,
        borderRadius: 5, width: 34, height: 34, cursor: 'pointer', fontSize: 13,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 150ms, color 150ms',
        ...extraStyle,
      }}
    >
      {children}
    </button>
  )
}

function YearTicks({ steps, projectionFrac }: { steps: string[]; projectionFrac: number }) {
  if (steps.length < 2) return null
  const ticks: { label: string; pct: number; isProjection: boolean }[] = []
  let lastYear = ''
  steps.forEach((s, i) => {
    const year = s.slice(0, 4)
    if (year !== lastYear) {
      lastYear = year
      const pct = (i / (steps.length - 1)) * 100
      ticks.push({ label: year, pct, isProjection: pct / 100 > projectionFrac })
    }
  })
  return (
    <div style={{ position: 'relative', height: 14, marginBottom: 2 }}>
      {ticks.map(t => (
        <span
          key={t.label}
          style={{
            position: 'absolute', left: `${t.pct}%`, transform: 'translateX(-50%)',
            fontSize: 9, color: t.isProjection ? 'rgba(245,166,35,0.65)' : 'rgba(255,255,255,0.38)',
            whiteSpace: 'nowrap',
          }}
        >
          {t.label}
        </span>
      ))}
    </div>
  )
}
