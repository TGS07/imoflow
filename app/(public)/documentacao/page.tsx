import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Documentação — ImoFlow',
  description: 'Guia completo de utilização da plataforma ImoFlow CRM.',
}

const sectionTitle: React.CSSProperties = { fontSize: 18, fontWeight: 600, color: 'var(--text)', marginTop: 32, marginBottom: 12 }
const paragraph: React.CSSProperties = { fontSize: 13, lineHeight: 1.8, color: 'var(--text)', marginBottom: 12 }
const list: React.CSSProperties = { fontSize: 13, lineHeight: 1.8, color: 'var(--text)', paddingLeft: 20, marginBottom: 12 }
const subTitle: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: 'var(--text)', marginTop: 16, marginBottom: 8 }
const card: React.CSSProperties = { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px', marginBottom: 12 }

export default function DocumentacaoPage() {
  return (
    <div style={{ maxWidth: 720, width: '100%' }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '40px 36px', boxShadow: 'var(--shadow-sm)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(to right, transparent, var(--gold), transparent)' }} />

        <h1 className="font-display" style={{ fontSize: 27, marginBottom: 8, color: 'var(--text)' }}>Documentação</h1>
        <p style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 32 }}>Guia de utilização do ImoFlow CRM</p>

        {/* Quick links */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 32 }}>
          {[
            { label: 'Primeiros Passos', anchor: '#primeiros-passos' },
            { label: 'Gestão de Leads', anchor: '#leads' },
            { label: 'Pipeline', anchor: '#pipeline' },
            { label: 'Imóveis', anchor: '#imoveis' },
            { label: 'Recomendações', anchor: '#recomendacoes' },
            { label: 'Automações', anchor: '#automacoes' },
          ].map(item => (
            <a key={item.anchor} href={item.anchor} style={{ ...card, textDecoration: 'none', color: 'var(--text)', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--gold)', fontSize: 16 }}>&#8250;</span>
              {item.label}
            </a>
          ))}
        </div>

        {/* 1. Primeiros Passos */}
        <h2 id="primeiros-passos" style={sectionTitle}>1. Primeiros Passos</h2>
        <p style={paragraph}>
          O ImoFlow é um CRM pensado para agências imobiliárias em Portugal. Após receber o convite do administrador da sua agência, aceda com o email e password definidos.
        </p>
        <h3 style={subTitle}>Painel Principal (Dashboard)</h3>
        <p style={paragraph}>
          O Dashboard apresenta um resumo da atividade: leads recentes, negócios no pipeline, atividades pendentes e métricas de desempenho. Utilize-o como ponto de partida do dia.
        </p>

        {/* 2. Leads */}
        <h2 id="leads" style={sectionTitle}>2. Gestão de Leads</h2>
        <p style={paragraph}>
          Os leads representam potenciais clientes interessados em comprar, vender ou arrendar imóveis.
        </p>
        <h3 style={subTitle}>Criar um lead</h3>
        <ul style={list}>
          <li>Clique em <strong>+ Novo Lead</strong> na página de Leads.</li>
          <li>Preencha nome, contacto, origem e interesses.</li>
          <li>O lead é automaticamente associado ao consultor que o criou.</li>
        </ul>
        <h3 style={subTitle}>Estados do lead</h3>
        <div style={card}>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>
            <strong>Novo</strong> &rarr; <strong>Contactado</strong> &rarr; <strong>Qualificado</strong> &rarr; <strong>Proposta</strong> &rarr; <strong>Ganho / Perdido</strong>
          </p>
        </div>
        <h3 style={subTitle}>Formulários públicos</h3>
        <p style={paragraph}>
          Pode criar formulários web que captam leads automaticamente. Aceda a <strong>Configurações &gt; Formulários</strong> para criar e personalizar formulários. Cada formulário gera um link público que pode ser incorporado no site da agência.
        </p>

        {/* 3. Pipeline */}
        <h2 id="pipeline" style={sectionTitle}>3. Pipeline de Vendas</h2>
        <p style={paragraph}>
          O pipeline permite visualizar todos os negócios em curso organizados por fases. Arraste os cartões entre colunas para atualizar o estado.
        </p>
        <h3 style={subTitle}>Personalização</h3>
        <p style={paragraph}>
          O administrador pode configurar as fases do pipeline em <strong>Configurações &gt; Pipeline</strong>, definindo nomes, cores e ordem.
        </p>

        {/* 4. Imóveis */}
        <h2 id="imoveis" style={sectionTitle}>4. Gestão de Imóveis</h2>
        <p style={paragraph}>
          Registe todos os imóveis da agência com informação detalhada: tipologia, área, preço, localização, fotografias e documentos.
        </p>
        <h3 style={subTitle}>Campos principais</h3>
        <ul style={list}>
          <li><strong>Referência</strong> — código interno do imóvel</li>
          <li><strong>Tipologia</strong> — T0, T1, T2, etc.</li>
          <li><strong>Finalidade</strong> — Venda, Arrendamento, ou ambos</li>
          <li><strong>Estado</strong> — Disponível, Reservado, Vendido</li>
          <li><strong>Localização</strong> — Distrito, concelho, freguesia</li>
        </ul>

        {/* 5. Recomendações */}
        <h2 id="recomendacoes" style={sectionTitle}>5. Recomendações Automáticas</h2>
        <p style={paragraph}>
          O ImoFlow monitoriza alertas do Idealista e cruza-os com os critérios dos seus leads, gerando recomendações automáticas de imóveis que podem interessar aos seus clientes.
        </p>
        <h3 style={subTitle}>Como funciona</h3>
        <ul style={list}>
          <li>O sistema lê os alertas recebidos por email (Gmail).</li>
          <li>Compara com as preferências dos leads ativos (zona, preço, tipologia).</li>
          <li>Gera cartões de recomendação que o consultor pode aprovar ou descartar.</li>
        </ul>

        {/* 6. Automações */}
        <h2 id="automacoes" style={sectionTitle}>6. Automações e Integrações</h2>

        <h3 style={subTitle}>Notificações Telegram</h3>
        <p style={paragraph}>
          Configure um bot de Telegram para receber notificações de novos leads, atividades pendentes e recomendações. O administrador configura o bot em <strong>Configurações &gt; Automações</strong>.
        </p>

        <h3 style={subTitle}>WhatsApp</h3>
        <p style={paragraph}>
          Comunique diretamente com leads via WhatsApp, com registo automático das conversas no histórico do lead.
        </p>

        <h3 style={subTitle}>Templates de Email</h3>
        <p style={paragraph}>
          Crie templates reutilizáveis para comunicações recorrentes em <strong>Configurações &gt; Templates</strong>. Os templates suportam variáveis dinâmicas como nome do lead e referência do imóvel.
        </p>

        {/* 7. Relatórios */}
        <h2 style={sectionTitle}>7. Relatórios</h2>
        <p style={paragraph}>
          A secção de Relatórios apresenta métricas de desempenho: leads por origem, taxa de conversão, tempo médio no pipeline e desempenho por consultor.
        </p>

        {/* 8. Administração */}
        <h2 style={sectionTitle}>8. Administração</h2>
        <p style={paragraph}>
          Funcionalidades exclusivas do administrador:
        </p>
        <ul style={list}>
          <li><strong>Equipa</strong> — convidar consultores, definir funções e permissões</li>
          <li><strong>Agência</strong> — configurar dados da agência, logótipo e licença AMI</li>
          <li><strong>Siglas</strong> — gerir abreviações personalizadas para a equipa</li>
          <li><strong>Formulários</strong> — criar e gerir formulários de captação de leads</li>
        </ul>

        {/* Suporte */}
        <h2 style={sectionTitle}>Precisa de Ajuda?</h2>
        <p style={paragraph}>
          Dentro da plataforma, aceda à página de <strong>Ajuda</strong> no menu lateral para encontrar respostas rápidas e contactar o suporte.
        </p>

        <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid var(--border)', display: 'flex', gap: 20, fontSize: 12 }}>
          <Link href="/termos" style={{ color: 'var(--gold)', textDecoration: 'none' }}>Termos de Uso</Link>
          <Link href="/privacidade" style={{ color: 'var(--gold)', textDecoration: 'none' }}>Política de Privacidade</Link>
        </div>
      </div>
    </div>
  )
}
