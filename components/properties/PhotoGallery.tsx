'use client'
import { useRef, useState, useCallback } from 'react'
import { toast } from '@/lib/toast'

type Props = {
  propertyId: string
  photos: string[]
  onPhotosChange: (photos: string[]) => void
}

const MAX_DIMENSION = 1920
const JPEG_QUALITY = 0.8

async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file

  const bitmap = await createImageBitmapSafe(file)
  if (!bitmap) return file

  let { width, height } = bitmap
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    if (width >= height) {
      height = Math.round((height * MAX_DIMENSION) / width)
      width = MAX_DIMENSION
    } else {
      width = Math.round((width * MAX_DIMENSION) / height)
      height = MAX_DIMENSION
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, width, height)

  const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
  return blob ?? file
}

async function createImageBitmapSafe(file: File): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(file)
  } catch {
    return null
  }
}

export function PhotoGallery({ propertyId, photos, onPhotosChange }: Props) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const uploadFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter(f => f.type.startsWith('image/'))
    if (files.length === 0) return

    setUploading(true)
    try {
      const formData = new FormData()
      for (const file of files) {
        const compressed = await compressImage(file)
        const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
        formData.append('files', compressed, name)
      }

      const res = await fetch(`/api/properties/${propertyId}/photos`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast(data.error ?? 'Falha ao enviar fotos', 'error')
        return
      }

      const data = await res.json() as { photos: string[] }
      onPhotosChange(data.photos)
      toast('Fotos enviadas', 'success')
    } catch {
      toast('Falha ao enviar fotos', 'error')
    } finally {
      setUploading(false)
    }
  }, [propertyId, onPhotosChange])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) uploadFiles(e.target.files)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files)
  }

  async function deletePhoto(url: string) {
    if (!confirm('Eliminar esta foto?')) return
    try {
      const res = await fetch(`/api/properties/${propertyId}/photos`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast(data.error ?? 'Falha ao eliminar foto', 'error')
        return
      }
      const data = await res.json() as { photos: string[] }
      onPhotosChange(data.photos)
      toast('Foto eliminada', 'success')
    } catch {
      toast('Falha ao eliminar foto', 'error')
    }
  }

  async function persistOrder(newPhotos: string[]) {
    onPhotosChange(newPhotos)
    try {
      const res = await fetch(`/api/properties/${propertyId}/photos`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photos: newPhotos }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast(data.error ?? 'Falha ao reordenar fotos', 'error')
      }
    } catch {
      toast('Falha ao reordenar fotos', 'error')
    }
  }

  function handleDragStart(index: number) {
    setDragIndex(index)
  }

  function handleDragOverThumb(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
  }

  function handleDropThumb(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) { setDragIndex(null); return }
    const reordered = [...photos]
    const [moved] = reordered.splice(dragIndex, 1)
    reordered.splice(targetIndex, 0, moved)
    setDragIndex(null)
    persistOrder(reordered)
  }

  const labelStyle = { fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: 'var(--muted)', marginBottom: 4, fontWeight: 500 }

  return (
    <div>
      <div style={labelStyle}>Fotos</div>

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
        }}
      >
        {uploading ? 'A enviar...' : 'Arrasta fotos para aqui ou clica para escolher'}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />
      </div>

      {photos.length === 0 ? (
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>Sem fotos</span>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {photos.map((url, i) => (
            <div
              key={url}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={handleDragOverThumb}
              onDrop={() => handleDropThumb(i)}
              style={{
                position: 'relative',
                borderRadius: 8,
                overflow: 'hidden',
                border: '1px solid var(--border)',
                cursor: 'grab',
                opacity: dragIndex === i ? 0.5 : 1,
              }}
            >
              <img
                src={url}
                alt={`Foto ${i + 1}`}
                onClick={() => setLightboxUrl(url)}
                style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block', cursor: 'zoom-in' }}
              />
              {i === 0 && (
                <span style={{ position: 'absolute', top: 4, left: 4, fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'var(--gold)', color: '#1a1a1a', fontWeight: 600 }}>
                  Capa
                </span>
              )}
              <button
                onClick={() => deletePhoto(url)}
                aria-label="Eliminar foto"
                style={{
                  position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', cursor: 'pointer',
                  fontSize: 11, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, cursor: 'zoom-out',
          }}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            aria-label="Fechar"
            style={{
              position: 'absolute', top: 20, right: 24, width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 16,
            }}
          >
            ✕
          </button>
          <img
            src={lightboxUrl}
            alt="Foto em tamanho completo"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }}
          />
        </div>
      )}
    </div>
  )
}
