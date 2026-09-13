'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from '@/lib/toast'
import { Icon, type IconName } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'

type EntityType = 'lead' | 'person' | 'property'

type Document = {
  id: string
  name: string
  file_path: string
  file_type: string | null
  file_size: number | null
  created_at: string
  url: string | null
}

type Props = {
  entityType: EntityType
  entityId: string
}

function iconForType(fileType: string | null): IconName {
  if (!fileType) return 'file'
  if (fileType === 'application/pdf') return 'file-pdf'
  if (fileType.startsWith('image/')) return 'file-image'
  return 'file'
}

function isPdf(fileType: string | null) {
  return fileType === 'application/pdf'
}

function isImage(fileType: string | null) {
  return !!fileType && fileType.startsWith('image/')
}

function formatSize(bytes: number | null) {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-PT')
}

export function DocumentList({ entityType, entityId }: Props) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/documents?entity_type=${entityType}&entity_id=${entityId}`)
      if (!res.ok) return
      const data = await res.json() as Document[]
      setDocuments(data)
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const uploadFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList)
    if (files.length === 0) return

    setUploading(true)
    try {
      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('entity_type', entityType)
        formData.append('entity_id', entityId)

        const res = await fetch('/api/documents', { method: 'POST', body: formData })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          toast(data.error ?? 'Falha ao enviar documento', 'error')
          continue
        }
      }
      await fetchDocuments()
      toast('Documento(s) enviado(s)', 'success')
    } catch {
      toast('Falha ao enviar documento', 'error')
    } finally {
      setUploading(false)
    }
  }, [entityType, entityId, fetchDocuments])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) uploadFiles(e.target.files)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files)
  }

  async function deleteDocument(doc: Document) {
    if (!confirm(`Eliminar "${doc.name}"?`)) return
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast(data.error ?? 'Falha ao eliminar documento', 'error')
        return
      }
      setDocuments(prev => prev.filter(d => d.id !== doc.id))
      toast('Documento eliminado', 'success')
    } catch {
      toast('Falha ao eliminar documento', 'error')
    }
  }

  function handleDocumentClick(doc: Document) {
    if (!doc.url) return
    if (isPdf(doc.file_type) || isImage(doc.file_type)) {
      setPreviewDoc(doc)
    } else {
      window.open(doc.url, '_blank', 'noopener,noreferrer')
    }
  }

  const labelStyle = { fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: 'var(--muted)', marginBottom: 4, fontWeight: 500 }

  return (
    <div>
      <div style={labelStyle}>Documentos</div>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          border: `1px dashed ${dragOver ? 'var(--gold)' : 'var(--border)'}`,
          borderRadius: 8,
          padding: '16px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragOver ? 'rgba(212,175,55,0.06)' : 'transparent',
          marginBottom: 10,
          fontSize: 12,
          color: 'var(--muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <Icon name="upload" size={14} />
        {uploading ? 'A enviar...' : 'Arrasta ficheiros para aqui ou clica para escolher'}
        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />
      </div>

      {loading ? (
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>A carregar...</span>
      ) : documents.length === 0 ? (
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>Sem documentos</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {documents.map(doc => (
            <div
              key={doc.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid var(--border)',
              }}
            >
              <span
                onClick={() => handleDocumentClick(doc)}
                style={{ color: 'var(--muted)', flexShrink: 0, cursor: doc.url ? 'pointer' : 'default', display: 'flex' }}
              >
                <Icon name={iconForType(doc.file_type)} size={18} />
              </span>
              <div
                onClick={() => handleDocumentClick(doc)}
                style={{ flex: 1, minWidth: 0, cursor: doc.url ? 'pointer' : 'default' }}
              >
                <div style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.name}
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)', opacity: 0.7 }}>
                  {formatDate(doc.created_at)}{doc.file_size != null ? ` · ${formatSize(doc.file_size)}` : ''}
                </div>
              </div>
              <button
                onClick={() => deleteDocument(doc)}
                aria-label="Eliminar documento"
                style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  background: 'transparent', color: 'var(--muted)', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!previewDoc} onClose={() => setPreviewDoc(null)} title={previewDoc?.name} size="lg">
        {previewDoc && previewDoc.url && (
          isImage(previewDoc.file_type) ? (
            <img
              src={previewDoc.url}
              alt={previewDoc.name}
              style={{ maxWidth: '100%', maxHeight: '75vh', display: 'block', margin: '0 auto', borderRadius: 8 }}
            />
          ) : (
            <iframe
              src={previewDoc.url}
              title={previewDoc.name}
              style={{ width: '100%', height: '75vh', border: 'none', borderRadius: 8 }}
            />
          )
        )}
      </Modal>
    </div>
  )
}
