// Todo o texto do "Guia da consulta". Fica separado do layout de propósito: quando
// existir login, este objeto sai do bundle (público) e passa a ser servido pela API.
// O PREÇO não está aqui — vem de useValorConsulta() (src/lib/valorConsulta.ts).

export interface Capitulo { id: string; rotulo: string; titulo: string }
export interface FaixaCalendario { idade: string; frequencia: string }
export interface ItemChecklist { titulo: string; detalhe?: string }

export const guia = {
  titulo: 'Guia da consulta com a Dra. Raquel',
  subtitulo: 'Pediatra e neonatologista',
  abertura:
    'Que bom ter vocês aqui! Meu trabalho é acompanhar a saúde e o desenvolvimento do seu filho ao longo do tempo. Em cada consulta, quero entender como ele está, ouvir o que vocês têm observado em casa e construir juntos um plano de cuidado que faça sentido para a rotina da família.',

  capitulos: [
    { id: 'puericultura', rotulo: 'Puericultura', titulo: 'Como funciona a consulta de puericultura' },
    { id: 'retorno', rotulo: 'Retorno', titulo: 'Quando eu indico um retorno' },
    { id: 'calendario', rotulo: 'Calendário', titulo: 'Calendário de acompanhamento' },
    { id: 'prenatal', rotulo: 'Pré-natal', titulo: 'Consulta pré-natal pediátrica' },
    { id: 'trazer', rotulo: 'O que trazer', titulo: 'O que trazer para a consulta da criança' },
    { id: 'whatsapp', rotulo: 'WhatsApp', titulo: 'WhatsApp entre as consultas' },
    { id: 'valor', rotulo: 'Valor', titulo: 'Valor da consulta' },
  ] satisfies Capitulo[],

  puericultura: [
    'A puericultura é a consulta de acompanhamento da criança. Reservo cerca de uma hora para conversar com vocês, examinar seu filho e avaliar como ele está crescendo e se desenvolvendo. A gente conversa sobre alimentação, sono, vacinas e as dúvidas que surgem em cada fase. Ao final, combinamos os próximos passos e quando será a próxima avaliação.',
    'Cada visita do calendário de puericultura é uma nova consulta. Nela, faço uma avaliação global da saúde e do desenvolvimento da criança, considerando o que mudou desde o último encontro.',
  ],

  retorno: {
    intro:
      'O retorno é uma reavaliação focada no motivo pelo qual eu pedi que vocês voltassem. Por exemplo, se solicitei um exame para esclarecer uma dúvida da consulta, esse encontro é dedicado a revisar o resultado e concluir a orientação sobre aquele assunto.',
    puericultura: {
      rotulo: 'Consulta de puericultura',
      pontos: [
        'Acontece nos intervalos planejados',
        'Volto a olhar para a saúde e o desenvolvimento do seu filho como um todo',
      ],
    },
    retorno: {
      rotulo: 'Retorno',
      pontos: [
        'Eu indico e combino o agendamento com vocês',
        'Focado no motivo pelo qual pedi que voltassem',
        'Em geral, em até 15 dias, conforme o caso',
        'Sem nova cobrança quando dá continuidade à consulta anterior',
      ],
    },
  },

  calendario: {
    intro:
      'Uso as orientações da Sociedade Brasileira de Pediatria (SBP) como referência e ajusto o calendário conforme as necessidades de cada criança.',
    faixas: [
      { idade: 'Primeira consulta do recém-nascido', frequencia: 'Entre 7 e 10 dias de vida' },
      { idade: 'Até os 6 meses', frequencia: 'Mensal' },
      { idade: 'Dos 6 meses a 1 ano', frequencia: 'A cada 2 meses' },
      { idade: 'De 1 ano a 1 ano e meio', frequencia: 'A cada 3 meses' },
      { idade: 'De 1 ano e meio a 5 anos', frequencia: 'A cada 6 meses' },
      { idade: 'Dos 5 aos 18 anos', frequencia: 'Anual' },
    ] satisfies FaixaCalendario[],
    prematuro: {
      rotulo: 'Bebê prematuro',
      texto:
        'No acompanhamento do bebê prematuro, planejamos a primeira consulta para os primeiros dias após a alta, conforme a orientação da equipe. Depois, as consultas são mensais até os 6 meses de idade corrigida. A partir daí, combinamos os intervalos de acordo com o crescimento, o desenvolvimento e as necessidades do bebê.',
    },
  },

  prenatal: {
    semana: '28ª',
    legendaSemana: 'semana de gestação',
    texto:
      'A partir da 28ª semana de gestação, podemos nos encontrar para conversar sobre a chegada do bebê. É um momento para tirar dúvidas sobre amamentação, cuidados nos primeiros dias de vida e triagens do recém-nascido.',
    trazer: 'Para essa consulta, tragam a caderneta da gestante e os exames do pré-natal.',
  },

  trazer: {
    itens: [
      { titulo: 'Caderneta da Criança', detalhe: 'com o registro das vacinas' },
      { titulo: 'Exames e relatórios recentes' },
      { titulo: 'Lista de medicamentos e suplementos em uso' },
      { titulo: 'Resumo da maternidade ou da internação', detalhe: 'na primeira consulta após a alta' },
      { titulo: 'Dúvidas anotadas', detalhe: 'se quiserem, anotem o que surgir em casa, para conversarmos com calma' },
    ] satisfies ItemChecklist[],
  },

  whatsapp: {
    texto:
      'O WhatsApp é uma cortesia para as famílias em acompanhamento regular. É um espaço para esclarecer dúvidas pontuais sobre as orientações combinadas em consulta.',
    horarios: [
      { quando: 'Dias úteis', como: 'Leio as mensagens no fim da tarde' },
      { quando: 'Fim de semana', como: 'Respondo na segunda-feira' },
    ],
    urgencia: 'Em caso de urgência, procurem um pronto atendimento.',
  },

  valor: { rotulo: 'O valor de cada consulta é' },

  assinatura: { nome: 'Dra. Raquel Machado', titulo: 'Pediatra e neonatologista' },
}
