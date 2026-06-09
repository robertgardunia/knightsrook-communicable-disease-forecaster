import { useEffect, useRef, useState } from 'react'

export function useWebSocket(path: string) {
  const [messages, setMessages] = useState<unknown[]>([])
  const ws = useRef<WebSocket | null>(null)

  useEffect(() => {
    const connect = () => {
      const url = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}${path}`
      ws.current = new WebSocket(url)
      ws.current.onmessage = e => setMessages(prev => [...prev.slice(-199), JSON.parse(e.data)])
      ws.current.onclose = () => setTimeout(connect, 2000)
    }
    connect()
    return () => ws.current?.close()
  }, [path])

  return messages
}
