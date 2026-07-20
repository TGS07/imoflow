'use client'
import { useParams } from 'next/navigation'
import { ContactDetailPanel } from '@/components/contacts/ContactDetailPanel'

export default function PersonPage() {
  const { id } = useParams<{ id: string }>()
  return <ContactDetailPanel personId={id} />
}
