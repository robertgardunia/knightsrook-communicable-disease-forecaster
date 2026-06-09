const BASE = '/api'

export async function fetchLayers(): Promise<string[]> {
  const res = await fetch(`${BASE}/layers`)
  const json = await res.json()
  return json.data ?? []
}

export async function fetchLayer(id: string): Promise<unknown> {
  const res = await fetch(`${BASE}/layers/${id}`)
  const json = await res.json()
  return json.data
}

export async function fetchPredictions(): Promise<unknown[]> {
  const res = await fetch(`${BASE}/predictions`)
  const json = await res.json()
  return json.data ?? []
}
