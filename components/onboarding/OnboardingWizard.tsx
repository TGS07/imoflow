'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Icon } from '@/components/ui/Icon'
import { Badge } from '@/components/ui/Badge'
import { toast } from '@/lib/toast'

const STEP_LABELS = ['Agência', 'Pipeline', 'Primeiro Contacto', 'Equipa']

type PipelineTemplate = 'vendedores' | 'compradores' | 'leads_simples' | 'custom'

const TEMPLATE_OPTIONS: { value: PipelineTemplate; title: string; description: string }[] = [
  { value: 'vendedores', title: 'Vendas', description: 'Contacto → Angariação → Avaliação → Em promoção → Proposta → Vendido' },
  { value: 'compradores', title: 'Compradores', description: 'Contacto → Qualificação → Visitas → Proposta → Negociação → Fechado' },
  { value: 'leads_simples', title: 'Simples', description: 'Contacto → Qualificação → Proposta → Fechado' },
  { value: 'custom', title: 'Personalizado', description: 'Cria um pipeline vazio com o nome que quiseres' },
]

async function patchOnboardingState(patch: Record<string, unknown>) {
  await fetch('/api/onboarding', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ onboarding_state: patch }),
  })
}

export function OnboardingWizard() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [finishing, setFinishing] = useState(false)

  // Step 1 — Agência
  const [agencyName, setAgencyName] = useState('')
  const [agencyEmail, setAgencyEmail] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [agencySaving, setAgencySaving] = useState(false)
  const [agencyError, setAgencyError] = useState<string | null>(null)
  const [loadingAgency, setLoadingAgency] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Step 2 — Pipeline
  const [template, setTemplate] = useState<PipelineTemplate | null>(null)
  const [customPipelineName, setCustomPipelineName] = useState('')
  const [pipelineSaving, setPipelineSaving] = useState(false)
  const [pipelineError, setPipelineError] = useState<string | null>(null)

  // Step 3 — Primeiro Contacto
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactSaving, setContactSaving] = useState(false)
  const [contactError, setContactError] = useState<string | null>(null)

  // Step 4 — Equipa
  const [memberName, setMemberName] = useState('')
  const [memberEmail, setMemberEmail] = useState('')
  const [memberPassword, setMemberPassword] = useState('')
  const [memberSaving, setMemberSaving] = useState(false)
  const [memberError, setMemberError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadAgency() {
      try {
        const res = await fetch('/api/agency')
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) {
            setAgencyName(data.name ?? '')
            setAgencyEmail(data.email ?? '')
            setLogoUrl(data.logo_url ?? null)
          }
        }
      } finally {
        if (!cancelled) setLoadingAgency(false)
      }
    }
    loadAgency()
    return () => { cancelled = true }
  }, [])

  async function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    setAgencyError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/agency/logo', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        setAgencyError(data.error ?? 'Erro ao carregar o logótipo.')
        return
      }
      setLogoUrl(data.logo_url)
      toast('Logótipo carregado.', 'success')
    } catch {
      setAgencyError('Erro de rede. Tenta novamente.')
    } finally {
      setLogoUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleAgencyNext() {
    if (!agencyName.trim()) {
      setAgencyError('O nome da agência é obrigatório.')
      return
    }
    setAgencySaving(true)
    setAgencyError(null)
    try {
      const res = await fetch('/api/agency', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: agencyName.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        setAgencyError(data.error ?? 'Erro ao guardar os dados da agência.')
        return
      }
      await patchOnboardingState({ agency: true })
      setStep(1)
    } catch {
      setAgencyError('Erro de rede. Tenta novamente.')
    } finally {
      setAgencySaving(false)
    }
  }

  async function handlePipelineNext() {
    if (!template) {
      setPipelineError('Escolhe um modelo de pipeline.')
      return
    }
    if (template === 'custom' && !customPipelineName.trim()) {
      setPipelineError('Indica um nome para o pipeline.')
      return
    }
    setPipelineSaving(true)
    setPipelineError(null)
    try {
      const res = await fetch('/api/onboarding/pipeline-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          template === 'custom'
            ? { template, name: customPipelineName.trim() }
            : { template }
        ),
      })
      if (!res.ok) {
        const data = await res.json()
        setPipelineError(data.error ?? 'Erro ao criar o pipeline.')
        return
      }
      setStep(2)
    } catch {
      setPipelineError('Erro de rede. Tenta novamente.')
    } finally {
      setPipelineSaving(false)
    }
  }

  async function handleContactNext() {
    if (!contactName.trim()) {
      setContactError('O nome do contacto é obrigatório.')
      return
    }
    if (!contactPhone.trim() && !contactEmail.trim()) {
      setContactError('Indica um telefone ou email.')
      return
    }
    setContactSaving(true)
    setContactError(null)
    try {
      const res = await fetch('/api/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactName.trim(),
          phone: contactPhone.trim() || undefined,
          email: contactEmail.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setContactError(data.error ?? 'Erro ao criar o contacto.')
        return
      }
      await patchOnboardingState({ contact: true })
      setStep(3)
    } catch {
      setContactError('Erro de rede. Tenta novamente.')
    } finally {
      setContactSaving(false)
    }
  }

  async function finishOnboarding() {
    setFinishing(true)
    try {
      await fetch('/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarding_completed: true }),
      })
      router.push('/dashboard')
    } finally {
      setFinishing(false)
    }
  }

  async function handleMemberAdd() {
    if (!memberName.trim() || !memberEmail.trim() || !memberPassword.trim()) {
      setMemberError('Todos os campos são obrigatórios.')
      return
    }
    if (memberPassword.length < 8) {
      setMemberError('A password deve ter pelo menos 8 caracteres.')
      return
    }
    setMemberSaving(true)
    setMemberError(null)
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: memberName.trim(), email: memberEmail.trim(), password: memberPassword, role: 'agent' }),
      })
      if (!res.ok) {
        const data = await res.json()
        setMemberError(data.error ?? 'Erro ao adicionar membro.')
        return
      }
      await patchOnboardingState({ team: true })
      await finishOnboarding()
    } catch {
      setMemberError('Erro de rede. Tenta novamente.')
    } finally {
      setMemberSaving(false)
    }
  }

  function goBack() {
    setStep(s => Math.max(0, s - 1))
  }

  function skipStep() {
    if (step === 3) {
      finishOnboarding()
      return
    }
    setStep(s => s + 1)
  }

  return (
    <Card style={{ width: '100%', maxWidth: 640, padding: 0, overflow: 'hidden' }}>
      {/* Stepper header */}
      <div className="onboarding-stepper" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '24px 32px 0' }}>
        {STEP_LABELS.map((label, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < STEP_LABELS.length - 1 ? 1 : undefined, gap: 8, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
              <div
                style={{
                  width: 26, height: 26, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 600,
                  background: i < step ? 'var(--gold-gradient, #B07D2E)' : i === step ? 'var(--surface)' : 'var(--bg)',
                  border: i === step ? '2px solid #B07D2E' : '1px solid var(--border)',
                  color: i < step ? '#fff' : i === step ? 'var(--text)' : 'var(--muted)',
                }}
              >
                {i < step ? <Icon name="check" size={13} /> : i + 1}
              </div>
              <span
                className={i === step ? 'onboarding-step-label onboarding-step-label-active' : 'onboarding-step-label'}
                style={{ fontSize: 12, fontWeight: i === step ? 600 : 500, color: i === step ? 'var(--text)' : 'var(--muted)' }}
              >
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div style={{ flex: 1, height: 1, background: i < step ? '#B07D2E' : 'var(--border)' }} />
            )}
          </div>
        ))}
      </div>

      <div className="onboarding-step-content" style={{ padding: '28px 32px 32px' }}>
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <h2 className="font-display" style={{ fontSize: 'var(--fs-lg)', marginBottom: 4 }}>A tua agência</h2>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>Confirma o nome da agência e carrega o logótipo.</p>
            </div>

            {agencyError && <p style={{ color: 'var(--red)', fontSize: 13 }}>{agencyError}</p>}

            <Input
              label="Nome da agência"
              value={agencyName}
              onChange={e => setAgencyName(e.target.value)}
              placeholder="Imobiliária Exemplo"
              disabled={loadingAgency}
            />

            <div>
              <label className="label">Email</label>
              <Input value={agencyEmail} disabled readOnly />
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>O email é a identidade de login e não pode ser alterado aqui.</p>
            </div>

            <div>
              <label className="label">Logótipo</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 12, border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: 'var(--bg)',
                }}>
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="Logótipo da agência" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Icon name="building" size={22} style={{ color: 'var(--muted)' }} />
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoSelect}
                  style={{ display: 'none' }}
                  id="onboarding-logo-input"
                />
                <Button
                  type="button"
                  variant="soft"
                  size="sm"
                  loading={logoUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {logoUrl ? 'Trocar logótipo' : 'Carregar logótipo'}
                </Button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8 }}>
              <Button type="button" variant="ghost" disabled>Voltar</Button>
              <div style={{ display: 'flex', gap: 10 }}>
                <Button type="button" variant="ghost" onClick={skipStep}>Saltar</Button>
                <Button type="button" onClick={handleAgencyNext} loading={agencySaving}>Seguinte</Button>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <h2 className="font-display" style={{ fontSize: 'var(--fs-lg)', marginBottom: 4 }}>Escolhe um pipeline</h2>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>Podes criar mais tarde outros pipelines nas definições.</p>
            </div>

            {pipelineError && <p style={{ color: 'var(--red)', fontSize: 13 }}>{pipelineError}</p>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {TEMPLATE_OPTIONS.map(opt => (
                <Card
                  key={opt.value}
                  variant="interactive"
                  onClick={() => setTemplate(opt.value)}
                  style={{
                    cursor: 'pointer',
                    padding: 14,
                    border: template === opt.value ? '2px solid #B07D2E' : '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{opt.title}</span>
                    {template === opt.value && <Badge variant="gold">Selecionado</Badge>}
                  </div>
                  <p style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 }}>{opt.description}</p>
                </Card>
              ))}
            </div>

            {template === 'custom' && (
              <Input
                label="Nome do pipeline"
                value={customPipelineName}
                onChange={e => setCustomPipelineName(e.target.value)}
                placeholder="Ex: Arrendamentos"
              />
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8 }}>
              <Button type="button" variant="ghost" onClick={goBack}>Voltar</Button>
              <div style={{ display: 'flex', gap: 10 }}>
                <Button type="button" variant="ghost" onClick={skipStep}>Saltar</Button>
                <Button type="button" onClick={handlePipelineNext} loading={pipelineSaving}>Seguinte</Button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <h2 className="font-display" style={{ fontSize: 'var(--fs-lg)', marginBottom: 4 }}>Primeiro contacto</h2>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>Adiciona o teu primeiro contacto para começares a usar o CRM.</p>
            </div>

            {contactError && <p style={{ color: 'var(--red)', fontSize: 13 }}>{contactError}</p>}

            <Input
              label="Nome"
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              placeholder="Nome do contacto"
            />
            <Input
              label="Telefone"
              value={contactPhone}
              onChange={e => setContactPhone(e.target.value)}
              placeholder="912 345 678"
            />
            <Input
              label="Email"
              type="email"
              value={contactEmail}
              onChange={e => setContactEmail(e.target.value)}
              placeholder="contacto@exemplo.pt"
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8 }}>
              <Button type="button" variant="ghost" onClick={goBack}>Voltar</Button>
              <div style={{ display: 'flex', gap: 10 }}>
                <Button type="button" variant="ghost" onClick={skipStep}>Saltar</Button>
                <Button type="button" onClick={handleContactNext} loading={contactSaving}>Seguinte</Button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <h2 className="font-display" style={{ fontSize: 'var(--fs-lg)', marginBottom: 4 }}>Convida a tua equipa</h2>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>Cria uma conta para um colega. Podes convidar mais tarde nas definições.</p>
            </div>

            {memberError && <p style={{ color: 'var(--red)', fontSize: 13 }}>{memberError}</p>}

            <Input
              label="Nome"
              value={memberName}
              onChange={e => setMemberName(e.target.value)}
              placeholder="Nome do colega"
            />
            <Input
              label="Email"
              type="email"
              value={memberEmail}
              onChange={e => setMemberEmail(e.target.value)}
              placeholder="colega@agencia.pt"
            />
            <Input
              label="Password"
              type="password"
              value={memberPassword}
              onChange={e => setMemberPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8 }}>
              <Button type="button" variant="ghost" onClick={goBack}>Voltar</Button>
              <div style={{ display: 'flex', gap: 10 }}>
                <Button type="button" variant="ghost" onClick={skipStep} loading={finishing}>Saltar</Button>
                <Button type="button" onClick={handleMemberAdd} loading={memberSaving || finishing}>Concluir</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
