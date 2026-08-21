import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Termos de Uso — ImoFlow',
  description: 'Termos e condições de utilização da plataforma ImoFlow CRM.',
}

const sectionTitle: React.CSSProperties = { fontSize: 18, fontWeight: 600, color: 'var(--text)', marginTop: 32, marginBottom: 12 }
const paragraph: React.CSSProperties = { fontSize: 13, lineHeight: 1.8, color: 'var(--text)', marginBottom: 12 }
const list: React.CSSProperties = { fontSize: 13, lineHeight: 1.8, color: 'var(--text)', paddingLeft: 20, marginBottom: 12 }

export default function TermosPage() {
  return (
    <div style={{ maxWidth: 720, width: '100%' }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '40px 36px', boxShadow: 'var(--shadow-sm)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(to right, transparent, var(--gold), transparent)' }} />

        <h1 className="font-display" style={{ fontSize: 27, marginBottom: 8, color: 'var(--text)' }}>Termos de Uso</h1>
        <p style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 32 }}>Última atualização: 21 de agosto de 2026</p>

        <h2 style={sectionTitle}>1. Aceitação dos Termos</h2>
        <p style={paragraph}>
          Ao aceder e utilizar a plataforma ImoFlow (&quot;Plataforma&quot;), o utilizador aceita ficar vinculado aos presentes Termos de Uso. Se não concordar com alguma disposição, deverá cessar imediatamente a utilização da Plataforma.
        </p>

        <h2 style={sectionTitle}>2. Descrição do Serviço</h2>
        <p style={paragraph}>
          O ImoFlow é um CRM (Customer Relationship Management) desenhado para agências imobiliárias, que oferece funcionalidades de gestão de leads, pipeline de vendas, imóveis, contactos, relatórios e automações.
        </p>

        <h2 style={sectionTitle}>3. Registo e Conta</h2>
        <ul style={list}>
          <li>O acesso é concedido por convite do administrador da agência.</li>
          <li>O utilizador é responsável por manter a confidencialidade das suas credenciais.</li>
          <li>Cada conta é pessoal e intransmissível.</li>
          <li>O utilizador deve fornecer informações verdadeiras e atualizadas.</li>
        </ul>

        <h2 style={sectionTitle}>4. Utilização Aceitável</h2>
        <p style={paragraph}>O utilizador compromete-se a:</p>
        <ul style={list}>
          <li>Utilizar a Plataforma apenas para fins profissionais relacionados com atividade imobiliária.</li>
          <li>Não tentar aceder a dados de outros utilizadores sem autorização.</li>
          <li>Não utilizar a Plataforma para enviar comunicações não solicitadas (spam).</li>
          <li>Não realizar engenharia reversa, copiar ou redistribuir qualquer parte da Plataforma.</li>
          <li>Cumprir toda a legislação aplicável, incluindo o RGPD e a Lei da Mediação Imobiliária.</li>
        </ul>

        <h2 style={sectionTitle}>5. Dados e Conteúdo</h2>
        <p style={paragraph}>
          Os dados introduzidos pelo utilizador (leads, contactos, imóveis, notas) permanecem propriedade da agência. O ImoFlow atua apenas como processador desses dados, conforme descrito na <Link href="/privacidade" style={{ color: 'var(--gold)', textDecoration: 'underline' }}>Política de Privacidade</Link>.
        </p>

        <h2 style={sectionTitle}>6. Disponibilidade e Manutenção</h2>
        <p style={paragraph}>
          O ImoFlow esforça-se por manter a Plataforma disponível 24/7, mas não garante disponibilidade ininterrupta. Poderão ocorrer períodos de manutenção programada, comunicados com antecedência razoável.
        </p>

        <h2 style={sectionTitle}>7. Propriedade Intelectual</h2>
        <p style={paragraph}>
          Todo o código, design, logótipos e conteúdo da Plataforma são propriedade do ImoFlow. O utilizador obtém apenas uma licença limitada, não exclusiva e revogável para utilizar o serviço.
        </p>

        <h2 style={sectionTitle}>8. Limitação de Responsabilidade</h2>
        <p style={paragraph}>
          O ImoFlow não se responsabiliza por perdas indiretas, lucros cessantes ou danos resultantes de interrupções de serviço, perda de dados por motivos fora do seu controlo ou utilização inadequada por parte do utilizador.
        </p>

        <h2 style={sectionTitle}>9. Rescisão</h2>
        <p style={paragraph}>
          A agência pode cancelar a sua conta a qualquer momento. O ImoFlow reserva-se o direito de suspender ou encerrar contas que violem estes Termos, com aviso prévio de 30 dias exceto em casos de violação grave.
        </p>

        <h2 style={sectionTitle}>10. Alterações aos Termos</h2>
        <p style={paragraph}>
          O ImoFlow pode atualizar estes Termos a qualquer momento. As alterações serão comunicadas através da Plataforma e entrarão em vigor 15 dias após a publicação.
        </p>

        <h2 style={sectionTitle}>11. Lei Aplicável</h2>
        <p style={paragraph}>
          Estes Termos regem-se pela lei portuguesa. Qualquer litígio será submetido aos tribunais da comarca de Lisboa, com renúncia a qualquer outro foro.
        </p>

        <h2 style={sectionTitle}>12. Contacto</h2>
        <p style={paragraph}>
          Para questões relacionadas com estes Termos, contacte-nos através do email disponível na secção de Ajuda da Plataforma.
        </p>

        <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid var(--border)', display: 'flex', gap: 20, fontSize: 12 }}>
          <Link href="/privacidade" style={{ color: 'var(--gold)', textDecoration: 'none' }}>Política de Privacidade</Link>
          <Link href="/documentacao" style={{ color: 'var(--gold)', textDecoration: 'none' }}>Documentação</Link>
        </div>
      </div>
    </div>
  )
}
