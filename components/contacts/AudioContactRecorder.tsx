// components/contacts/AudioContactRecorder.tsx
'use client'
import { useState, useRef } from 'react'

export function AudioContactRecorder({ onExtracted }: { onExtracted: (fields: Record<string, unknown>) => void }) {
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  async function start() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data) }
      mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); void upload() }
      mediaRef.current = mr
      mr.start()
      setRecording(true)
    } catch { setError('Sem acesso ao microfone.') }
  }

  function stop() { mediaRef.current?.stop(); setRecording(false) }

  async function upload() {
    setProcessing(true)
    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      const fd = new FormData()
      fd.append('audio', new File([blob], 'contacto.webm', { type: 'audio/webm' }))
      const res = await fetch('/api/ai/transcribe-contact', { method: 'POST', body: fd })
      if (!res.ok) { setError('Falha na transcrição.'); return }
      const data = await res.json()
      onExtracted({ ...(data.fields ?? {}), source: 'audio' })
    } catch { setError('Erro ao processar o áudio.') }
    finally { setProcessing(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', padding: 20 }}>
      <button type="button" onClick={recording ? stop : start} disabled={processing}
        className={recording ? 'btn' : 'btn btn-primary'}
        style={recording ? { background: '#EF4444', color: '#fff' } : undefined}>
        {processing ? 'A processar...' : recording ? '⏹ Parar' : '🎙 Gravar'}
      </button>
      <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
        {processing ? 'A transcrever e a extrair dados...' : 'Descreve o contacto em voz alta e confirma os dados a seguir.'}
      </div>
      {error && <div style={{ fontSize: 12, color: '#EF4444' }}>{error}</div>}
    </div>
  )
}
