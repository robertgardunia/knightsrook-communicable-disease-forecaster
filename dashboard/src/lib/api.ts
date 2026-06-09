const BASE = '/api'

export async function fetchLayers(): Promise<string[]> {
  const res = await fetch(`${BASE}/layers`)
  const json = await res.json()
  return json.data ?? []
}

export async function fetchLayer(id: string, date?: string, signal?: AbortSignal): Promise<any> {
  const url = date ? `${BASE}/layers/${id}?date=${date}` : `${BASE}/layers/${id}`
  const res = await fetch(url, signal ? { signal } : undefined)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  return json.data
}

export async function fetchPredictions(): Promise<unknown[]> {
  const res = await fetch(`${BASE}/predictions`)
  const json = await res.json()
  return json.data ?? []
}
