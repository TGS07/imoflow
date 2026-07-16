// lib/help/manual.ts
// Manual de instruções do ImoFlow — fonte única de verdade: alimenta a
// página /help e o contexto do chat de IA (/api/ai/help). Ao adicionar ou
// alterar funcionalidades relevantes para o utilizador, atualizar aqui.

export type HelpBlock = { heading: string; body: string }

export type HelpSection = {
  key: string
  title: string
  icon: string
  purpose: string
  blocks: HelpBlock[]
}

export const HELP_SECTIONS: HelpSection[] = [
  {
    key: 'dashboard',
    title: 'Dashboard',
    icon: '📊',
    purpose: 'A tua página inicial: resumo do negócio e do teu dia num só sítio.',
    blocks: [
      {
        heading: 'Cartões de estatísticas',
        body: 'Leads Ativos (leads que não estão fechadas nem perdidas), Pipeline Total (soma do valor dos negócios ativos), Pipeline Ponderado (valor ajustado pela probabilidade de cada etapa), Fechados (mês) e Atividades Pendentes.',
      },
      {
        heading: 'Pipeline de Vendas',
        body: 'Barra colorida com a distribuição das leads por etapa e lista das leads mais recentes. Clica numa lead para abrir a ficha; "Ver tudo" leva ao pipeline completo.',
      },
      {
        heading: 'Atividades de Hoje',
        body: 'As tarefas, chamadas, visitas e reuniões agendadas para hoje. O destaque "A seguir" mostra o próximo evento por acontecer.',
      },
      {
        heading: 'Agenda de hoje',
        body: 'Lista dos contactos que precisam de atenção hoje: contactos regulares com follow-up atrasado (indica há quantos dias) e contactos especiais com data importante hoje (aniversário, Natal, Páscoa ou data personalizada). Só mostra os contactos atribuídos a ti. Clica num item para abrir a ficha do contacto.',
      },
      {
        heading: 'Sincronização de Contactos (iPhone)',
        body: 'A faixa no topo indica há quanto tempo correu a última sincronização dos contactos do iPhone. Verde = recente; vermelho = há mais de 8 horas.',
      },
    ],
  },
  {
    key: 'leads',
    title: 'Leads',
    icon: '🎯',
    purpose: 'Cada lead é uma oportunidade de negócio: alguém que pode comprar, vender ou investir.',
    blocks: [
      {
        heading: 'Criar e gerir leads',
        body: 'Usa "+ Novo Lead" para criar. Preenche nome, contacto, origem, orçamento, zona e tipologia. Cada lead vive numa etapa do pipeline e pode estar ligada a um contacto, uma organização e um imóvel.',
      },
      {
        heading: 'Ficha da lead',
        body: 'No topo tens as etapas clicáveis (muda a etapa com um clique), o seletor de responsável, o botão Regular, WhatsApp, Email e Arquivar. Abaixo: score, dados de contacto, sugestão de IA, preferências de pesquisa (zonas, tipologia, preço máximo, extras) e o histórico de atividades.',
      },
      {
        heading: 'Lead regular e frequência de follow-up',
        body: 'Ativa o botão "Regular" para receberes lembretes automáticos quando a lead está demasiado tempo sem contacto. Com o Regular ativo aparece o seletor de frequência: escolhe um intervalo (5, 7, 15, 30, 60 ou 90 dias, ou um valor à tua medida) ou deixa "Prazos da agência" para usar os prazos definidos nas configurações da agência (1º e 2º lembrete).',
      },
      {
        heading: 'Preferências e alertas do Idealista',
        body: 'Nas preferências da lead defines zonas, tipologia mínima, preço máximo e extras. O bot do Idealista cruza os alertas de email com estas preferências e envia os imóveis compatíveis por Telegram ao consultor responsável (liga o teu Telegram em Configurações → Equipa).',
      },
      {
        heading: 'Sugestão de IA',
        body: 'Clica em "Analisar lead" para a IA sugerir a próxima ação com base no histórico, com nível de urgência e justificação.',
      },
    ],
  },
  {
    key: 'pipeline',
    title: 'Pipeline',
    icon: '📋',
    purpose: 'Vista Kanban dos teus negócios: arrasta as leads entre etapas à medida que avançam.',
    blocks: [
      {
        heading: 'Como funciona',
        body: 'Cada coluna é uma etapa (ex.: 1º Contacto, Qualificação, Visitas, Proposta, Negociação, Fechado). Arrasta um cartão para outra coluna para mudar a etapa da lead. As etapas configuram-se em Configurações → Pipeline.',
      },
      {
        heading: 'Vários pipelines',
        body: 'A agência pode ter mais do que um pipeline (ex.: Leads, Vendedores, Compradores), cada um com etapas próprias. Muda de pipeline no seletor do topo. Podes criar um pipeline novo (vazio) a partir daí.',
      },
      {
        heading: 'Adicionar contactos ao pipeline',
        body: 'Usa o botão de adicionar contactos para escolher contactos da lista (com pesquisa) e criar leads para eles em massa na primeira etapa. Contactos que já estejam no pipeline são ignorados, sem duplicar.',
      },
    ],
  },
  {
    key: 'people',
    title: 'Contactos',
    icon: '👥',
    purpose: 'A tua base central de pessoas: compradores, vendedores, investidores, consultores de outras agências e serviços.',
    blocks: [
      {
        heading: 'Tipos de contacto',
        body: 'Cada contacto pode ter um ou mais tipos: Comprador, Vendedor, Investidor, Consultor Imobiliário e Serviço. O tipo determina os campos extra da ficha (o que procura, o que vende, agência e zona de atuação, o que faz).',
      },
      {
        heading: 'Criar contacto (manual ou por áudio)',
        body: 'Em "+ Novo Contacto" podes preencher à mão ou gravar um áudio: a IA transcreve e extrai automaticamente nome, telefone, tipos, capacidade financeira, detalhes e notas. O responsável é obrigatório — é ele que recebe os lembretes.',
      },
      {
        heading: 'Contacto regular (follow-ups automáticos)',
        body: 'Na ficha do contacto, ativa "Marcar como regular" para receberes lembretes quando o contacto está demasiado tempo sem interação. Depois escolhe a frequência: um dos atalhos (5, 7, 15, 30, 60, 90 dias), um número de dias à tua escolha no campo "outro", ou "Prazos da agência" (o padrão: 1º e 2º lembrete definidos em Configurações → Agência). Cada cliente pode ter a sua própria cadência.',
      },
      {
        heading: 'Contacto especial (datas importantes)',
        body: 'Ativa "Marcar como especial" para seres avisado em datas importantes desse contacto: Natal, Páscoa (calculada automaticamente todos os anos), aniversário (usa a data de nascimento da ficha) e datas personalizadas que adicionares (ex.: aniversário de casamento ou de escritura — dá um nome, dia e mês). Um contacto pode ser regular e especial ao mesmo tempo.',
      },
      {
        heading: 'Onde recebes os lembretes',
        body: 'As notificações chegam ao sino 🔔 no topo da app e, se tiveres as notificações por email ativas, também por email. Além disso, o bloco "Agenda de hoje" no Dashboard junta tudo o que precisa de atenção hoje.',
      },
      {
        heading: 'Interações',
        body: 'Regista chamadas, visitas, emails, WhatsApp e notas na ficha do contacto (à mão ou por áudio). Cada interação atualiza a "última interação", que é o relógio usado pelos lembretes de follow-up.',
      },
      {
        heading: 'Pipeline a partir do contacto',
        body: 'O botão "+ Pipeline" na ficha cria uma lead ligada ao contacto na primeira etapa. Se o contacto já tem uma lead ativa, vês a etapa atual e podes removê-lo do pipeline (a lead é apagada; o contacto e o histórico ficam).',
      },
      {
        heading: 'Imóveis do vendedor',
        body: 'Nos contactos do tipo Vendedor aparece a secção "Imóveis deste vendedor": associa imóveis do catálogo a este contacto (pesquisa por título ou referência). A associação é a mesma que vês na ficha do imóvel — funciona nos dois sentidos.',
      },
      {
        heading: 'Imóveis do consultor (partilhas)',
        body: 'Nos contactos do tipo Consultor Imobiliário aparece a secção "Imóveis associados": liga o consultor aos imóveis em que há partilha. O mesmo imóvel pode ter vários consultores associados.',
      },
      {
        heading: 'Capacidade financeira e filtros',
        body: 'Classifica os compradores/investidores por capacidade (de "Muito baixo" a "Altíssimo"). Na lista de contactos podes filtrar por tipo, capacidade, origem, só regulares, garagem, varanda, exclusividade e mais.',
      },
    ],
  },
  {
    key: 'organizations',
    title: 'Organizações',
    icon: '🏢',
    purpose: 'Empresas e entidades com quem trabalhas (construtoras, fundos, parceiros).',
    blocks: [
      {
        heading: 'Como usar',
        body: 'Cria uma organização com nome, email, telefone, website e morada. Depois liga leads a organizações na ficha da lead — útil para negócios empresariais em que a pessoa de contacto muda mas a empresa fica.',
      },
    ],
  },
  {
    key: 'properties',
    title: 'Imóveis',
    icon: '🏠',
    purpose: 'O teu catálogo de imóveis: angariações próprias e imóveis em acompanhamento.',
    blocks: [
      {
        heading: 'Criar e editar',
        body: 'Em "+ Novo Imóvel" preenches título, tipo, estado (disponível/reservado/vendido/arrendado), tipologia, preço, área, quartos, localização, condição, descrição, características e fotos (por URL). Tudo é editável na ficha do imóvel.',
      },
      {
        heading: 'Vendedor',
        body: 'Cada imóvel pode ter um vendedor (um contacto). Define-o na ficha do imóvel ou, ao contrário, associa o imóvel a partir da ficha do contacto vendedor — é a mesma ligação vista dos dois lados.',
      },
      {
        heading: 'Partilha / consultores',
        body: 'Associa consultores imobiliários (contactos do tipo Consultor) ao imóvel quando há partilha com outras agências. Pesquisa pelo nome e adiciona; podes ter vários por imóvel. Também aparecem na ficha de cada consultor.',
      },
      {
        heading: 'Compradores sugeridos',
        body: 'A secção "Compradores sugeridos" cruza o imóvel com os teus contactos compradores por capacidade financeira, zona e o que procuram — com atalho direto para WhatsApp.',
      },
      {
        heading: 'Consultores nesta zona',
        body: 'Sugestão automática de consultores de outras agências cuja zona de atuação bate com a zona do imóvel — úteis para propor partilha.',
      },
      {
        heading: 'Visitas e email de fecho',
        body: 'Regista visitas ao imóvel (com contacto ou nome livre, data e notas). Quando o imóvel é vendido, podes enviar um email de fecho aos negócios associados.',
      },
    ],
  },
  {
    key: 'activities',
    title: 'Atividades',
    icon: '📅',
    purpose: 'O teu calendário de trabalho: chamadas, visitas, reuniões, tarefas e notas.',
    blocks: [
      {
        heading: 'Vistas',
        body: 'Alterna entre vista de mês, semana e dia. Usa as setas para navegar no tempo. Podes filtrar por tipo de atividade.',
      },
      {
        heading: 'Criar e concluir',
        body: 'Cria atividades aqui ou diretamente na ficha de uma lead. Marca como concluída com um clique. O painel "Pendentes" mostra o que está por fazer no período em vista.',
      },
      {
        heading: 'Lembretes',
        body: 'As tarefas com data recebem lembrete automático por notificação (sino + email) no próprio dia.',
      },
    ],
  },
  {
    key: 'reports',
    title: 'Relatórios',
    icon: '📈',
    purpose: 'Números do negócio: funil de conversão, origens de leads, desempenho por agente e tempos.',
    blocks: [
      {
        heading: 'Como usar',
        body: 'Escolhe o período no seletor do topo. Vês os KPIs principais, o funil por etapa (quantas leads chegam a cada fase), a distribuição por origem, o desempenho de cada agente e a evolução ao longo do tempo.',
      },
    ],
  },
  {
    key: 'settings-pipeline',
    title: 'Configurações · Pipeline',
    icon: '⚙️',
    purpose: 'Personaliza as etapas do pipeline e os campos das leads.',
    blocks: [
      {
        heading: 'Etapas',
        body: 'Cria, renomeia, ordena e apaga etapas de cada pipeline. Cada etapa tem cor e probabilidade (%) — usada no cálculo do pipeline ponderado. Marca etapas como "ganho" ou "perdido" para o sistema saber quando um negócio fecha.',
      },
      {
        heading: 'Campos personalizados',
        body: 'Adiciona campos extra às leads (texto, número, data, seleção, etc.) que aparecem na ficha de todas as leads.',
      },
    ],
  },
  {
    key: 'automations',
    title: 'Automações',
    icon: '⚡',
    purpose: 'Regras "quando X, então Y" que trabalham por ti.',
    blocks: [
      {
        heading: 'Gatilhos disponíveis',
        body: 'Lead criada, lead muda de etapa, atividade concluída, lead inativa há X dias e WhatsApp recebido.',
      },
      {
        heading: 'Ações disponíveis',
        body: 'Criar atividade, notificar o consultor, mover a lead de etapa, enviar email automático (com template) e enviar WhatsApp automático.',
      },
      {
        heading: 'Exemplo prático',
        body: 'Regra: "Quando uma lead muda para a etapa Proposta, criar atividade de follow-up para daqui a 3 dias". Cria a regra, escolhe o gatilho, a ação e ativa. O registo de execuções mostra o que cada regra fez.',
      },
    ],
  },
  {
    key: 'forms',
    title: 'Formulários',
    icon: '📝',
    purpose: 'Formulários web para captar leads no teu site.',
    blocks: [
      {
        heading: 'Como usar',
        body: 'Cria um formulário, escolhe os campos e publica-o no teu site via iframe (código de incorporação fornecido). Cada submissão cria automaticamente uma lead no ImoFlow com a origem "site".',
      },
    ],
  },
  {
    key: 'templates',
    title: 'Templates',
    icon: '✉️',
    purpose: 'Mensagens reutilizáveis para email e WhatsApp.',
    blocks: [
      {
        heading: 'Variáveis',
        body: 'Escreve o template uma vez com variáveis como {{nome}}, {{agente}} ou {{imovel}} — são substituídas automaticamente pelos dados reais ao enviar. Os templates ficam disponíveis ao enviar email/WhatsApp de uma lead e nas automações.',
      },
    ],
  },
  {
    key: 'agency',
    title: 'Configurações · Agência',
    icon: '🏛️',
    purpose: 'Dados da agência, email e prazos padrão dos lembretes.',
    blocks: [
      {
        heading: 'Email',
        body: 'Define o nome do remetente e o endereço de resposta usados nos emails enviados pela app.',
      },
      {
        heading: 'Lembretes de contactos regulares (prazos padrão)',
        body: 'Define os prazos padrão da agência: 1º lembrete após X dias sem contacto e 2º lembrete (mais forte) após Y dias. Estes prazos aplicam-se a todos os contactos/leads regulares que não tenham frequência própria definida na ficha — se um contacto tiver a sua própria frequência (ex.: a cada 15 dias), é essa que conta.',
      },
    ],
  },
  {
    key: 'team',
    title: 'Configurações · Equipa',
    icon: '👤',
    purpose: 'Gestão dos membros da agência, permissões e ligação ao Telegram.',
    blocks: [
      {
        heading: 'Papéis',
        body: 'Admin vê e gere tudo; Agente vê as suas próprias leads. Muda o papel de cada membro no seletor.',
      },
      {
        heading: 'Ligar Telegram',
        body: 'Cada consultor deve clicar em "Ligar Telegram" (na sua própria conta de Telegram) para receber os avisos automáticos de imóveis do Idealista que fazem match com as suas leads.',
      },
      {
        heading: 'Notificações por email',
        body: 'Cada utilizador pode ativar/desativar o envio das notificações por email nas suas definições. As notificações no sino 🔔 estão sempre ativas.',
      },
    ],
  },
]

export function helpSectionMeta(key: string | null | undefined): HelpSection | undefined {
  return HELP_SECTIONS.find(s => s.key === key)
}

// Manual completo em texto plano — contexto do chat de IA (/api/ai/help).
export function buildHelpManualText(): string {
  return HELP_SECTIONS.map(s => {
    const blocks = s.blocks.map(b => `### ${b.heading}\n${b.body}`).join('\n\n')
    return `## ${s.title}\n${s.purpose}\n\n${blocks}`
  }).join('\n\n---\n\n')
}
