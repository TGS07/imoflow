'use client'
import { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { HELP_SECTIONS, helpSectionMeta } from '@/lib/help/manual'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

function HelpChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

  async function ask(e: React.FormEvent) {
    e.preventDefault()
    const question = input.trim()
    if (!question || busy) return
    setError('')
    setInput('')
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: question }]
    setMessages(nextMessages)
    setBusy(true)
    try {
      const res = await fetch('/api/ai/help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // histórico sem a pergunta atual (vai em `question`)
        body: JSON.stringify({ question, history: messages.slice(-6) }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json() as { answer: string }
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }])
    } catch {
      setError('Não foi possível obter resposta. Tenta novamente.')
    } finally {
      setBusy(false)
    }
  }

  const suggestions = [
    'Como marco um contacto como regular?',
    'Onde recebo as notificações de follow-up?',
    'Como associo um imóvel a um vendedor?',
    'Para que serve o contacto especial?',
  ]

  return (
    <div className="card" style={{ padding: 22, marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 15, color: 'var(--gold)' }}>✦</span>
        <span className="font-display" style={{ fontSize: 15 }}>Pergunta à IA</span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
        Tira dúvidas sobre o ImoFlow — como usar cada página, para que serve cada coisa.
      </p>

      {messages.length === 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {suggestions.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setInput(s)}
              style={{ fontSize: 11, padding: '5px 11px', borderRadius: 999, cursor: 'pointer', fontFamily: 'Jost, sans-serif', background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border)' }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {messages.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 380, overflowY: 'auto', marginBottom: 14, paddingRight: 4 }}>
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                background: m.role === 'user' ? 'var(--gold-glow)' : 'var(--surface)',
                border: `1px solid ${m.role === 'user' ? 'var(--gold)' : 'var(--border)'}`,
                borderRadius: 12,
                padding: '10px 14px',
                fontSize: 13,
                color: 'var(--text)',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.55,
              }}
            >
              {m.content}
            </div>
          ))}
          {busy && (
            <div style={{ alignSelf: 'flex-start', fontSize: 12, color: 'var(--muted)', padding: '6px 2px' }}>A pensar…</div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {error && <div style={{ fontSize: 12, color: '#EF4444', marginBottom: 10 }}>{error}</div>}

      <form onSubmit={ask} style={{ display: 'flex', gap: 8 }}>
        <input
          className="input"
          style={{ flex: 1 }}
          placeholder="Ex: como defino a frequência de follow-up de um contacto?"
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={busy}
        />
        <button type="submit" disabled={busy || !input.trim()} className="btn btn-primary" style={{ flexShrink: 0 }}>
          {busy ? '…' : 'Perguntar'}
        </button>
      </form>
    </div>
  )
}

function HelpContent() {
  const searchParams = useSearchParams()
  const initial = helpSectionMeta(searchParams.get('page'))?.key ?? HELP_SECTIONS[0].key
  const [selectedKey, setSelectedKey] = useState(initial)
  const section = helpSectionMeta(selectedKey) ?? HELP_SECTIONS[0]

  return (
    <>
      <div className="page-pad" style={{ padding: '20px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 className="font-display" style={{ fontSize: 20, fontWeight: 500 }}>Ajuda</h1>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>Manual do ImoFlow e assistente de dúvidas</p>
      </div>

      <div className="page-enter page-pad" style={{ padding: '28px 32px', flex: 1 }}>
        <HelpChat />

        <div className="help-grid" style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20, alignItems: 'start' }}>
          {/* Índice */}
          <div className="card" style={{ padding: 10, position: 'sticky', top: 90 }}>
            {HELP_SECTIONS.map(s => {
              const active = s.key === section.key
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSelectedKey(s.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                    padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5,
                    fontFamily: 'Jost, sans-serif', fontWeight: active ? 600 : 400,
                    background: active ? 'var(--gold-glow)' : 'transparent',
                    color: active ? 'var(--gold)' : 'var(--text)',
                    border: active ? '1px solid var(--gold)' : '1px solid transparent',
                  }}
                >
                  <span style={{ fontSize: 13 }}>{s.icon}</span>
                  {s.title}
                </button>
              )
            })}
          </div>

          {/* Conteúdo da secção */}
          <div className="card" style={{ padding: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 20 }}>{section.icon}</span>
              <h2 className="font-display" style={{ fontSize: 19 }}>{section.title}</h2>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.6 }}>{section.purpose}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {section.blocks.map(b => (
                <div key={b.heading}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', marginBottom: 5 }}>{b.heading}</div>
                  <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.65, margin: 0 }}>{b.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </>
  )
}

export default function HelpPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: 'var(--muted)', fontSize: 13 }}>A carregar…</div>}>
      <HelpContent />
    </Suspense>
  )
}
