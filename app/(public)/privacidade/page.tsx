import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Política de Privacidade — ImoFlow',
  description: 'Política de privacidade e proteção de dados da plataforma ImoFlow CRM.',
}

const sectionTitle: React.CSSProperties = { fontSize: 18, fontWeight: 600, color: 'var(--text)', marginTop: 32, marginBottom: 12 }
const paragraph: React.CSSProperties = { fontSize: 13, lineHeight: 1.8, color: 'var(--text)', marginBottom: 12 }
const list: React.CSSProperties = { fontSize: 13, lineHeight: 1.8, color: 'var(--text)', paddingLeft: 20, marginBottom: 12 }
const subTitle: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: 'var(--text)', marginTop: 16, marginBottom: 8 }

export default function PrivacidadePage() {
  return (
    <div style={{ maxWidth: 720, width: '100%' }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '40px 36px', boxShadow: 'var(--shadow-sm)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(to right, transparent, var(--gold), transparent)' }} />

        <h1 className="font-display" style={{ fontSize: 27, marginBottom: 8, color: 'var(--text)' }}>Política de Privacidade</h1>
        <p style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 32 }}>Última atualização: 21 de agosto de 2026</p>

        <p style={paragraph}>
          O ImoFlow respeita a privacidade dos seus utilizadores e está empenhado em proteger os dados pessoais, em conformidade com o Regulamento Geral sobre a Proteção de Dados (RGPD — Regulamento UE 2016/679) e a legislação portuguesa aplicável.
        </p>

        <h2 style={sectionTitle}>1. Responsável pelo Tratamento</h2>
        <p style={paragraph}>
          O responsável pelo tratamento dos dados é a entidade que opera a instância do ImoFlow CRM — tipicamente a agência imobiliária que contratou o serviço. O ImoFlow atua como subcontratante (processador) nos termos do artigo 28.º do RGPD.
        </p>

        <h2 style={sectionTitle}>2. Dados Recolhidos</h2>

        <h3 style={subTitle}>2.1 Dados dos utilizadores da plataforma</h3>
        <ul style={list}>
          <li>Nome, email e função (consultor/administrador)</li>
          <li>Dados de autenticação (hash da password — nunca armazenada em texto)</li>
          <li>Registos de atividade na plataforma (logs de acesso)</li>
        </ul>

        <h3 style={subTitle}>2.2 Dados de leads e contactos</h3>
        <ul style={list}>
          <li>Nome, telefone, email, NIF (quando fornecido)</li>
          <li>Notas e histórico de interações</li>
          <li>Preferências de imóveis e orçamento</li>
          <li>Estado no pipeline de vendas</li>
        </ul>

        <h3 style={subTitle}>2.3 Dados de imóveis</h3>
        <ul style={list}>
          <li>Morada, tipologia, preço, características</li>
          <li>Fotografias e documentos associados</li>
        </ul>

        <h2 style={sectionTitle}>3. Finalidades do Tratamento</h2>
        <ul style={list}>
          <li>Gestão do relacionamento com clientes (CRM)</li>
          <li>Gestão do pipeline de vendas e arrendamentos</li>
          <li>Comunicação com leads e clientes (WhatsApp, email, Telegram)</li>
          <li>Geração de relatórios de desempenho da agência</li>
          <li>Recomendações automáticas de imóveis baseadas em preferências</li>
        </ul>

        <h2 style={sectionTitle}>4. Base Legal</h2>
        <ul style={list}>
          <li><strong>Interesse legítimo</strong> — gestão operacional da atividade de mediação imobiliária</li>
          <li><strong>Execução contratual</strong> — prestação do serviço de CRM à agência</li>
          <li><strong>Consentimento</strong> — quando aplicável a comunicações de marketing</li>
          <li><strong>Obrigação legal</strong> — cumprimento de obrigações fiscais e regulatórias</li>
        </ul>

        <h2 style={sectionTitle}>5. Partilha de Dados</h2>
        <p style={paragraph}>Os dados podem ser partilhados com:</p>
        <ul style={list}>
          <li><strong>Supabase</strong> — infraestrutura de base de dados e autenticação (servidores na UE)</li>
          <li><strong>Vercel</strong> — alojamento da aplicação web</li>
          <li><strong>Telegram/WhatsApp</strong> — quando a agência ativa integrações de notificação</li>
        </ul>
        <p style={paragraph}>
          Não vendemos nem cedemos dados a terceiros para fins de marketing.
        </p>

        <h2 style={sectionTitle}>6. Conservação de Dados</h2>
        <ul style={list}>
          <li>Dados de utilizadores: enquanto a conta estiver ativa, mais 30 dias após eliminação</li>
          <li>Dados de leads/contactos: conforme política de retenção definida pela agência</li>
          <li>Logs de acesso: 12 meses</li>
        </ul>

        <h2 style={sectionTitle}>7. Direitos dos Titulares</h2>
        <p style={paragraph}>Nos termos do RGPD, os titulares dos dados têm direito a:</p>
        <ul style={list}>
          <li><strong>Acesso</strong> — consultar os dados pessoais tratados</li>
          <li><strong>Retificação</strong> — corrigir dados inexatos</li>
          <li><strong>Apagamento</strong> — solicitar a eliminação dos dados (&quot;direito ao esquecimento&quot;)</li>
          <li><strong>Portabilidade</strong> — receber os dados num formato estruturado</li>
          <li><strong>Oposição</strong> — opor-se ao tratamento em determinadas circunstâncias</li>
          <li><strong>Limitação</strong> — restringir o tratamento</li>
        </ul>
        <p style={paragraph}>
          Para exercer estes direitos, contacte o administrador da sua agência ou utilize a secção de Ajuda da plataforma.
        </p>

        <h2 style={sectionTitle}>8. Segurança</h2>
        <ul style={list}>
          <li>Encriptação em trânsito (TLS/HTTPS)</li>
          <li>Passwords armazenadas com hash seguro (bcrypt)</li>
          <li>Políticas de acesso baseadas em funções (RBAC)</li>
          <li>Row Level Security (RLS) na base de dados</li>
          <li>Backups automáticos diários</li>
        </ul>

        <h2 style={sectionTitle}>9. Cookies</h2>
        <p style={paragraph}>
          O ImoFlow utiliza apenas cookies essenciais para autenticação e preferência de tema (claro/escuro). Não utilizamos cookies de tracking, analytics ou publicidade.
        </p>

        <h2 style={sectionTitle}>10. Alterações a esta Política</h2>
        <p style={paragraph}>
          Esta política pode ser atualizada periodicamente. Quaisquer alterações serão comunicadas através da Plataforma com pelo menos 15 dias de antecedência.
        </p>

        <h2 style={sectionTitle}>11. Contacto e Reclamações</h2>
        <p style={paragraph}>
          Para questões de privacidade, contacte o administrador da sua agência. Se considerar que os seus direitos não estão a ser respeitados, pode apresentar reclamação à <strong>CNPD</strong> (Comissão Nacional de Proteção de Dados) — <em>www.cnpd.pt</em>.
        </p>

        <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid var(--border)', display: 'flex', gap: 20, fontSize: 12 }}>
          <Link href="/termos" style={{ color: 'var(--gold)', textDecoration: 'none' }}>Termos de Uso</Link>
          <Link href="/documentacao" style={{ color: 'var(--gold)', textDecoration: 'none' }}>Documentação</Link>
        </div>
      </div>
    </div>
  )
}
