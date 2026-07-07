'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { NewLeadModal } from '@/components/leads/NewLeadModal'

export function AddLeadButton() {
  const [showModal, setShowModal] = useState(false)
  const router = useRouter()

  return (
    <>
      {showModal && (
        <NewLeadModal
          onClose={() => setShowModal(false)}
          onCreated={() => router.refresh()}
        />
      )}
      <button onClick={() => setShowModal(true)} className="btn btn-primary">
        + Novo Lead
      </button>
    </>
  )
}
