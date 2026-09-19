/**
 * Serviço de Regras e Motor de Dados RPG (Dice Pool D6 & Rolagens Livres)
 * RetroForge VTT / Arcana RPG
 */

// Tabela oficial de dificuldades do sistema
export const DIFFICULTY_TABLE = {
  2: { parcial: 1, descricao: 'Extremamente fácil' },
  4: { parcial: 2, descricao: 'Qualquer pessoa deve conseguir realizar o feito' },
  6: { parcial: 3, descricao: 'Qualquer pessoa em situações normais pode realizar essa ação' },
  8: { parcial: 4, descricao: 'Uma pessoa com treinamento básico deve conseguir realizar este feito' },
  10: { parcial: 5, descricao: 'Uma pessoa com um treinamento decente deve conseguir realizar este feito' },
  12: { parcial: 6, descricao: 'Uma pessoa extremamente bem treinada deve conseguir realizar este feito' },
  14: { parcial: 7, descricao: 'Uma pessoa genial, que extrapolou os limites comuns em uma área deve conseguir' },
  16: { parcial: 8, descricao: 'Apenas a melhor pessoa no mundo nesta área conseguiria realizar este feito' },
  18: { parcial: 9, descricao: 'Está totalmente fora do alcance das pessoas comuns, mesmo que sejam treinadas ao extremo.' },
  20: { parcial: 10, descricao: 'Um feito lendário' },
  22: { parcial: 12, descricao: 'Algo que quebra o padrão da realidade pré estabelecida' }
};

export const VALID_ATTRIBUTES = ['corpo', 'mente', 'social', 'espirito'];

/**
 * Gera números inteiros aleatórios de 1 a N de forma criptograficamente segura
 */
export function rollSingleDie(sides = 6) {
  const maxValid = Math.floor(0xFFFFFFFF / sides) * sides;
  const uint32 = new Uint32Array(1);
  
  let val;
  do {
    globalThis.crypto.getRandomValues(uint32);
    val = uint32[0];
  } while (val >= maxValid);

  return (val % sides) + 1;
}

/**
 * Rola uma quantidade de dados de 6 lados (D6)
 */
export function rollD6(count = 1) {
  const clamped = Math.max(1, Math.min(100, Math.floor(Number(count) || 1)));
  const results = [];
  for (let i = 0; i < clamped; i++) {
    results.push(rollSingleDie(6));
  }
  return results;
}

/**
 * Calcula o limiar de sucesso parcial para uma dada dificuldade
 */
export function getPartialSuccessThreshold(dificuldade) {
  const dif = Math.max(1, Math.floor(Number(dificuldade) || 1));
  if (DIFFICULTY_TABLE[dif]) {
    return DIFFICULTY_TABLE[dif].parcial;
  }
  return Math.ceil(dif / 2);
}

/**
 * Processa e avalia um teste de Dice Pool D6 do sistema
 */
export function evaluateD6Pool({
  dadosCount = 1,
  dificuldade = null,
  atributo = null,
  especializacao = null,
  vantagens = 0,
  ajudas = 0,
  customRolls = null
}) {
  const qtdDados = Math.max(1, Math.min(100, Math.floor(Number(dadosCount) || 1)));
  const rolls = Array.isArray(customRolls) && customRolls.length > 0 
    ? customRolls.slice(0, 100) 
    : rollD6(qtdDados);

  const sucessos = [];
  const falhas = [];

  for (const dado of rolls) {
    if (dado >= 4) {
      sucessos.push(dado);
    } else {
      falhas.push(dado);
    }
  }

  const totalSucessos = sucessos.length;
  const somaSucessos = sucessos.reduce((acc, val) => acc + val, 0);

  let veredicto = null;
  let thresholdParcial = null;
  let descricaoDificuldade = null;

  if (dificuldade !== null && dificuldade !== undefined && dificuldade !== '') {
    const numDificuldade = Math.max(1, Math.floor(Number(dificuldade)));
    thresholdParcial = getPartialSuccessThreshold(numDificuldade);
    descricaoDificuldade = DIFFICULTY_TABLE[numDificuldade]?.descricao || null;

    if (totalSucessos >= numDificuldade) {
      veredicto = 'SUCESSO_TOTAL';
    } else if (totalSucessos >= thresholdParcial) {
      veredicto = 'SUCESSO_PARCIAL';
    } else {
      veredicto = 'FALHA_TOTAL';
    }
  }

  return {
    tipo: 'pool_d6',
    dadosCount: rolls.length,
    atributo: atributo ? String(atributo).toLowerCase() : null,
    especializacao: especializacao ? String(especializacao).trim() : null,
    vantagens: Math.max(0, Math.floor(Number(vantagens) || 0)),
    ajudas: Math.max(0, Math.floor(Number(ajudas) || 0)),
    dados: rolls,
    sucessos,
    falhas,
    totalSucessos,
    somaSucessos,
    dificuldade: dificuldade ? Math.max(1, Math.floor(Number(dificuldade))) : null,
    thresholdParcial,
    descricaoDificuldade,
    veredicto,
    timestamp: new Date().toISOString()
  };
}

/**
 * Resolve um teste resistido entre duas rolagens
 */
export function resolveOpposedRoll(rollA, rollB, nomeA = 'Personagem A', nomeB = 'Personagem B') {
  if (!rollA || !rollB) {
    throw new Error('Duas rolagens válidas são necessárias para o teste resistido');
  }

  const sucessosA = rollA.totalSucessos;
  const sucessosB = rollB.totalSucessos;
  const somaA = rollA.somaSucessos;
  const somaB = rollB.somaSucessos;

  let vencedor = null;
  let motivo = null;
  let resultadoFinal = null;

  if (sucessosA > sucessosB) {
    vencedor = 'A';
    motivo = 'maior_quantidade_sucessos';
    resultadoFinal = `Vitória de ${nomeA} (${sucessosA} vs ${sucessosB} sucessos)`;
  } else if (sucessosB > sucessosA) {
    vencedor = 'B';
    motivo = 'maior_quantidade_sucessos';
    resultadoFinal = `Vitória de ${nomeB} (${sucessosB} vs ${sucessosA} sucessos)`;
  } else {
    // Empate em quantidade de sucessos -> Critério de desempate: soma dos dados de sucesso
    if (somaA > somaB) {
      vencedor = 'A';
      motivo = 'desempate_soma_sucessos';
      resultadoFinal = `Vitória de ${nomeA} no desempate por soma dos sucessos (${somaA} vs ${somaB})`;
    } else if (somaB > somaA) {
      vencedor = 'B';
      motivo = 'desempate_soma_sucessos';
      resultadoFinal = `Vitória de ${nomeB} no desempate por soma dos sucessos (${somaB} vs ${somaA})`;
    } else {
      // Empate absoluto
      vencedor = 'EMPATE';
      motivo = 'empate_absoluto';
      resultadoFinal = 'Empate absoluto — Sucesso Parcial mútuo';
    }
  }

  return {
    tipo: 'teste_resistido',
    ladoA: { nome: nomeA, roll: rollA },
    ladoB: { nome: nomeB, roll: rollB },
    vencedor,
    motivo,
    resultadoFinal,
    timestamp: new Date().toISOString()
  };
}

/**
 * Processa expressões de rolagem livre (ex: "2d6+3", "1d20-1", "3d6")
 */
export function parseAndRollFreeExpression(expression) {
  if (typeof expression !== 'string' || !expression.trim()) {
    throw new Error('Expressão de rolagem inválida');
  }

  const cleanExp = expression.trim().toLowerCase().replace(/\s+/g, '');
  const regex = /^(\d*)d(\d+)(?:([+-])(\d+))?$/;
  const match = cleanExp.match(regex);

  if (!match) {
    throw new Error(`Formato de rolagem inválido: "${expression}". Use formatos como "2d6", "1d20+3", "3d6-1".`);
  }

  const countRaw = match[1];
  const sidesRaw = match[2];
  const sign = match[3];
  const modRaw = match[4];

  const count = countRaw === '' ? 1 : parseInt(countRaw, 10);
  const sides = parseInt(sidesRaw, 10);
  const modValue = modRaw ? parseInt(modRaw, 10) : 0;
  const modifier = sign === '-' ? -modValue : modValue;

  if (count < 1 || count > 100) {
    throw new Error('A quantidade de dados deve ser entre 1 e 100');
  }

  if (sides < 2 || sides > 1000) {
    throw new Error('O número de lados do dado deve ser entre 2 e 1000');
  }

  if (Math.abs(modifier) > 10000) {
    throw new Error('O modificador deve ser entre -10000 e 10000');
  }

  const rolls = [];
  for (let i = 0; i < count; i++) {
    rolls.push(rollSingleDie(sides));
  }

  const somaDados = rolls.reduce((acc, val) => acc + val, 0);
  const total = somaDados + modifier;

  return {
    tipo: 'rolagem_livre',
    expressaoOriginal: expression.trim(),
    quantidadeDados: count,
    lados: sides,
    modificador: modifier,
    dados: rolls,
    somaDados,
    total,
    timestamp: new Date().toISOString()
  };
}

/**
 * Parser inteligente de comandos do chat (/roll ou /r)
 */
export function parseChatRollCommand(text, characterSheet = null) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed.startsWith('/roll') && !trimmed.startsWith('/r ') && trimmed !== '/r') {
    return null;
  }

  const rawArgs = trimmed.startsWith('/roll') 
    ? trimmed.substring(5).trim() 
    : trimmed.substring(2).trim();

  if (!rawArgs) {
    // Default /roll sem argumentos -> 1d6
    return parseAndRollFreeExpression('1d6');
  }

  // Verifica se é uma expressão livre como 2d6+3 ou 1d20
  if (/^(\d*)d(\d+)(?:[+-]\d+)?$/i.test(rawArgs.replace(/\s+/g, ''))) {
    return parseAndRollFreeExpression(rawArgs);
  }

  // Se não for rolagem livre simples, analisa como comando do sistema D6
  const tokens = rawArgs.split(/\s+/);
  let atributo = null;
  let especializacao = null;
  let vantagens = 0;
  let ajudas = 0;
  let dificuldade = null;
  let dadosCountManual = null;

  for (const token of tokens) {
    const lower = token.toLowerCase();

    // Atributos reconhecidos
    if (VALID_ATTRIBUTES.includes(lower)) {
      atributo = lower;
      continue;
    }

    // Prefixo de especialização (ex: esp:investigacao ou pericia:historia)
    if (lower.startsWith('esp:') || lower.startsWith('pericia:')) {
      const idx = token.indexOf(':');
      especializacao = token.substring(idx + 1).replace(/_/g, ' ');
      continue;
    }

    // Prefixo de vantagens (ex: vant:1 ou v:2)
    if (lower.startsWith('vant:') || lower.startsWith('v:')) {
      const idx = token.indexOf(':');
      vantagens = parseInt(token.substring(idx + 1), 10) || 0;
      continue;
    }

    // Prefixo de ajuda de aliado (ex: ajuda:1 ou a:1)
    if (lower.startsWith('ajuda:') || lower.startsWith('a:')) {
      const idx = token.indexOf(':');
      ajudas = parseInt(token.substring(idx + 1), 10) || 0;
      continue;
    }

    // Prefixo de dificuldade (ex: dif:6 ou d:6)
    if (lower.startsWith('dif:') || lower.startsWith('dificuldade:')) {
      const idx = token.indexOf(':');
      dificuldade = parseInt(token.substring(idx + 1), 10) || null;
      continue;
    }

    // Quantidade pura de dados de pool (ex: 4d ou 4d6)
    const dMatch = lower.match(/^(\d+)d(?:6)?$/);
    if (dMatch) {
      dadosCountManual = parseInt(dMatch[1], 10);
      continue;
    }
  }

  // Cálculo da quantidade de dados
  let totalDados = 0;

  if (atributo && characterSheet?.atributos && typeof characterSheet.atributos[atributo] === 'number') {
    totalDados += characterSheet.atributos[atributo];
  } else if (dadosCountManual) {
    totalDados += dadosCountManual;
  } else if (atributo) {
    // Se o atributo foi passado mas não há ficha (ex: teste rápido), assume base padrão 1 ou busca valor
    totalDados += 1;
  } else {
    totalDados += 1;
  }

  // Se passou especialização, adiciona +1D6
  if (especializacao) {
    totalDados += 1;
  }

  // Vantagens e ajudas
  totalDados += Math.max(0, vantagens);
  totalDados += Math.max(0, ajudas);

  return evaluateD6Pool({
    dadosCount: totalDados,
    dificuldade,
    atributo,
    especializacao,
    vantagens,
    ajudas
  });
}

// ==========================================
// ANIMA & RECURSOS DO PERSONAGEM (ALPHAD6)
// ==========================================

/**
 * Calcula a Anima inicial do personagem: 2d6 + soma dos 4 atributos
 */
export function calculateInitialAnima({ atributos = {}, customRoll = null }) {
  const corpo = Math.max(1, Math.floor(Number(atributos.corpo) || 1));
  const mente = Math.max(1, Math.floor(Number(atributos.mente) || 1));
  const social = Math.max(1, Math.floor(Number(atributos.social) || 1));
  const espirito = Math.max(1, Math.floor(Number(atributos.espirito) || 1));
  const somaAtributos = corpo + mente + social + espirito;

  const dados = Array.isArray(customRoll) && customRoll.length === 2 
    ? customRoll 
    : [rollSingleDie(6), rollSingleDie(6)];
  
  const somaDados = dados[0] + dados[1];
  const maxAnima = somaDados + somaAtributos;

  return {
    dados,
    somaDados,
    somaAtributos,
    maxAnima,
    currentAnima: maxAnima,
    passagemParaOVazio: false
  };
}

/**
 * Recalcula a Anima máxima com atributos atualizados e o bônus de rolagem original
 */
export function calculateMaxAnima({ atributos = {}, bonusRolagem = 7 }) {
  const corpo = Math.max(1, Math.floor(Number(atributos.corpo) || 1));
  const mente = Math.max(1, Math.floor(Number(atributos.mente) || 1));
  const social = Math.max(1, Math.floor(Number(atributos.social) || 1));
  const espirito = Math.max(1, Math.floor(Number(atributos.espirito) || 1));
  return (corpo + mente + social + espirito) + Math.max(2, Math.floor(Number(bonusRolagem) || 7));
}

/**
 * Aplica dano ou gasto de Anima ao personagem
 */
export function applyAnimaDamage({ currentAnima = 0, dano = 0 }) {
  const danoNum = Math.max(0, Math.floor(Number(dano) || 0));
  const anterior = Math.max(0, Math.floor(Number(currentAnima) || 0));
  const novaAnima = Math.max(0, anterior - danoNum);
  const passagemParaOVazio = novaAnima === 0;

  return {
    animaAnterior: anterior,
    danoRecebido: danoNum,
    animaAtual: novaAnima,
    passagemParaOVazio,
    descricao: passagemParaOVazio ? 'O personagem chegou a 0 de Anima e realizou a Passagem para o Vazio!' : `Sofreu ${danoNum} de dano/gasto de Anima.`
  };
}

// ==========================================
// MOTOR DE DESCANSOS (REST SYSTEM)
// ==========================================

export const REST_CONFIG = {
  curto: { dadosCount: 3, lados: 4, horas: 2, nome: 'Descanso Curto' },
  longo: { dadosCount: 3, lados: 6, horas: 6, nome: 'Descanso Longo' },
  completo: { dadosCount: 3, lados: 8, horas: 8, nome: 'Descanso Completo' }
};

/**
 * Aplica um descanso ao personagem
 */
export function applyRest({ tipo = 'curto', currentAnima = 0, maxAnima = 20, customRoll = null }) {
  const cleanTipo = String(tipo).toLowerCase().trim();
  const config = REST_CONFIG[cleanTipo] || REST_CONFIG.curto;

  const dados = Array.isArray(customRoll) && customRoll.length === config.dadosCount
    ? customRoll
    : [];
  
  if (dados.length === 0) {
    for (let i = 0; i < config.dadosCount; i++) {
      dados.push(rollSingleDie(config.lados));
    }
  }

  const somaDados = dados.reduce((acc, v) => acc + v, 0);
  const anterior = Math.max(0, Math.floor(Number(currentAnima) || 0));
  const teto = Math.max(1, Math.floor(Number(maxAnima) || 20));
  const novaAnima = Math.min(teto, anterior + somaDados);
  const efetivamenteCurado = novaAnima - anterior;

  return {
    tipo: cleanTipo,
    nomeDescanso: config.nome,
    dados,
    somaDados,
    duracaoHoras: config.horas,
    animaAnterior: anterior,
    animaAtual: novaAnima,
    maxAnima: teto,
    efetivamenteCurado,
    timestamp: new Date().toISOString()
  };
}

// ==========================================
// MOTOR DE RESTAURAÇÕES (MEDICINA & CURA)
// ==========================================

export const RESTORATION_CONFIG = {
  emergencia: { custoItens: 1, curaFixa: 6, curaTotal: false, horas: 0, nome: 'Restauração de Emergência' },
  cuidadosa: { custoItens: 2, curaFixa: 12, curaTotal: false, horas: 0, nome: 'Restauração Cuidadosa' },
  completa: { custoItens: 3, curaFixa: null, curaTotal: true, horas: 24, nome: 'Restauração Completa' }
};

/**
 * Aplica uma restauração ao personagem consumindo itens de cura
 */
export function applyRestoration({ tipo = 'emergencia', currentAnima = 0, maxAnima = 20, itensCuraDisponiveis = 3 }) {
  const cleanTipo = String(tipo).toLowerCase().trim();
  const config = RESTORATION_CONFIG[cleanTipo] || RESTORATION_CONFIG.emergencia;

  const itensAtuais = Math.max(0, Math.floor(Number(itensCuraDisponiveis) || 0));
  if (itensAtuais < config.custoItens) {
    throw new Error(`Itens de cura insuficientes. Necessário: ${config.custoItens}, disponível: ${itensAtuais}.`);
  }

  const anterior = Math.max(0, Math.floor(Number(currentAnima) || 0));
  const teto = Math.max(1, Math.floor(Number(maxAnima) || 20));
  
  let novaAnima;
  if (config.curaTotal) {
    novaAnima = teto;
  } else {
    novaAnima = Math.min(teto, anterior + config.curaFixa);
  }

  const efetivamenteCurado = novaAnima - anterior;
  const itensRestantes = itensAtuais - config.custoItens;

  return {
    tipo: cleanTipo,
    nomeRestauracao: config.nome,
    custoItens: config.custoItens,
    itensRestantes,
    duracaoHoras: config.horas,
    animaAnterior: anterior,
    animaAtual: novaAnima,
    maxAnima: teto,
    efetivamenteCurado,
    timestamp: new Date().toISOString()
  };
}

// ==========================================
// RELÓGIO E CALENDÁRIO DA CAMPANHA (EVENT-DRIVEN / OTIMIZADO)
// ==========================================

export function createDefaultWorldClock() {
  return {
    ano: 1,
    mes: 1,
    dia: 1,
    hora: 8,
    minuto: 0,
    periodo: 'Manhã',
    formatado: 'Ano 1, Mês 1, Dia 1 - 08:00 (Manhã)'
  };
}

export function getPeriodOfDay(hora) {
  const h = (hora % 24 + 24) % 24;
  if (h >= 0 && h < 6) return 'Madrugada';
  if (h >= 6 && h < 12) return 'Manhã';
  if (h >= 12 && h < 18) return 'Tarde';
  return 'Noite';
}

/**
 * Avança o relógio da campanha de forma discreta / baseada em eventos
 */
export function advanceWorldClock(currentClock = null, { minutes = 0, hours = 0, days = 0 } = {}) {
  const clock = currentClock ? { ...currentClock } : createDefaultWorldClock();

  let ano = Math.max(1, Math.floor(Number(clock.ano) || 1));
  let mes = Math.max(1, Math.floor(Number(clock.mes) || 1));
  let dia = Math.max(1, Math.floor(Number(clock.dia) || 1));
  let hora = Math.max(0, Math.floor(Number(clock.hora) || 0));
  let minuto = Math.max(0, Math.floor(Number(clock.minuto) || 0));

  const addMinutos = Math.max(0, Math.floor(Number(minutes) || 0));
  const addHoras = Math.max(0, Math.floor(Number(hours) || 0));
  const addDias = Math.max(0, Math.floor(Number(days) || 0));

  // Acumula minutos totais adicionados
  let totalM = minuto + addMinutos + (addHoras * 60) + (addDias * 1440);

  minuto = totalM % 60;
  let totalHoras = Math.floor(totalM / 60) + hora;
  hora = totalHoras % 24;
  let totalDias = Math.floor(totalHoras / 24) + (dia - 1);

  dia = (totalDias % 30) + 1;
  let totalMeses = Math.floor(totalDias / 30) + (mes - 1);
  mes = (totalMeses % 12) + 1;
  ano += Math.floor(totalMeses / 12);

  const periodo = getPeriodOfDay(hora);
  const horaStr = String(hora).padStart(2, '0');
  const minStr = String(minuto).padStart(2, '0');
  const formatado = `Ano ${ano}, Mês ${mes}, Dia ${dia} - ${horaStr}:${minStr} (${periodo})`;

  return {
    ano,
    mes,
    dia,
    hora,
    minuto,
    periodo,
    formatado
  };
}

/**
 * Avalia gatilhos de tempo automáticos configurados pelo mestre
 */
export function evaluateClockTrigger({ clock, triggers = {}, messagesCount = 0 }) {
  if (!triggers || !triggers.messages_threshold || triggers.messages_threshold <= 0) {
    return { triggered: false, clock: clock || createDefaultWorldClock() };
  }

  if (messagesCount > 0 && messagesCount % triggers.messages_threshold === 0) {
    const minutesToAdvance = triggers.minutes_per_threshold || 5;
    const newClock = advanceWorldClock(clock, { minutes: minutesToAdvance });
    return {
      triggered: true,
      clock: newClock,
      minutesAdvanced: minutesToAdvance
    };
  }

  return { triggered: false, clock: clock || createDefaultWorldClock() };
}

// ==========================================
// ARQUÉTIPO & SISTEMA DOS 3 CONTATOS (NPCs)
// ==========================================

export function validateArchetypeAndContacts({ arquetipo = '', contatos = [] } = {}) {
  const cleanArquetipo = typeof arquetipo === 'string' ? arquetipo.trim().substring(0, 100) : '';
  const rawList = Array.isArray(contatos) ? contatos.slice(0, 3) : [];

  const cleanContatos = rawList.map((c, idx) => ({
    id: c.id || `npc_contato_${idx + 1}`,
    nome: typeof c.nome === 'string' ? c.nome.trim().substring(0, 60) : `Contato ${idx + 1}`,
    vinculo: ['amizade', 'divida', 'favor', 'antigo_aliado'].includes(c.vinculo) ? c.vinculo : 'amizade',
    ocupacao: typeof c.ocupacao === 'string' ? c.ocupacao.trim().substring(0, 60) : '',
    detalhes: typeof c.detalhes === 'string' ? c.detalhes.trim().substring(0, 300) : ''
  }));

  return {
    arquetipo: cleanArquetipo,
    contatos: cleanContatos
  };
}

// ==========================================
// RIQUEZA & INVENTÁRIO (ALPHAD6)
// ==========================================

// ==========================================
// RIQUEZA, MOEDA (PRATAS) & INVENTÁRIO (ALPHAD6)
// ==========================================

export const WEALTH_TIERS = {
  milionario: {
    id: 'milionario',
    label: 'Milionário',
    nivel: 5,
    min: 10,
    max: 99,
    dinheiroPrata: 12500,
    patrimonio: 'Casas de luxo, Veículos de luxo, Equipamentos variados, Terrenos, Empresas, etc.',
    descricao: 'Uma pessoa com renda estável muito maior que todos, a maior classe na escala monetária, provavelmente dono de várias empresas e com incontáveis coisas compondo seu patrimônio.'
  },
  rico: {
    id: 'rico',
    label: 'Rico',
    nivel: 4,
    min: 8,
    max: 9,
    dinheiroPrata: 8500,
    patrimonio: 'Casas, Veículos, Terrenos, etc.',
    descricao: 'Uma pessoa com renda mensal significativamente maior que a média, com liberdade financeira e muitos bens compondo seu patrimônio.'
  },
  abastado: {
    id: 'abastado',
    label: 'Abastado',
    nivel: 3,
    min: 6,
    max: 7,
    dinheiroPrata: 5500,
    patrimonio: 'Casa, Veículos, Equipamentos variados.',
    descricao: 'Uma pessoa com uma fonte de renda estável, possuindo uma casa própria ou talvez até mesmo um apartamento espaçoso, um veículo e com certa liberdade financeira.'
  },
  pobre: {
    id: 'pobre',
    label: 'Pobre',
    nivel: 2,
    min: 4,
    max: 5,
    dinheiroPrata: 2500,
    patrimonio: 'Alguns utensílios domésticos e parte de uma casa, provavelmente um quarto próprio.',
    descricao: 'Uma pessoa com renda mensal baixa, comumente morando junto com outras pessoas desta classe social que se ajudam a manter o local alugado, nada mais que a escala monetária mínima para sobreviver.'
  },
  miseravel: {
    id: 'miseravel',
    label: 'Miserável',
    nivel: 1,
    min: 2,
    max: 3,
    dinheiroPrata: 1200,
    patrimonio: 'Nenhum.',
    descricao: 'Uma pessoa que não possui patrimônio algum, muitas vezes se abrigando em estruturas sem uso para não ficar exposto à chuva e vento. A classe social mais baixa na escala monetária.'
  }
};

export function getWealthTier({ mente = 1, social = 1 }) {
  const menteVal = Math.max(1, Math.floor(Number(mente) || 1));
  const socialVal = Math.max(1, Math.floor(Number(social) || 1));
  const soma = menteVal + socialVal;

  let chosenTier = WEALTH_TIERS.miseravel;
  if (soma >= 10) {
    chosenTier = WEALTH_TIERS.milionario;
  } else if (soma >= 8) {
    chosenTier = WEALTH_TIERS.rico;
  } else if (soma >= 6) {
    chosenTier = WEALTH_TIERS.abastado;
  } else if (soma >= 4) {
    chosenTier = WEALTH_TIERS.pobre;
  } else {
    chosenTier = WEALTH_TIERS.miseravel;
  }

  return {
    id: chosenTier.id,
    label: chosenTier.label,
    nivel: chosenTier.nivel,
    somaMenteSocial: soma,
    dinheiroPrata: chosenTier.dinheiroPrata,
    dinheiroPrataInicial: chosenTier.dinheiroPrata,
    dinheiroPrataAtual: chosenTier.dinheiroPrata,
    patrimonio: chosenTier.patrimonio,
    descricao: chosenTier.descricao
  };
}

export function calculateMaxInventorySlots({ corpo = 1, customRoll = null }) {
  const corpoVal = Math.max(1, Math.floor(Number(corpo) || 1));
  const dados = Array.isArray(customRoll) && customRoll.length === 2 
    ? customRoll 
    : [rollSingleDie(6), rollSingleDie(6)];
  
  const somaDados = dados[0] + dados[1];
  const maxSlots = somaDados + corpoVal;

  return {
    dados,
    somaDados,
    corpo: corpoVal,
    maxSlots
  };
}

// ==========================================
// COMPÊNDIO CANÔNICO DE ITENS & EQUIPAMENTOS
// ==========================================

export const WEAPONS_CATALOG = {
  // Armas Simples (Corpo)
  arma_cortante_pequena: { id: 'arma_cortante_pequena', nome: 'Arma Cortante Pequena (Adaga/Faca)', dano: '1d4+1', custo: 30, riquezaMinima: 'miseravel', atributo: 'corpo', slotsCarga: 1, slot: 'mao_primaria', categoria: 'Arma Branca', tracos: ['Leve'] },
  arma_cortante_grande: { id: 'arma_cortante_grande', nome: 'Arma Cortante Grande (Espada Longa/Machado)', dano: '1d6+2', custo: 150, riquezaMinima: 'abastado', atributo: 'corpo', slotsCarga: 2, slot: 'mao_primaria', categoria: 'Arma Branca', tracos: ['Especializada'] },
  arma_impactante_pequena: { id: 'arma_impactante_pequena', nome: 'Arma Impactante Pequena (Porrete/Clava)', dano: '1d6+2', custo: 20, riquezaMinima: 'miseravel', atributo: 'corpo', slotsCarga: 1, slot: 'mao_primaria', categoria: 'Arma Branca', tracos: [] },
  arma_impactante_grande: { id: 'arma_impactante_grande', nome: 'Arma Impactante Grande (Marreta/Martelo de Guerra)', dano: '1d8+3', custo: 200, riquezaMinima: 'abastado', atributo: 'corpo', slotsCarga: 2, slot: 'mao_primaria', categoria: 'Arma Branca', tracos: ['Especializada', 'Pesada'] },
  arma_perfurante_pequena: { id: 'arma_perfurante_pequena', nome: 'Arma Perfurante Pequena (Estilete/Florete Leve)', dano: '1d4+3', custo: 40, riquezaMinima: 'miseravel', atributo: 'corpo', slotsCarga: 1, slot: 'mao_primaria', categoria: 'Arma Branca', tracos: ['Perfuração'] },
  arma_perfurante_grande: { id: 'arma_perfurante_grande', nome: 'Arma Perfurante Grande (Lança/Pique)', dano: '1d6+4', custo: 180, riquezaMinima: 'abastado', atributo: 'corpo', slotsCarga: 2, slot: 'mao_primaria', categoria: 'Arma Branca', tracos: ['Especializada', 'Alcance'] },
  arma_de_haste: { id: 'arma_de_haste', nome: 'Arma de Haste (Alabarda/Glaive)', dano: '1d10+2', custo: 350, riquezaMinima: 'rico', atributo: 'corpo', slotsCarga: 2, slot: 'mao_primaria', categoria: 'Arma Branca', tracos: ['Especializada', 'Longa', 'Duas Mãos'] },
  chicote: { id: 'chicote', nome: 'Chicote de Couro Rúnico', dano: '1d8+2', custo: 80, riquezaMinima: 'pobre', atributo: 'mente', slotsCarga: 1, slot: 'mao_primaria', categoria: 'Arma Especial', tracos: ['Especializada', 'Longa', 'Laço'] },
  arma_de_arremesso: { id: 'arma_de_arremesso', nome: 'Adagas de Arremesso (Conjunto com 3)', dano: '1d4', custo: 30, riquezaMinima: 'miseravel', atributo: 'mente', slotsCarga: 1, slot: 'mao_primaria', categoria: 'Arremesso', tracos: ['Munição (3)'] },
  arco_e_flecha: { id: 'arco_e_flecha', nome: 'Arco e Flecha Caçador', dano: '1d6+3', custo: 100, riquezaMinima: 'pobre', atributo: 'mente', slotsCarga: 2, slot: 'mao_primaria', categoria: 'Disparo', tracos: ['Especializada', 'Munição (12)', 'Recarregável'] },
  arremessador: { id: 'arremessador', nome: 'Funda / Arremessador de Projéteis', dano: '1d4+2', custo: 15, riquezaMinima: 'miseravel', atributo: 'mente', slotsCarga: 1, slot: 'mao_primaria', categoria: 'Disparo', tracos: ['Recarregável'] },

  // Armas de Fogo (Todas usam Mente)
  fogo_pequena_fraca: { id: 'fogo_pequena_fraca', nome: 'Pistola Leve Calibre Curto', dano: '2d4', custo: 120, riquezaMinima: 'pobre', atributo: 'mente', slotsCarga: 1, slot: 'mao_primaria', categoria: 'Arma de Fogo', tracos: ['Especializada', 'Recarregável', 'Munição (6)'] },
  fogo_pequena_forte: { id: 'fogo_pequena_forte', nome: 'Revólver Pesado / Magnum', dano: '2d6+3', custo: 220, riquezaMinima: 'abastado', atributo: 'mente', slotsCarga: 1, slot: 'mao_primaria', categoria: 'Arma de Fogo', tracos: ['Especializada', 'Recarregável', 'Munição (8)'] },
  fogo_media_fraca: { id: 'fogo_media_fraca', nome: 'Carabina de Repetição Leve', dano: '2d8+2', custo: 280, riquezaMinima: 'abastado', atributo: 'mente', slotsCarga: 2, slot: 'mao_primaria', categoria: 'Arma de Fogo', tracos: ['Especializada', 'Recarregável', 'Munição (12)'] },
  fogo_media_forte: { id: 'fogo_media_forte', nome: 'Espingarda de Cano Duplo', dano: '2d8+4', custo: 380, riquezaMinima: 'abastado', atributo: 'mente', slotsCarga: 2, slot: 'mao_primaria', categoria: 'Arma de Fogo', tracos: ['Especializada', 'Recarregável', 'Munição (14)', 'Impacto'] },
  fogo_grande_fraca: { id: 'fogo_grande_fraca', nome: 'Rifle de Longo Alcance', dano: '2d10+4', custo: 480, riquezaMinima: 'abastado', atributo: 'mente', slotsCarga: 2, slot: 'mao_primaria', categoria: 'Arma de Fogo', tracos: ['Especializada', 'Recarregável', 'Munição (16)', 'Longo Alcance'] },
  fogo_grande_forte: { id: 'fogo_grande_forte', nome: 'Rifle de Precisão de Elite', dano: '2d10+6', custo: 650, riquezaMinima: 'rico', atributo: 'mente', slotsCarga: 2, slot: 'mao_primaria', categoria: 'Arma de Fogo', tracos: ['Especializada', 'Recarregável', 'Munição (18)', 'Perfurante'] },
  fogo_especial_fraca: { id: 'fogo_especial_fraca', nome: 'Armamento Pesado Automático', dano: '2d12+6', custo: 850, riquezaMinima: 'rico', atributo: 'mente', slotsCarga: 3, slot: 'mao_primaria', categoria: 'Arma de Fogo', tracos: ['Especializada', 'Recarregável', 'Munição (20)', 'Rajada'] },
  fogo_especial_forte: { id: 'fogo_especial_forte', nome: 'Canhão Portátil Rúnico', dano: '2d12+8', custo: 1200, riquezaMinima: 'milionario', atributo: 'mente', slotsCarga: 3, slot: 'mao_primaria', categoria: 'Arma de Fogo', tracos: ['Especializada', 'Recarregável', 'Munição (22)', 'Devastador'] }
};

export const DEFENSES_CATALOG = {
  roupas_comuns: { id: 'roupas_comuns', nome: 'Roupas Comuns de Tecido', bonusDefesa: 0, slotsCarga: 0, slot: 'tronco', categoria: 'Escudos & Armaduras', custo: 20, riquezaMinima: 'miseravel', tracos: ['Sem Penalidade'], desc: 'Vestimenta cotidiana básica sem proteção adicional (+0 Defesa).' },
  armadura_leve: { id: 'armadura_leve', nome: 'Armadura Leve (Gibão de Couro Batido / Traje Balístico)', bonusDefesa: 1, slotsCarga: 2, slot: 'tronco', categoria: 'Escudos & Armaduras', custo: 250, riquezaMinima: 'abastado', tracos: ['Proteção', 'Armadura Leve'], desc: 'Vestida no Tronco. Concede +1 de Defesa Total sem penalidades de mobilidade.' },
  armadura_media: { id: 'armadura_media', nome: 'Armadura Média (Cota de Malha / Brigantina Reforçada)', bonusDefesa: 2, slotsCarga: 2, slot: 'tronco', categoria: 'Escudos & Armaduras', custo: 500, riquezaMinima: 'milionario', tracos: ['Proteção', 'Armadura Média', 'Req: Corpo 2d6', 'Penalidade: -1m mov, -1d6 furtividade'], desc: 'Vestida no Tronco. Concede +2 de Defesa Total. Requer Corpo 2d6, reduz movimento em -1m por ação e impõe -1d6 em Furtividade.' },
  armadura_pesada: { id: 'armadura_pesada', nome: 'Armadura Pesada (Meia-Armadura de Placas de Aço)', bonusDefesa: 3, slotsCarga: 3, slot: 'tronco', categoria: 'Escudos & Armaduras', custo: 1000, riquezaMinima: 'milionario', tracos: ['Proteção', 'Armadura Pesada', 'Req: Corpo 3d6', 'Penalidade: -2m mov, -2d6 furtividade'], desc: 'Vestida no Tronco. Concede +3 de Defesa Total. Requer Corpo 3d6, reduz movimento em -2m por ação e impõe -2d6 em Furtividade.' },
  armadura_completa: { id: 'armadura_completa', nome: 'Armadura Completa (Placas Completas / Traje de Exotitânio)', bonusDefesa: 4, slotsCarga: 4, slot: 'tronco', categoria: 'Escudos & Armaduras', custo: 1500, riquezaMinima: 'milionario', tracos: ['Proteção', 'Armadura Completa', 'Req: Corpo 4d6', 'Penalidade: -3m mov, -3d6 furtividade', 'Carga Pesada'], desc: 'Vestida no Tronco. Concede +4 de Defesa Total. Requer Corpo 4d6, reduz movimento em -3m por ação e impõe -3d6 em Furtividade.' },
  // Compatibilidade legada
  defesa_leve: { id: 'defesa_leve', nome: 'Defesa Básica (Gibão de Couro/Colete Balístico Leve)', bonusDefesa: 1, slotsCarga: 1, slot: 'tronco', categoria: 'Escudos & Armaduras', custo: 250, riquezaMinima: 'pobre', tracos: ['Ágil'], desc: 'Proteção leve (+1 Defesa).' },
  defesa_media: { id: 'defesa_media', nome: 'Defesa Reforçada (Cota de Malha/Colete Tático)', bonusDefesa: 2, slotsCarga: 2, slot: 'tronco', categoria: 'Escudos & Armaduras', custo: 500, riquezaMinima: 'abastado', tracos: ['Proteção'], desc: 'Proteção média (+2 Defesa).' },
  defesa_pesada: { id: 'defesa_pesada', nome: 'Defesa Mestra (Armadura de Placas/Exotraje Reforçado)', bonusDefesa: 4, slotsCarga: 3, slot: 'tronco', categoria: 'Escudos & Armaduras', custo: 1500, riquezaMinima: 'milionario', tracos: ['Blindagem Máxima', 'Pesada'], desc: 'Blindagem completa (+4 Defesa).' }
};

export const ITEMS_COMPENDIUM = {
  // ===================================================
  // 1. SAÚDE, VITALIDADE & CURA
  // ===================================================
  cura_rapida: { id: 'cura_rapida', nome: 'Cura Rápida Consumível', slot: 'mochila', categoria: 'Saúde & Cura', slotsCarga: 1, custo: 50, riquezaMinima: 'pobre', tracos: ['Consumível', 'Empilhável (até 12)'], desc: 'Gasta 1 ação. Contém 3 doses. Cada dose recupera 1d6 + Corpo de Anima.' },
  cura_lenta: { id: 'cura_lenta', nome: 'Cura Lenta Consumível', slot: 'mochila', categoria: 'Saúde & Cura', slotsCarga: 2, custo: 30, riquezaMinima: 'miseravel', tracos: ['Consumível', 'Prolongado'], desc: '12 doses diárias. A partir do 3º dia consecutivo, soma o bônus de Corpo na recuperação de Anima em descansos e anula 1 condição por dia.' },
  cura_complexa: { id: 'cura_complexa', nome: 'Cura Complexa Consumível', slot: 'mochila', categoria: 'Saúde & Cura', slotsCarga: 2, custo: 80, riquezaMinima: 'pobre', tracos: ['Consumível', 'Especializado'], desc: 'Exige Especialização em Medicina de Campo (Mente). Teste de Mente (Meta 2). Cura 2d6 + Mente de Anima (+1d6 por sucesso extra). Estabiliza estado de Morrendo. Possui 12 usos.' },
  cura_emergencial: { id: 'cura_emergencial', nome: 'Cura Emergencial (Desfibrilador de Alma / Soro Fênix)', slot: 'mochila', categoria: 'Saúde & Cura', slotsCarga: 1, custo: 200, riquezaMinima: 'abastado', tracos: ['Consumível', 'Limitado (1 por personagem)', 'Extremo'], desc: 'Ao entrar em Morrendo, gasta as 4 ações do turno para reviver com 50% da Anima Máxima. Reduz permanentemente 1 atributo sorteado para 1d4 sem evolução.' },

  // ===================================================
  // 2. FOCO MENTAL, ESTRESSE & VONTADE
  // ===================================================
  relaxante_rapido: { id: 'relaxante_rapido', nome: 'Relaxante Rápido Consumível', slot: 'mochila', categoria: 'Foco Mental & Vontade', slotsCarga: 1, custo: 60, riquezaMinima: 'pobre', tracos: ['Consumível', 'Empilhável (até 12)'], desc: 'Gasta 1 ação (3 doses, limite 1x/dia). Anula penalidades de pânico, estresse ou medo no próximo teste de Espírito ou Mente.' },
  relaxante_lento: { id: 'relaxante_lento', nome: 'Relaxante Lento Consumível', slot: 'mochila', categoria: 'Foco Mental & Vontade', slotsCarga: 2, custo: 90, riquezaMinima: 'abastado', tracos: ['Consumível', 'Terapêutico'], desc: '12 doses diárias. A partir do 3º dia, remove penalidades mentais a cada 3 dias e trata traumas permanentes a cada 5 dias de descanso longo.' },
  motivador_rapido: { id: 'motivador_rapido', nome: 'Motivador Rápido Consumível', slot: 'mochila', categoria: 'Foco Mental & Vontade', slotsCarga: 1, custo: 50, riquezaMinima: 'pobre', tracos: ['Consumível', 'Empilhável (até 12)'], desc: 'Gasta 1 ação (2 doses). Concede +1d6 de bônus na reserva de dados em qualquer teste de atributo nas próximas 2 rodadas.' },
  motivador_lento: { id: 'motivador_lento', nome: 'Motivador Lento Consumível', slot: 'mochila', categoria: 'Foco Mental & Vontade', slotsCarga: 2, custo: 80, riquezaMinima: 'pobre', tracos: ['Consumível', 'Ampliador', 'Temporário'], desc: '12 doses diárias. A partir do 3º dia, concede +4 de Anima Máxima temporária e +1d6 em testes de resistência de Espírito enquanto mantiver o uso diário.' },
  objeto_motivador: { id: 'objeto_motivador', nome: 'Objeto Motivador (Relíquia Sentimental)', slot: 'acessorios', categoria: 'Foco Mental & Vontade', slotsCarga: 2, custo: 130, riquezaMinima: 'abastado', tracos: ['Limitado (1 por personagem)', 'Restaurador'], desc: '1x por sessão: Se entrar em Morrendo ou sofrer colapso moral, evoca o objeto e testa Espírito (com bônus narrativo de -2 a +2 dados) para recuperar Anima.' },
  objeto_relaxante: { id: 'objeto_relaxante', nome: 'Objeto Relaxante (Relíquia de Conforto)', slot: 'acessorios', categoria: 'Foco Mental & Vontade', slotsCarga: 2, custo: 160, riquezaMinima: 'abastado', tracos: ['Limitado (1 por personagem)', 'Emergencial'], desc: '1x por sessão: Ao ser alvo de terror sobrenatural ou trauma psíquico, segurar o objeto concede +2d6 no teste de Espírito para dissipar o efeito.' },
  amplificador_capacidades: { id: 'amplificador_capacidades', nome: 'Amplificador de Capacidades (Injeção de Adrenalina / Fúria Alquímica)', slot: 'mochila', categoria: 'Foco Mental & Vontade', slotsCarga: 1, custo: 180, riquezaMinima: 'abastado', tracos: ['Consumível', 'Limitado (1 por personagem)', 'Risco Severo'], desc: 'Uso único (1 ação). Concede +2d6 de bônus em todos os testes na cena. Ao fim da cena, entra em colapso com -2d6 em todos os atributos até receber Cura Complexa.' },

  // ===================================================
  // 3. DESCANSO, ACAMPAMENTO & ABRIGO
  // ===================================================
  descanso_relaxante: { id: 'descanso_relaxante', nome: 'Objeto de Descanso Relaxante (Incensário / Aromatizador)', slot: 'mochila', categoria: 'Descanso & Abrigo', slotsCarga: 1, custo: 140, riquezaMinima: 'abastado', tracos: ['Restaurador', 'Adicional Descanso'], desc: 'Em descansos, permite ao herói e até 2 aliados recuperarem +2 Anima e começarem a primeira cena com +1d6 na iniciativa.' },
  descanso_confortavel: { id: 'descanso_confortavel', nome: 'Objeto de Descanso Confortável (Saco de Dormir Térmico)', slot: 'costas', categoria: 'Descanso & Abrigo', slotsCarga: 1, custo: 120, riquezaMinima: 'abastado', tracos: ['Restaurador', 'Adicional Descanso'], desc: 'Adiciona +1d6 na rolagem de recuperação de Anima em qualquer Descanso Curto ou Longo.' },
  protetor_descanso: { id: 'protetor_descanso', nome: 'Objeto Protetor de Descanso (Alarme de Perímetro / Sinos Rúnicos)', slot: 'mochila', categoria: 'Descanso & Abrigo', slotsCarga: 2, custo: 100, riquezaMinima: 'abastado', tracos: ['Adicional Descanso', 'Defensivo'], desc: 'Protege contra intempéries leves. Caso atacados por inimigos, dispara instantaneamente impedindo surpresa e concedendo 1 reação livre.' },
  tenda_expedicao: { id: 'tenda_expedicao', nome: 'Local de Descanso Portátil (Tenda de Expedição)', slot: 'costas', categoria: 'Descanso & Abrigo', slotsCarga: 3, custo: 180, riquezaMinima: 'abastado', tracos: ['Abrigo Coletivo'], desc: 'Abriga confortavelmente 2 personagens com proteção plena contra intempéries climáticas severas.' },
  casulo_descanso_emergencial: { id: 'casulo_descanso_emergencial', nome: 'Local de Descanso Emergencial (Casulo / Rede Tática de Ancoragem)', slot: 'costas', categoria: 'Descanso & Abrigo', slotsCarga: 2, custo: 200, riquezaMinima: 'abastado', tracos: ['Abrigo Emergencial'], desc: 'Rede/casulo que pode ser fixado em superfícies verticais, copas de árvores ou paredões para descanso seguro.' },

  // ===================================================
  // 4. EXPRESSÃO CULTURAL, ARTE & SOCIAL
  // ===================================================
  instrumento_musical_pequeno: { id: 'instrumento_musical_pequeno', nome: 'Instrumento Musical Pequeno (Flauta / Gaita / Pandeiro)', slot: 'acessorios', categoria: 'Arte & Social', slotsCarga: 1, custo: 50, riquezaMinima: 'pobre', tracos: ['Musical', 'Auxiliar'], desc: 'Concede +1d6 em 1 teste de Social por cena ou +1 ponto de Anima recuperado aos ouvintes durante Descanso Curto.' },
  instrumento_musical_medio: { id: 'instrumento_musical_medio', nome: 'Instrumento Musical Médio (Violão / Alaúde / Tambor)', slot: 'costas', categoria: 'Arte & Social', slotsCarga: 2, custo: 100, riquezaMinima: 'abastado', tracos: ['Musical', 'Auxiliar'], desc: 'Concede +1d6 em até 2 testes de Social na cena e inspira aliados com +2 Anima no descanso.' },
  instrumento_musical_grande: { id: 'instrumento_musical_grande', nome: 'Instrumento Musical Grande (Harmônio / Violoncelo)', slot: 'costas', categoria: 'Arte & Social', slotsCarga: 5, custo: 500, riquezaMinima: 'milionario', tracos: ['Musical', 'Monumental'], desc: 'Concede +2d6 em testes de Performance/Corte e recupera +1d6 de Anima para todo o grupo em descansos.' },
  jogos_portateis: { id: 'jogos_portateis', nome: 'Jogos Portáteis (Baralho / Dados de Aposta / Tarot)', slot: 'acessorios', categoria: 'Arte & Social', slotsCarga: 1, custo: 80, riquezaMinima: 'pobre', tracos: ['Social', 'Recreativo'], desc: 'Estojo para jogos e leituras oraculares. Concede +1d6 em testes de Social em tavernas e jogos.' },
  simbolo_cultural: { id: 'simbolo_cultural', nome: 'Objeto Simbólico e Cultural (Insígnia / Brasão)', slot: 'acessorios', categoria: 'Arte & Social', slotsCarga: 1, custo: 40, riquezaMinima: 'pobre', tracos: ['Social', 'Diplomacia'], desc: 'Concede +1d6 em testes de Social na primeira impressão com personagens da mesma cultura ou facção.' },

  // ===================================================
  // 5. ENERGIA, LUZ & CALOR
  // ===================================================
  fonte_energia: { id: 'fonte_energia', nome: 'Fonte de Energia (Bateria / Cristal de Éter / Célula de Combustível)', slot: 'mochila', categoria: 'Energia, Luz & Calor', slotsCarga: 2, custo: 100, riquezaMinima: 'abastado', tracos: ['Consumível', 'Energizador'], desc: 'Unidade com 6 cargas de energia para abastecer artefatos e maquinários.' },
  fonte_luz: { id: 'fonte_luz', nome: 'Fonte de Luz (Lanterna / Tocha Alquímica)', slot: 'mao_secundaria', categoria: 'Energia, Luz & Calor', slotsCarga: 1, custo: 80, riquezaMinima: 'pobre', tracos: ['Iluminação', 'Utilitário'], desc: 'Ilumina 15 metros em raio. Gasta 1 carga de energia a cada 3 cenas (ou 5h de uso contínuo).' },
  fonte_calor: { id: 'fonte_calor', nome: 'Fonte de Calor (Aquecedor Rúnico / Brasero Portátil)', slot: 'mochila', categoria: 'Energia, Luz & Calor', slotsCarga: 1, custo: 80, riquezaMinima: 'pobre', tracos: ['Térmico', 'Sobrevivência'], desc: 'Aquece 15m² por 4 cenas protegendo contra frio extremo. Consome 1 carga de energia.' },
  recarregador_energia: { id: 'recarregador_energia', nome: 'Recarregador Portátil de Energia (Coletor Solar / Cinético)', slot: 'mochila', categoria: 'Energia, Luz & Calor', slotsCarga: 2, custo: 350, riquezaMinima: 'rico', tracos: ['Sustentável', 'Utilitário'], desc: 'Exposto ao ambiente natural por 4 horas ou Descanso Longo, recupera 1 carga para bateria (máx 10 cargas).' },

  // ===================================================
  // 6. COMUNICAÇÃO, INFORMAÇÃO & SENSORES
  // ===================================================
  comunicador_pequeno: { id: 'comunicador_pequeno', nome: 'Comunicador Pequeno (Curto Alcance)', slot: 'acessorios', categoria: 'Comunicação & Sensores', slotsCarga: 1, custo: 60, riquezaMinima: 'pobre', tracos: ['Comunicação'], desc: 'Conjunto de 4 microtransceptores para áudio nítido em até 500 metros.' },
  comunicador_medio: { id: 'comunicador_medio', nome: 'Comunicador Médio (Médio Alcance)', slot: 'costas', categoria: 'Comunicação & Sensores', slotsCarga: 2, custo: 120, riquezaMinima: 'abastado', tracos: ['Comunicação'], desc: 'Conjunto de 4 rádio-transmissores ou espelhos mágicos pareados com alcance de até 15 km.' },
  comunicador_grande: { id: 'comunicador_grande', nome: 'Comunicador Grande (Longo Alcance / Estação Global)', slot: 'costas', categoria: 'Comunicação & Sensores', slotsCarga: 3, custo: 240, riquezaMinima: 'abastado', tracos: ['Comunicação', 'Carga Pesada'], desc: 'Estação portátil de transmissão continental sem limite de distância.' },
  retentor_informacoes: { id: 'retentor_informacoes', nome: 'Retentor de Informações (Codex Digital / Caderno Oculto)', slot: 'mochila', categoria: 'Comunicação & Sensores', slotsCarga: 1, custo: 100, riquezaMinima: 'abastado', tracos: ['Dados', 'Registro'], desc: 'Armazena mapas, áudios, pistas e o diário de bordo da campanha.' },
  sensor_variado: { id: 'sensor_variado', nome: 'Sensor Variado (Bússola Arcana / Detector Específico)', slot: 'mochila', categoria: 'Comunicação & Sensores', slotsCarga: 2, custo: 150, riquezaMinima: 'abastado', tracos: ['Investigação'], desc: 'Radar configurado para detectar substâncias, venenos, radiação ou anomalias de Anima em 50m.' },
  localizador: { id: 'localizador', nome: 'Localizador (Transmissor Rastreador)', slot: 'mochila', categoria: 'Comunicação & Sensores', slotsCarga: 1, custo: 80, riquezaMinima: 'pobre', tracos: ['Rastreio'], desc: 'Emissor de sinal fixável em alvos ou veículos, rastreável pelo Retentor de Informações.' },
  possibilitador_percepcao: { id: 'possibilitador_percepcao', nome: 'Possibilitador de Percepção (Visor Noturno / Óculos Espectrais)', slot: 'cabeca', categoria: 'Comunicação & Sensores', slotsCarga: 2, custo: 140, riquezaMinima: 'abastado', tracos: ['Percepção Especial'], desc: 'Visão no escuro absoluto e rastreio de fluxos de energia ou pegadas invisíveis (1 carga por cena).' },
  facilitador_percepcao: { id: 'facilitador_percepcao', nome: 'Facilitador de Percepção (Luneta de Precisão / Lupa de Investigação)', slot: 'acessorios', categoria: 'Comunicação & Sensores', slotsCarga: 1, custo: 120, riquezaMinima: 'abastado', tracos: ['Percepção Fina', 'Auxiliar'], desc: 'Concede +1d6 em testes de Mente voltados para Investigação e Percepção Fina.' },
  objeto_informativo: { id: 'objeto_informativo', nome: 'Objeto Informativo (Guia Regional / Bestiário de Campo)', slot: 'mochila', categoria: 'Comunicação & Sensores', slotsCarga: 1, custo: 60, riquezaMinima: 'pobre', tracos: ['Conhecimento', 'Auxiliar'], desc: '1x por sessão: Concede +1d6 em testes de Mente ao pesquisar sobre fauna, monstros, flora ou geografia local.' },

  // ===================================================
  // 7. FERRAMENTAS, MANUSEIO & ARMAZENAMENTO
  // ===================================================
  ferramentas_simples: { id: 'ferramentas_simples', nome: 'Conjunto de Ferramentas Simples', slot: 'mochila', categoria: 'Ferramentas & Armazenamento', slotsCarga: 2, custo: 80, riquezaMinima: 'pobre', tracos: ['Geral', 'Utilitário'], desc: 'Estojo multiuso para reparos simples e desmonte de objetos sem penalidades por falta de equipamento.' },
  ferramentas_especializadas: { id: 'ferramentas_especializadas', nome: 'Conjunto de Ferramentas Especializadas', slot: 'mochila', categoria: 'Ferramentas & Armazenamento', slotsCarga: 2, custo: 150, riquezaMinima: 'abastado', tracos: ['Especializado'], desc: 'Requer especialização (Mecânica/Engenharia/Ladinagem). Concede +1d6 de bônus e habilita feitos técnicos complexos.' },
  prendedores: { id: 'prendedores', nome: 'Prendedores (Grampos de Escalada / Fixadores Rápidos)', slot: 'mochila', categoria: 'Ferramentas & Armazenamento', slotsCarga: 1, custo: 20, riquezaMinima: 'miseravel', tracos: ['Consumível', 'Empilhável (até 12)'], desc: 'Conjunto com 6 ancoradores rápidos para fixar cordas e equipamentos com firmeza absoluta.' },
  protetor_risco_ambiental: { id: 'protetor_risco_ambiental', nome: 'Protetor de Risco Ambiental (Máscara de Gás / Traje de Radiação)', slot: 'cabeca', categoria: 'Ferramentas & Armazenamento', slotsCarga: 2, custo: 200, riquezaMinima: 'abastado', tracos: ['Imunidade Ambiental'], desc: 'Concede imunidade total a um risco ambiental passivo (gases tóxicos, esporos fúngicos ou radiação).' },
  armazenamento_medio: { id: 'armazenamento_medio', nome: 'Objeto de Armazenamento Médio (Bornal Tático / Bolsa de Cintura)', slot: 'acessorios', categoria: 'Ferramentas & Armazenamento', slotsCarga: 0, custo: 120, riquezaMinima: 'abastado', tracos: ['Ampliador de Carga', 'Limitado (3 por personagem)'], desc: 'Concede +4 slots adicionais na mochila para itens de até 2 slots. Limite de 3 por personagem.' },
  armazenamento_grande: { id: 'armazenamento_grande', nome: 'Objeto de Armazenamento Grande (Mochila de Grande Expedição)', slot: 'costas', categoria: 'Ferramentas & Armazenamento', slotsCarga: 0, custo: 160, riquezaMinima: 'abastado', tracos: ['Ampliador de Carga', 'Limitado (1 por personagem)'], desc: 'Concede +8 slots adicionais de capacidade na mochila para itens de até 4 slots. Limite de 1 por personagem.' },
  facilitador_uso_saque: { id: 'facilitador_uso_saque', nome: 'Objeto Facilitador de Uso (Coldre de Saque Rápido / Bainha Magnética)', slot: 'acessorios', categoria: 'Ferramentas & Armazenamento', slotsCarga: 2, custo: 60, riquezaMinima: 'pobre', tracos: ['Facilitador', 'Limitado (1 por personagem)'], desc: 'Cria 3 Espaços Rápidos. Itens de 1 slot neles podem ser sacados como Ação Livre (0 ações) 1x por rodada.' },
  recipiente_lacrado: { id: 'recipiente_lacrado', nome: 'Recipiente Lacrado (Frascos Herméticos / Recipiente Blindado)', slot: 'mochila', categoria: 'Ferramentas & Armazenamento', slotsCarga: 2, custo: 100, riquezaMinima: 'abastado', tracos: ['Empilhável (até 12)', 'Isolamento'], desc: 'Permite transportar substâncias corrosivas, inflamáveis ou contagiosas sem vazamento.' },
  purificador: { id: 'purificador', nome: 'Purificador (Destilador Alquímico / Filtro de Éter)', slot: 'mochila', categoria: 'Ferramentas & Armazenamento', slotsCarga: 2, custo: 80, riquezaMinima: 'pobre', tracos: ['Purificação', 'Utilitário'], desc: 'Torna águas e rações contaminadas potáveis e permite isolar venenos em frascos separados.' },

  // ===================================================
  // 8. TREINAMENTO, INFLUÊNCIA & DEBUFFS
  // ===================================================
  treino_fisico: { id: 'treino_fisico', nome: 'Objeto de Treino Físico (Halteres de Campo / Tensores)', slot: 'mochila', categoria: 'Treino & Influência', slotsCarga: 2, custo: 50, riquezaMinima: 'pobre', tracos: ['Desenvolvimento'], desc: 'Usado em downtime para conceder bônus de desenvolvimento acelerado para o atributo Corpo.' },
  treino_mental: { id: 'treino_mental', nome: 'Objeto de Treino Mental (Quebra-Cabeças / Foco Psíquico)', slot: 'mochila', categoria: 'Treino & Influência', slotsCarga: 2, custo: 50, riquezaMinima: 'pobre', tracos: ['Desenvolvimento'], desc: 'Usado em downtime para desenvolvimento acelerado dos atributos Mente ou Espírito.' },
  influenciador_mental: { id: 'influenciador_mental', nome: 'Objeto Influenciador Mental Consumível (Soro da Verdade / Essência Hipnótica)', slot: 'mochila', categoria: 'Treino & Influência', slotsCarga: 1, custo: 80, riquezaMinima: 'pobre', tracos: ['Consumível', 'Empilhável (até 12)'], desc: 'Uso único (1 dose). Alvo falha em teste de Espírito -> -2d6 em testes mentais até o descanso e responde com honestidade.' },
  peconha_debilitante: { id: 'peconha_debilitante', nome: 'Objeto Enfraquecedor Consumível (Peçonha Debilitante)', slot: 'mochila', categoria: 'Treino & Influência', slotsCarga: 1, custo: 100, riquezaMinima: 'abastado', tracos: ['Consumível', 'Empilhável (até 12)'], desc: 'Uso único (1 dose em lâmina). O alvo atingido perde 1 dado de atributo a cada 2h até ser tratado ou entrar em Morrendo.' },

  // ===================================================
  // 9. MOBILIDADE & VEÍCULOS
  // ===================================================
  facilitador_deslocamento: { id: 'facilitador_deslocamento', nome: 'Facilitador de Deslocamento (Botas de Cravos / Ganchos de Neve)', slot: 'pes', categoria: 'Mobilidade & Veículos', slotsCarga: 2, custo: 60, riquezaMinima: 'pobre', tracos: ['Mobilidade', 'Vestimenta'], desc: 'Equipado nos pés. Anula penalidades de terreno difícil específico (lamaçal, gelo, escombros).' },
  transportador_comum: { id: 'transportador_comum', nome: 'Transportador (Bicicleta de Carga / Montaria Terrestre)', slot: 'mochila', categoria: 'Mobilidade & Veículos', slotsCarga: 3, custo: 200, riquezaMinima: 'abastado', tracos: ['Transporte'], desc: 'Triplica a velocidade de deslocamento do grupo em viagens. Consome 4 cargas de energia por viagem longa.' },
  transportador_rapido: { id: 'transportador_rapido', nome: 'Transportador Rápido (Veículo Motorizado / Deslizador Aéreo)', slot: 'mochila', categoria: 'Mobilidade & Veículos', slotsCarga: 3, custo: 500, riquezaMinima: 'milionario', tracos: ['Alta Velocidade'], desc: 'Veículo ultrarrápido impossível de ser interceptado a pé. Consome 10 cargas de energia por viagem.' },

  // ===================================================
  // 10. BARREIRA, SUPRESSÃO & PRÓTESES
  // ===================================================
  local_isolante: { id: 'local_isolante', nome: 'Local Isolante (Domo Isolador de Anima / Gaiola de Faraday)', slot: 'mochila', categoria: 'Barreiras & Próteses', slotsCarga: 3, custo: 175, riquezaMinima: 'abastado', tracos: ['Barreira', 'Carga Pesada'], desc: 'Bloqueia totalmente manifestações de energias mágicas, transmissões tecnológicas ou presenças espirituais na área.' },
  local_restritor: { id: 'local_restritor', nome: 'Local Restritor (Âncora de Supressão de Força)', slot: 'mochila', categoria: 'Barreiras & Próteses', slotsCarga: 3, custo: 150, riquezaMinima: 'abastado', tracos: ['Supressor', 'Carga Pesada'], desc: 'Impõe -2d6 de penalidade na potência e no dano de ataques ou magias realizados dentro da área.' },
  protese_simples: { id: 'protese_simples', nome: 'Próteses Simples (Braço, Perna, Tronco ou Sentidos Mecânicos)', slot: 'acessorios', categoria: 'Barreiras & Próteses', slotsCarga: 2, custo: 150, riquezaMinima: 'abastado', tracos: ['Prótese', 'Membro'], desc: 'Substitui membro perdido restaurando a função, porém com -1 dado permanente em destreza fina daquele membro.' },
  protese_avancada: { id: 'protese_avancada', nome: 'Próteses Avançadas (Membro Biomecânico de Alta Performance)', slot: 'acessorios', categoria: 'Barreiras & Próteses', slotsCarga: 3, custo: 300, riquezaMinima: 'rico', tracos: ['Prótese Avançada', 'Membro', 'Compartimento Embutido'], desc: 'Concede +1d6 fixo no atributo correspondente e possui compartimento para acoplar 1 item de até 2 slots sacado com 0 ações.' },

  // ===================================================
  // 11. DEFESAS PESSOAIS: ESCUDOS & ARMADURAS
  // ===================================================
  ...DEFENSES_CATALOG,
  escudo_pequeno: { id: 'escudo_pequeno', nome: 'Escudo Pequeno (Broquel / Escudo de Braço)', slot: 'mao_secundaria', categoria: 'Escudos & Armaduras', slotsCarga: 1, custo: 300, riquezaMinima: 'rico', bonusDefesa: 1, tracos: ['Proteção', 'Escudo Leve'], desc: 'Equipado na Mão Secundária. Concede +1 de Defesa Total sem penalidades de mobilidade.' },
  escudo_medio: { id: 'escudo_medio', nome: 'Escudo Médio (Escudo de Duelo / Gota)', slot: 'mao_secundaria', categoria: 'Escudos & Armaduras', slotsCarga: 2, custo: 400, riquezaMinima: 'rico', bonusDefesa: 2, tracos: ['Proteção', 'Escudo', 'Req: Corpo 2d6', 'Penalidade: -1m mov'], desc: 'Equipado na Mão Secundária. Concede +2 de Defesa Total. Requer Corpo 2d6 e reduz movimento em -1m por ação.' },
  escudo_grande: { id: 'escudo_grande', nome: 'Escudo Grande (Escudo de Infantaria / Torre)', slot: 'mao_secundaria', categoria: 'Escudos & Armaduras', slotsCarga: 2, custo: 500, riquezaMinima: 'milionario', bonusDefesa: 3, tracos: ['Proteção', 'Escudo Pesado', 'Req: Corpo 3d6', 'Penalidade: -2m mov, -1d6 furtividade'], desc: 'Equipado na Mão Secundária. Concede +3 de Defesa Total. Requer Corpo 3d6, reduz movimento em -2m e impõe -1d6 em Furtividade.' },
  escudo_enorme: { id: 'escudo_enorme', nome: 'Escudo Enorme (Pavise / Baluarte Móvel)', slot: 'mao_secundaria', categoria: 'Escudos & Armaduras', slotsCarga: 3, custo: 600, riquezaMinima: 'milionario', bonusDefesa: 4, tracos: ['Proteção', 'Escudo Baluarte', 'Req: Corpo 4d6', 'Penalidade: -3m mov, -2d6 furtividade', 'Carga Pesada'], desc: 'Equipado na Mão Secundária. Concede +4 de Defesa Total e cobertura sólida. Requer Corpo 4d6, reduz movimento em -3m e impõe -2d6 em Furtividade.' },
  escudo_leve: { id: 'escudo_leve', nome: 'Escudo Leve de Madeira/Aço', slot: 'mao_secundaria', categoria: 'Escudos & Armaduras', slotsCarga: 1, custo: 300, riquezaMinima: 'pobre', bonusDefesa: 1, tracos: ['Proteção', 'Escudo Leve'], desc: 'Garante +1 ponto de bônus na Defesa Total do personagem.' },
  escudo_pesado: { id: 'escudo_pesado', nome: 'Escudo Torre Blindado', slot: 'mao_secundaria', categoria: 'Escudos & Armaduras', slotsCarga: 2, custo: 500, riquezaMinima: 'abastado', bonusDefesa: 2, tracos: ['Proteção', 'Escudo Pesado'], desc: 'Garante +2 pontos de bônus na Defesa Total.' },

  // ===================================================
  // 12. FOCOS ARCANOS & ITENS MÁGICOS
  // ===================================================
  orbe_magia: { id: 'orbe_magia', nome: 'Orbe de Magia (Foco Primordial)', slot: 'mao_secundaria', categoria: 'Focos Arcanos & Mágicos', slotsCarga: 1, custo: 900, riquezaMinima: 'milionario', tracos: ['Foco Arcano', 'Mágico'], desc: 'Equipado na Mão Secundária/Acessórios. Permite manifestar 1 Poder Arcano de maior potência sem o sacrifício requerido.' },
  cajado_arcano: { id: 'cajado_arcano', nome: 'Cajado Arcano (Canalizador de Éter)', slot: 'mao_primaria', categoria: 'Focos Arcanos & Mágicos', slotsCarga: 2, custo: 1000, riquezaMinima: 'milionario', dano: '1d6+2', tracos: ['Foco Arcano', 'Canalizador', 'Mágico', 'Duas Mãos'], desc: 'Equipado na Mão Primária. Reduz o custo de Anima de todas as magias e poderes ativos em 50% (mínimo de 1).' },
  grimorio_feiticos: { id: 'grimorio_feiticos', nome: 'Grimório de Feitiços (Tomo Arcano)', slot: 'mao_secundaria', categoria: 'Focos Arcanos & Mágicos', slotsCarga: 2, custo: 700, riquezaMinima: 'milionario', tracos: ['Grimório', 'Mágico'], desc: 'Equipado na Mão Secundária ou Mochila. Concede o domínio e registro de +1 Poder ou Elemento Arcano adicional na ficha.' },
  varinha_arcana: { id: 'varinha_arcana', nome: 'Varinha Arcana (Condutor de Foco)', slot: 'mao_secundaria', categoria: 'Focos Arcanos & Mágicos', slotsCarga: 1, custo: 600, riquezaMinima: 'milionario', tracos: ['Foco Arcano', 'Condutor', 'Mágico'], desc: 'Empunhada na Mão Primária ou Secundária. Concede +1d6 de bônus fixo em todos os testes de conjuração mágica e canalização de Espírito.' },

  // ===================================================
  // 13. KITS DE ESPECIALIZAÇÃO / PERÍCIA
  // ===================================================
  kit_especializacao: { id: 'kit_especializacao', nome: 'Kit de Especialização (Medicina, Ladinagem, Investigação, etc.)', slot: 'mochila', categoria: 'Kits de Especialização', slotsCarga: 1, custo: 300, riquezaMinima: 'rico', tracos: ['Especializado', 'Consumível (12 usos)', 'Auxiliar'], desc: 'Possui 12 usos vinculados à especialização escolhida. Antes de rolar um teste da perícia, gasta 1 uso para receber +1d6 na rolagem.' },

  // ===================================================
  // 14. ARMAS DO CATÁLOGO GERAL
  // ===================================================
  ...WEAPONS_CATALOG,

  // ===================================================
  // 15. VESTIMENTAS & EQUIPAMENTOS ANATÔMICOS (SILHUETA)
  // ===================================================
  // Cabeça
  capuz_couro: { id: 'capuz_couro', nome: 'Capuz de Couro e Lã', slot: 'cabeca', categoria: 'Vestimentas & Anatomia', slotsCarga: 0, custo: 20, riquezaMinima: 'miseravel', bonusDefesa: 0, desc: 'Protege contra intempéries e oculta o semblante.' },
  elmo_ferro: { id: 'elmo_ferro', nome: 'Elmo de Ferro Forjado', slot: 'cabeca', categoria: 'Vestimentas & Anatomia', slotsCarga: 1, custo: 100, riquezaMinima: 'abastado', bonusDefesa: 0, desc: 'Proteção robusta contra golpes contundentes.' },
  oculos_precisao: { id: 'oculos_precisao', nome: 'Óculos de Lentes de Precisão', slot: 'cabeca', categoria: 'Vestimentas & Anatomia', slotsCarga: 0, custo: 140, riquezaMinima: 'abastado', bonusDefesa: 0, desc: 'Melhora a acuidade visual e inspeção de detalhes.' },
  mascara_gas: { id: 'mascara_gas', nome: 'Máscara Rúnica Respiratória / Anti-Gás', slot: 'cabeca', categoria: 'Vestimentas & Anatomia', slotsCarga: 1, custo: 200, riquezaMinima: 'rico', bonusDefesa: 0, desc: 'Filtra toxinas, vapores do Vazio e fumaça densa.' },

  // Costas
  mochila_aventureiro: { id: 'mochila_aventureiro', nome: 'Mochila de Couro Reforçada', slot: 'costas', categoria: 'Vestimentas & Anatomia', slotsCarga: 0, custo: 80, riquezaMinima: 'pobre', bonusSlots: 2, desc: 'Aumenta a capacidade de carga do herói em +2 slots.' },
  capa_viagem: { id: 'capa_viagem', nome: 'Capa de Viagem Impermeável', slot: 'costas', categoria: 'Vestimentas & Anatomia', slotsCarga: 0, custo: 30, riquezaMinima: 'miseravel', desc: 'Resiste a chuva, lama e ventos cortantes.' },
  aljava_flechas: { id: 'aljava_flechas', nome: 'Aljava Rígida de Caça', slot: 'costas', categoria: 'Vestimentas & Anatomia', slotsCarga: 1, custo: 40, riquezaMinima: 'pobre', desc: 'Armazena com segurança até 24 flechas ou virotes.' },
  coldre_duplo: { id: 'coldre_duplo', nome: 'Coldre Duplo de Ombro', slot: 'costas', categoria: 'Vestimentas & Anatomia', slotsCarga: 0, custo: 100, riquezaMinima: 'abastado', desc: 'Permite saque rápido de armas de porte leve.' },

  // Mão Secundária Utilitária / Parrying
  tocha_eterna: { id: 'tocha_eterna', nome: 'Tocha Alquímica de Longa Duração', slot: 'mao_secundaria', categoria: 'Energia, Luz & Calor', slotsCarga: 1, custo: 40, riquezaMinima: 'miseravel', desc: 'Ilumina um raio de 10 metros durante 4 horas.' },
  lanterna_foco: { id: 'lanterna_foco', nome: 'Lanterna Direcional a Óleo', slot: 'mao_secundaria', categoria: 'Energia, Luz & Calor', slotsCarga: 1, custo: 90, riquezaMinima: 'abastado', desc: 'Projeta um facho cônico de luz intensa a até 20 metros.' },
  foco_arcano: { id: 'foco_arcano', nome: 'Orbe / Foco de Canalização de Anima', slot: 'mao_secundaria', categoria: 'Focos Arcanos & Mágicos', slotsCarga: 1, custo: 200, riquezaMinima: 'abastado', desc: 'Estabiliza a emanação de poderes sobrenaturais.' },
  adaga_parrying: { id: 'adaga_parrying', nome: 'Adaga de Bloqueio (Main-gauche)', slot: 'mao_secundaria', categoria: 'Arma Branca', slotsCarga: 1, custo: 120, riquezaMinima: 'abastado', bonusDefesa: 1, dano: '1d4+1', desc: 'Projetada para aparar ataques em combate corpo a corpo (+1 Defesa).' },

  // Pernas
  calcas_couro: { id: 'calcas_couro', nome: 'Calças de Couro Tratado', slot: 'pernas', categoria: 'Vestimentas & Anatomia', slotsCarga: 0, custo: 30, riquezaMinima: 'miseravel', desc: 'Resistentes e confortáveis para longas jornadas.' },
  caneleiras_aco: { id: 'caneleiras_aco', nome: 'Caneleiras de Aço Reforçado', slot: 'pernas', categoria: 'Vestimentas & Anatomia', slotsCarga: 1, custo: 110, riquezaMinima: 'abastado', desc: 'Protegem contra armadilhas de solo e impactos baixos.' },
  calcas_nobreza: { id: 'calcas_nobreza', nome: 'Calças de Seda Nobre com Fios de Ouro', slot: 'pernas', categoria: 'Vestimentas & Anatomia', slotsCarga: 0, custo: 350, riquezaMinima: 'rico', desc: 'Demonstra prestígio social inegável perante cortesãos.' },

  // Pés
  botas_viagem: { id: 'botas_viagem', nome: 'Botas de Couro de Viagem', slot: 'pes', categoria: 'Vestimentas & Anatomia', slotsCarga: 0, custo: 30, riquezaMinima: 'miseravel', desc: 'Duráveis, impermeáveis e anatômicas.' },
  botas_infantaria: { id: 'botas_infantaria', nome: 'Botas Pesadas de Infantaria com Biqueira de Aço', slot: 'pes', categoria: 'Vestimentas & Anatomia', slotsCarga: 1, custo: 100, riquezaMinima: 'abastado', desc: 'Excelente estabilidade em terrenos acidentados.' },
  sapatos_gala: { id: 'sapatos_gala', nome: 'Sapatos Envernizados de Gala', slot: 'pes', categoria: 'Vestimentas & Anatomia', slotsCarga: 0, custo: 200, riquezaMinima: 'abastado', desc: 'Apropriados para banquetes e ambientes da alta sociedade.' },

  // Acessórios
  anel_sinete: { id: 'anel_sinete', nome: 'Anel de Sinete da Família', slot: 'acessorios', categoria: 'Arte & Social', slotsCarga: 0, custo: 180, riquezaMinima: 'abastado', desc: 'Símbolo heráldico usado para lacrar documentos e atestar linhagem.' },
  amuleto_protecao: { id: 'amuleto_protecao', nome: 'Amuleto Protetor Talhado em Obsidiana', slot: 'acessorios', categoria: 'Arte & Social', slotsCarga: 0, custo: 80, riquezaMinima: 'pobre', desc: 'Talismã com gravuras protetoras contra o Vazio.' },
  relogio_bolso: { id: 'relogio_bolso', nome: 'Relógio de Bolso de Precisão a Corda', slot: 'acessorios', categoria: 'Comunicação & Sensores', slotsCarga: 0, custo: 160, riquezaMinima: 'abastado', desc: 'Mede as horas exatas com mecanismo de engrenagens de precisão.' },
  cantil_prata: { id: 'cantil_prata', nome: 'Cantil de Prata Maciça', slot: 'acessorios', categoria: 'Ferramentas & Armazenamento', slotsCarga: 0, custo: 100, riquezaMinima: 'abastado', desc: 'Preserva bebidas puras e ressalta a elegância do aventureiro.' }
};

/**
 * Retorna itens do compêndio filtrados por slot, categoria ou riqueza
 */
export function getCompendiumItems({ slot = null, categoria = null, riquezaMax = null } = {}) {
  let list = Object.values(ITEMS_COMPENDIUM);

  if (slot) {
    list = list.filter(item => item.slot === slot);
  }

  if (categoria) {
    list = list.filter(item => item.categoria === categoria);
  }

  if (riquezaMax) {
    const tierOrder = ['miseravel', 'pobre', 'abastado', 'rico', 'milionario'];
    const maxIdx = tierOrder.indexOf(riquezaMax === 'classe_media_baixa' || riquezaMax === 'classe_media_alta' ? 'abastado' : riquezaMax);
    if (maxIdx !== -1) {
      list = list.filter(item => {
        let req = item.riquezaMinima || 'miseravel';
        if (req === 'classe_media_baixa' || req === 'classe_media_alta') req = 'abastado';
        const itemIdx = tierOrder.indexOf(req);
        return itemIdx <= maxIdx;
      });
    }
  }

  return list;
}

// ===================================================
// CATÁLOGO OFICIAL DE ESPECIALIZAÇÕES & PERÍCIAS (ALPHAD6)
// ===================================================

export const SPECIALIZATIONS_CATALOG = {
  // === 1. COMBATE & TÁTICAS MARCIAIS ===
  acrobacia: { id: 'acrobacia', nome: 'Acrobacia', atributo: 'corpo', categoria: 'Combate & Táticas Marciais', desc: 'Manobras evasivas, saltos circenses, amortecimento de quedas e travessia ágil de obstáculos em combate.' },
  armas_brancas: { id: 'armas_brancas', nome: 'Armas Brancas', atributo: 'corpo', categoria: 'Combate & Táticas Marciais', desc: 'Manejo refinado de lâminas, maças, machados, lanças e armas de haste corpo a corpo.' },
  armas_fogo: { id: 'armas_fogo', nome: 'Armas de Fogo', atributo: 'mente', categoria: 'Combate & Táticas Marciais', desc: 'Domínio balístico de pistolas, carabinas, rifles de longo alcance e armamento pesado.' },
  armas_exoticas: { id: 'armas_exoticas', nome: 'Armas Exóticas', atributo: 'mente', categoria: 'Combate & Táticas Marciais', desc: 'Uso de armas raras, incomuns ou arcanotécnicas (chicotes, correntes, lâminas giratórias, chakrams).' },
  arremesso_disparo: { id: 'arremesso_disparo', nome: 'Arremesso & Disparo', atributo: 'mente', categoria: 'Combate & Táticas Marciais', desc: 'Precisão em lançar facas, granadas, dardos, flechas de arco e virotes de besta.' },
  esquiva_reflexos: { id: 'esquiva_reflexos', nome: 'Esquiva & Reflexos', atributo: 'corpo', categoria: 'Combate & Táticas Marciais', desc: 'Agilidade instintiva para desviar de golpes corpo a corpo, disparos e armadilhas de área.' },
  furtividade: { id: 'furtividade', nome: 'Furtividade', atributo: 'corpo', categoria: 'Combate & Táticas Marciais', desc: 'Movimentação silenciosa, camuflagem em sombras e infiltração sem ser detectado.' },
  luta_desarmada: { id: 'luta_desarmada', nome: 'Luta Desarmada', atributo: 'corpo', categoria: 'Combate & Táticas Marciais', desc: 'Artes marciais, socos, chutes, imobilizações e combate desarmado corpo a corpo.' },
  tolerancia_dor: { id: 'tolerancia_dor', nome: 'Tolerância a Dor', atributo: 'corpo', categoria: 'Combate & Táticas Marciais', desc: 'Resiliência biológica extrema para suportar tortura, venenos e continuar lutando após ferimentos graves.' },

  // === 2. FÍSICAS, EXPLORAÇÃO & SOBREVIVÊNCIA ===
  atletismo: { id: 'atletismo', nome: 'Atletismo', atributo: 'corpo', categoria: 'Físicas, Exploração & Sobrevivência', desc: 'Corridas de alta velocidade, escalada de paredes íngremes, levantamento de peso e saltos longos.' },
  adestramento_montaria: { id: 'adestramento_montaria', nome: 'Adestramento & Montaria', atributo: 'social', categoria: 'Físicas, Exploração & Sobrevivência', desc: 'Domar, treinar, cavalgar e comandar animais, montarias terrestres e bestas fantásticas.' },
  natacao_mergulho: { id: 'natacao_mergulho', nome: 'Natação & Mergulho', atributo: 'corpo', categoria: 'Físicas, Exploração & Sobrevivência', desc: 'Deslocamento aquático veloz, fôlego prolongado e sobrevivência em correntezas fluviais ou marítimas.' },
  pilotagem: { id: 'pilotagem', nome: 'Pilotagem', atributo: 'mente', categoria: 'Físicas, Exploração & Sobrevivência', desc: 'Condução e controle de veículos terrestres motorizados, barcos, aeronaves e deslizadores de éter.' },
  sobrevivencia_pesca: { id: 'sobrevivencia_pesca', nome: 'Sobrevivência & Pesca', atributo: 'mente', categoria: 'Físicas, Exploração & Sobrevivência', desc: 'Rastreio em ermos, busca de água potável, pesca, caça, acampamento e previsão climática.' },
  preparo_engenhosidade: { id: 'preparo_engenhosidade', nome: 'Preparo & Engenhosidade', atributo: 'mente', categoria: 'Físicas, Exploração & Sobrevivência', desc: 'Capacidade tática de planejar com antecedência; teste de sorte para ter um item utilitário na cena (esgota após a cena).' },

  // === 3. OFÍCIOS & ENGENHARIA (CRAFTING) ===
  alfaiataria_couro: { id: 'alfaiataria_couro', nome: 'Alfaiataria & Couro', atributo: 'mente', categoria: 'Ofícios & Engenharia', desc: 'Confecção, conserto, reforço e isolamento térmico de vestimentas, tecidos e armaduras de couro.' },
  carpintaria_estruturas: { id: 'carpintaria_estruturas', nome: 'Carpintaria & Estruturas', atributo: 'mente', categoria: 'Ofícios & Engenharia', desc: 'Modelagem de madeira, construção de barricadas, portas reforçadas, barcos e estruturas de abrigo.' },
  lapidacao_joalheria: { id: 'lapidacao_joalheria', nome: 'Lapidação & Joalheria', atributo: 'mente', categoria: 'Ofícios & Engenharia', desc: 'Lapidação de cristais arcanos, focos de energia, lentes de precisão e avaliação de gemas.' },
  metalurgia_forja: { id: 'metalurgia_forja', nome: 'Metalurgia & Forja', atributo: 'mente', categoria: 'Ofícios & Engenharia', desc: 'Forja, têmpera, reparo e aprimoramento de armas brancas de aço, placas de armadura e escudos.' },
  quimica_alquimia: { id: 'quimica_alquimia', nome: 'Química & Alquimia', atributo: 'mente', categoria: 'Ofícios & Engenharia', desc: 'Produção de poções restauradoras, ácidos corrosivos, venenos, antídotos e compostos herméticos.' },
  engenharia_eletrica_mecanica: { id: 'engenharia_eletrica_mecanica', nome: 'Engenharia Elétrica & Mecânica', atributo: 'mente', categoria: 'Ofícios & Engenharia', desc: 'Manutenção de circuitos, geradores rúnicos, automações, fechaduras complexas e próteses.' },

  // === 4. INVESTIGAÇÃO, PERCEPÇÃO & LADINAGEM ===
  percepcao_fina_audicao: { id: 'percepcao_fina_audicao', nome: 'Percepção Fina & Audição', atributo: 'mente', categoria: 'Investigação, Percepção & Ladinagem', desc: 'Detecção de sussurros, estalos distantes, passos nas sombras e pequenos detalhes visuais no ambiente.' },
  hackeamento_criptografia: { id: 'hackeamento_criptografia', nome: 'Hackeamento & Criptografia', atributo: 'mente', categoria: 'Investigação, Percepção & Ladinagem', desc: 'Invasão de redes digitais, descriptografia de códigos, bypass de terminais e codex de dados.' },
  interrogatorio_intimidacao: { id: 'interrogatorio_intimidacao', nome: 'Interrogatório & Intimidação', atributo: 'social', categoria: 'Investigação, Percepção & Ladinagem', desc: 'Obtenção de confissões e pistas secretas através de pressão psicológica, postura ameaçadora ou blefe.' },
  investigacao_deducao: { id: 'investigacao_deducao', nome: 'Investigação & Dedução', atributo: 'mente', categoria: 'Investigação, Percepção & Ladinagem', desc: 'Análise metódica de cenas de crime, reconstituição de eventos, cruzamento de pistas e resolução de mistérios.' },
  ladinagem_arrombamento: { id: 'ladinagem_arrombamento', nome: 'Ladinagem & Arrombamento', atributo: 'mente', categoria: 'Investigação, Percepção & Ladinagem', desc: 'Abertura de fechaduras trancadas com gazua, desarme de armadilhas mecânicas e furto leve.' },
  rastreamento: { id: 'rastreamento', nome: 'Rastreamento', atributo: 'mente', categoria: 'Investigação, Percepção & Ladinagem', desc: 'Seguir pegadas, galhos quebrados, manchas de sangue e rastros deixados por alvos na terra ou cidades.' },
  intuicao_sentido_psiquico: { id: 'intuicao_sentido_psiquico', nome: 'Intuição & Sentido Psíquico', atributo: 'espirito', categoria: 'Investigação, Percepção & Ladinagem', desc: 'Percepção empática para notar mentiras, pressentir emboscadas ocultas ou intenções malignas.' },

  // === 5. CONHECIMENTO INTELECTUAL & ERUDIÇÃO ===
  cartografia_navegacao: { id: 'cartografia_navegacao', nome: 'Cartografia & Navegação', atributo: 'mente', categoria: 'Conhecimento Intelectual & Erudição', desc: 'Leitura e confecção de mapas topográficos detalhados, triangulação de rotas e orientação.' },
  ciencias_naturais_fisica: { id: 'ciencias_naturais_fisica', nome: 'Ciências Naturais & Física', atributo: 'mente', categoria: 'Conhecimento Intelectual & Erudição', desc: 'Compreensão de leis naturais, balística, cinemática, gravidade, mineralogia e geologia.' },
  historia_arqueologia: { id: 'historia_arqueologia', nome: 'História & Arqueologia', atributo: 'mente', categoria: 'Conhecimento Intelectual & Erudição', desc: 'Domínio sobre dinastias esquecidas, eventos antigos, monumentos em ruínas e genealogia nobre.' },
  idiomas_linguistica: { id: 'idiomas_linguistica', nome: 'Idiomas & Linguística', atributo: 'mente', categoria: 'Conhecimento Intelectual & Erudição', desc: 'Tradução de línguas mortas, dialetos regionais, códigos secretos e comunicação poliglota fluente.' },
  medicina_campo_cirurgia: { id: 'medicina_campo_cirurgia', nome: 'Medicina de Campo & Cirurgia', atributo: 'mente', categoria: 'Conhecimento Intelectual & Erudição', desc: 'Diagnóstico de moléstias, cirurgias de trauma, suturas complexas, amputações e estabilização de feridos graves.' },
  primeiros_socorros_paramedicina: { id: 'primeiros_socorros_paramedicina', nome: 'Primeiros Socorros & Paramedicina', atributo: 'mente', categoria: 'Conhecimento Intelectual & Erudição', desc: 'Cuidados rápidos com bandagens estéreis, estancamento de hemorragias e reanimação de choque em combate.' },
  gastronomia_nutricao: { id: 'gastronomia_nutricao', nome: 'Gastronomia & Nutrição', atributo: 'mente', categoria: 'Conhecimento Intelectual & Erudição', desc: 'Culinária avançada, conservação de rações de expedição e preparo de banquetes restauradores de Anima.' },

  // === 6. EXPRESSÃO CULTURAL & SOCIAL ===
  diplomacia_negociacao: { id: 'diplomacia_negociacao', nome: 'Diplomacia & Negociação', atributo: 'social', categoria: 'Expressão Cultural & Social', desc: 'Mediação de conflitos, barganha comercial vantajosa, acordos de paz e etiqueta nobre.' },
  enganacao_disfarce: { id: 'enganacao_disfarce', nome: 'Enganação & Disfarce', atributo: 'social', categoria: 'Expressão Cultural & Social', desc: 'Criar identidades falsas, mentir com convicção absoluta e forjar documentos convincentes.' },
  performance_musica: { id: 'performance_musica', nome: 'Performance & Música', atributo: 'social', categoria: 'Expressão Cultural & Social', desc: 'Tocar instrumentos musicais, cantar, atuar em palco, inspirar multidões e elevar a moral do grupo.' },
  psicologia_empatia: { id: 'psicologia_empatia', nome: 'Psicologia & Empatia', atributo: 'social', categoria: 'Expressão Cultural & Social', desc: 'Análise psicológica do comportamento humano, suporte para crises de pânico e leitura de motivações.' },

  // === 7. ARTES MÍSTICAS, OCULTISMO & MAGIA ===
  ocultismo_teoria_arcana: { id: 'ocultismo_teoria_arcana', nome: 'Ocultismo & Teoria Arcana', atributo: 'espirito', categoria: 'Artes Místicas, Ocultismo & Magia', desc: 'Identificação de runas, círculos mágicos, criaturas do Vazio, maldições e análise de fenômenos esotéricos.' },
  divinacao_oraculos: { id: 'divinacao_oraculos', nome: 'Divinação & Oráculos', atributo: 'espirito', categoria: 'Artes Místicas, Ocultismo & Magia', desc: 'Práticas oraculares de leitura do futuro e revelação do oculto através de tarô, runas e astrologia.' },
  invocacao_canalizacao: { id: 'invocacao_canalizacao', nome: 'Invocação & Canalização', atributo: 'espirito', categoria: 'Artes Místicas, Ocultismo & Magia', desc: 'Arte de canalizar entidades cósmicas ou forças espirituais para dentro do próprio corpo como mediador.' },
  evocacao_espiritual: { id: 'evocacao_espiritual', nome: 'Evocação Espiritual', atributo: 'espirito', categoria: 'Artes Místicas, Ocultismo & Magia', desc: 'Chamar e projetar espíritos e elementais para o ambiente exterior sem permitir posse no usuário.' },
  encantamento_protecao: { id: 'encantamento_protecao', nome: 'Encantamento & Proteção', atributo: 'espirito', categoria: 'Artes Místicas, Ocultismo & Magia', desc: 'Conjuração de barreiras mágicas, bênçãos de proteção, auras de santuário e rituais de cura mística.' },
  transmutacao_alquimia_arcana: { id: 'transmutacao_alquimia_arcana', nome: 'Transmutação & Alquimia Arcana', atributo: 'espirito', categoria: 'Artes Místicas, Ocultismo & Magia', desc: 'Manipulação mágica da matéria e dos estados físicos, transmutando substâncias e manipulando fluxos elementais.' }
};

/**
 * Retorna as especializações do compêndio filtradas por categoria ou atributo
 */
export function getCompendiumSpecializations({ categoria = null, atributo = null } = {}) {
  let list = Object.values(SPECIALIZATIONS_CATALOG);

  if (categoria) {
    list = list.filter(item => item.categoria.toLowerCase() === categoria.toLowerCase());
  }

  if (atributo) {
    list = list.filter(item => item.atributo.toLowerCase() === atributo.toLowerCase());
  }

  return list;
}

/**
 * Consolida a lista de especializações do personagem com suporte a ranking (nível até 3)
 */
export function consolidateSpecializations(rawEsp = [], mente = 1) {
  const map = new Map();
  let totalPontos = 0;

  for (const item of (Array.isArray(rawEsp) ? rawEsp : [])) {
    if (!item) continue;
    let id = null;
    let nome = '';
    let qtd = 1;

    if (typeof item === 'string') {
      nome = item.trim();
      id = nome.toLowerCase().replace(/[^a-z0-9]/g, '_');
    } else if (typeof item === 'object') {
      id = item.id || (item.nome ? item.nome.toLowerCase().replace(/[^a-z0-9]/g, '_') : null);
      nome = item.nome || item.id || '';
      qtd = Math.max(1, Math.floor(Number(item.nivel || item.qtd || item.pontos || 1)));
    }

    if (!nome && !id) continue;

    const canon = SPECIALIZATIONS_CATALOG[id] || Object.values(SPECIALIZATIONS_CATALOG).find(s => s.nome.toLowerCase() === nome.toLowerCase());
    const finalId = canon ? canon.id : id;
    const finalNome = canon ? canon.nome : nome;
    const finalAttr = canon ? canon.atributo : 'mente';
    const finalCat = canon ? canon.categoria : 'Geral';

    const current = map.get(finalId) || { id: finalId, nome: finalNome, nivel: 0, atributo: finalAttr, categoria: finalCat };
    current.nivel += qtd;
    totalPontos += qtd;

    if (current.nivel > 3) {
      throw new Error(`A especialização "${finalNome}" não pode ultrapassar o nível 3 (+3 dados de bônus).`);
    }

    map.set(finalId, current);
  }

  if (totalPontos < mente) {
    throw new Error(`Especializações insuficientes. Você possui ${mente} pontos em Mente e deve distribuir exatamente ${mente} pontos de especialização (atual: ${totalPontos}).`);
  }

  if (totalPontos > mente) {
    throw new Error(`Excesso de especializações. Você possui ${mente} pontos em Mente e não pode alocar mais de ${mente} pontos (atual: ${totalPontos}).`);
  }

  return Array.from(map.values()).map(e => ({
    ...e,
    bonusDados: e.nivel,
    label: `${e.nome} (Nível ${e.nivel} — +${e.nivel}d6)`
  }));
}

// ==========================================
// MOTOR DE COMBATE & INICIATIVA (ALPHAD6)
// ==========================================

/**
 * Calcula a ordem de iniciativa do combate com desempate em 3 níveis
 */
export function calculateCombatInitiative(combatants = []) {
  const evaluated = combatants.map(c => {
    const corpoVal = Math.max(1, Math.floor(Number(c.corpo) || 1));
    const roll = Array.isArray(c.customRoll) ? c.customRoll : rollD6(corpoVal);
    
    const pool = evaluateD6Pool({
      dadosCount: corpoVal,
      customRolls: roll
    });

    return {
      characterId: c.characterId || c.id || `char_${Math.random().toString(36).substring(2, 7)}`,
      nome: c.nome || 'Combatente',
      corpo: corpoVal,
      dados: pool.dados,
      sucessos: pool.totalSucessos,
      somaSucessos: pool.somaSucessos,
      acoesRestantes: 4,
      reacoesDisponiveis: 0,
      status: 'ativo'
    };
  });

  // Ordenação em 3 níveis: 1. Sucessos DESC, 2. SomaSucessos DESC, 3. Atributo Corpo DESC
  evaluated.sort((a, b) => {
    if (b.sucessos !== a.sucessos) return b.sucessos - a.sucessos;
    if (b.somaSucessos !== a.somaSucessos) return b.somaSucessos - a.somaSucessos;
    return b.corpo - a.corpo;
  });

  return evaluated.map((item, idx) => ({
    ...item,
    ordem: idx + 1
  }));
}

/**
 * Gasta ações no turno de um combatente (máximo 4 por turno)
 */
export function spendCombatAction(combatantState, count = 1) {
  const spend = Math.max(1, Math.floor(Number(count) || 1));
  if (combatantState.acoesRestantes < spend) {
    throw new Error(`Ações insuficientes no turno. Disponível: ${combatantState.acoesRestantes}, Solicitado: ${spend}.`);
  }
  combatantState.acoesRestantes -= spend;
  return combatantState;
}

/**
 * Encerra o turno do combatente: ações restantes viram reações
 */
export function endCombatTurn(combatantState) {
  combatantState.reacoesDisponiveis = combatantState.acoesRestantes;
  combatantState.acoesRestantes = 0;
  return combatantState;
}

/**
 * Gasta uma reação do combatente
 */
export function spendCombatReaction(combatantState) {
  if (combatantState.reacoesDisponiveis < 1) {
    throw new Error('Nenhuma reação disponível para este personagem.');
  }
  combatantState.reacoesDisponiveis -= 1;
  return combatantState;
}

/**
 * Calcula a defesa total de um personagem
 */
export function calculateTotalDefense({ baseAttributeValue = 1, defenseItemsBonus = 0 }) {
  const base = Math.max(1, Math.floor(Number(baseAttributeValue) || 1));
  const bonus = Math.max(0, Math.floor(Number(defenseItemsBonus) || 0));
  return base + bonus;
}

/**
 * Resolve um ataque de combate (físico ou à distância/fogo) contra a defesa do alvo
 */
export function resolveCombatAttack({
  attackerName = 'Atacante',
  targetName = 'Defensor',
  attackerRoll,
  targetDefense = 1,
  weaponKey = 'arma_cortante_pequena',
  customWeapon = null,
  customDamageRoll = null
}) {
  const weapon = customWeapon || WEAPONS_CATALOG[weaponKey] || WEAPONS_CATALOG.arma_cortante_pequena;
  const sucessos = attackerRoll?.totalSucessos !== undefined ? attackerRoll.totalSucessos : 0;
  const defense = Math.max(0, Math.floor(Number(targetDefense) || 0));

  // Acerto se sucessos estritamente superiores à Defesa
  const acertou = sucessos > defense;

  if (acertou) {
    let damageResult;
    if (customDamageRoll) {
      damageResult = customDamageRoll;
    } else {
      damageResult = parseAndRollFreeExpression(weapon.dano);
    }

    return {
      acerto: true,
      attackerName,
      targetName,
      sucessosAtaque: sucessos,
      defesaAlvo: defense,
      arma: weapon.nome,
      danoExpressao: weapon.dano,
      danoTotal: damageResult.total,
      danoDados: damageResult.dados,
      contraAtaqueDisponivel: false,
      mensagem: `${attackerName} acertou ${targetName} com ${weapon.nome} (${sucessos} sucessos vs Defesa ${defense}) causando ${damageResult.total} de dano!`
    };
  }

  return {
    acerto: false,
    attackerName,
    targetName,
    sucessosAtaque: sucessos,
    defesaAlvo: defense,
    arma: weapon.nome,
    danoTotal: 0,
    contraAtaqueDisponivel: true,
    mensagem: `${attackerName} errou o ataque contra ${targetName} (${sucessos} sucessos vs Defesa ${defense}). ${targetName} pode contra-atacar usando Reação!`
  };
}

/**
 * Resolve o teste de sobrevivência para personagem no estado Morrendo
 */
export function resolveDyingCheck({
  characterId = '',
  characterName = 'Personagem',
  atributoChoice = 'corpo',
  atributoValue = 1,
  tentativaNumero = 1,
  customRoll = null
}) {
  const tentativa = Math.max(1, Math.floor(Number(tentativaNumero) || 1));
  const dificuldade = 4 + (tentativa - 1) * 2; // 4, 6, 8, 10...

  const pool = evaluateD6Pool({
    dadosCount: Math.max(1, Math.floor(Number(atributoValue) || 1)),
    dificuldade,
    atributo: atributoChoice,
    customRolls: customRoll
  });

  const sobreviveu = pool.veredicto === 'SUCESSO_TOTAL';

  return {
    characterId,
    characterName,
    tentativaNumero: tentativa,
    dificuldade,
    atributoChoice,
    dados: pool.dados,
    sucessos: pool.totalSucessos,
    sobreviveu,
    status: sobreviveu ? 'morrendo_estabilizado_rodada' : 'morto_passagem_para_o_vazio',
    mensagem: sobreviveu
      ? `${characterName} passou no teste de Morrendo (Dificuldade ${dificuldade}) e resiste mais uma rodada!`
      : `${characterName} falhou no teste de Morrendo (Dificuldade ${dificuldade}) e fez a Passagem para o Vazio.`
  };
}

// ==========================================
// SISTEMA DE PODERES (PASSIVOS & ATIVOS)
// ==========================================

export function usePower({ characterSheet = {}, power = {} }) {
  const cleanTipo = power.tipo === 'passivo' ? 'passivo' : 'ativo';
  const custoAnima = cleanTipo === 'ativo' ? Math.max(0, Math.floor(Number(power.custoAnima) || 0)) : 0;
  
  const animaAtual = Math.max(0, Math.floor(Number(characterSheet.anima) || 0));

  if (cleanTipo === 'ativo' && custoAnima > 0) {
    if (animaAtual < custoAnima) {
      throw new Error(`Anima insuficiente para manifestar este poder. Custo: ${custoAnima}, Anima atual: ${animaAtual}.`);
    }
  }

  const novaAnima = Math.max(0, animaAtual - custoAnima);
  const passagemParaOVazio = novaAnima === 0;

  return {
    sucesso: true,
    powerName: power.nome || 'Poder Oculto',
    tipo: cleanTipo,
    custoAnima,
    animaAnterior: animaAtual,
    animaAtual: novaAnima,
    passagemParaOVazio,
    sacrificioExigido: power.sacrificio || 'Nenhum',
    descricao: power.descricao || '',
    mensagem: `Poder "${power.nome || 'Poder Oculto'}" manifestado com sucesso! Custo: ${custoAnima} Anima.`
  };
}

// ==========================================
// SISTEMA DE EVOLUÇÃO DE PERSONAGEM & PROGRESSÃO DE XP
// ==========================================

/**
 * Calcula o XP necessário para avançar para o próximo nível com base no multiplicador da campanha
 */
export function calculateRequiredXP(nextLevel = 2, multiplier = 1.0) {
  const proximo = Math.max(2, Math.floor(Number(nextLevel) || 2));
  const mult = Math.max(0.5, Number(multiplier) || 1.0);
  return Math.ceil(proximo * mult);
}

/**
 * Verifica se um personagem está apto a subir de nível
 */
export function canLevelUp(characterSheet = {}, xpMultiplier = 1.0) {
  const nivelAtual = Math.max(1, Math.floor(Number(characterSheet.nivel) || 1));
  const xpAtual = Math.max(0, Math.floor(Number(characterSheet.xp_atual) || 0));
  const proximoNivel = nivelAtual + 1;
  const xpNecessario = calculateRequiredXP(proximoNivel, xpMultiplier);

  return {
    canLevelUp: xpAtual >= xpNecessario,
    nivelAtual,
    proximoNivel,
    xpAtual,
    xpNecessario,
    xpFaltante: Math.max(0, xpNecessario - xpAtual),
    multiplicador: Number(xpMultiplier) || 1.0
  };
}

/**
 * Executa a subida de nível do personagem:
 * - Incrementa o nível em +1
 * - Zera o XP acumulado (xp_atual = 0)
 * - Concede +2 pontos de atributo livres
 * - Concede +3 pontos de Anima máxima e atual
 */
export function applyLevelUp(characterSheet = {}, xpMultiplier = 1.0) {
  const check = canLevelUp(characterSheet, xpMultiplier);
  if (!check.canLevelUp) {
    throw new Error(`XP insuficiente para evoluir para o Nível ${check.proximoNivel}. Atual: ${check.xpAtual}/${check.xpNecessario} XP.`);
  }

  const sheet = JSON.parse(JSON.stringify(characterSheet));

  const novoNivel = check.proximoNivel;
  sheet.nivel = novoNivel;
  sheet.xp_atual = 0; // Zera o XP conforme a regra oficial

  sheet.pontos_atributo_disponiveis = Math.max(0, Math.floor(Number(sheet.pontos_atributo_disponiveis) || 0)) + 2;
  
  const maxAnimaAnterior = Math.max(1, Math.floor(Number(sheet.max_anima) || 20));
  const animaAnterior = Math.max(0, Math.floor(Number(sheet.anima) || maxAnimaAnterior));
  
  sheet.max_anima = maxAnimaAnterior + 3;
  sheet.anima = Math.min(sheet.max_anima, animaAnterior + 3);

  if (!Array.isArray(sheet.historico_evolucao)) {
    sheet.historico_evolucao = [];
  }

  sheet.historico_evolucao.push({
    nivel: novoNivel,
    data: new Date().toISOString(),
    beneficios: '+2 pontos de atributo, +3 de Anima máxima e atual'
  });

  return {
    sucesso: true,
    novoNivel,
    pontosAtributoDisponiveis: sheet.pontos_atributo_disponiveis,
    novaMaxAnima: sheet.max_anima,
    animaAtual: sheet.anima,
    sheet,
    mensagem: `Parabéns! O personagem evoluiu para o Nível ${novoNivel}! (+2 Pontos de Atributo, +3 de Anima).`
  };
}

/**
 * Distribui pontos de atributos pendentes e atualiza dinamicamente as estatísticas derivadas da ficha:
 * - Aumento em Mente: +1 Especialização por ponto
 * - Aumento em Mente + Social: Recalcula Riqueza Abstrata
 * - Aumento em Corpo: Recalcula Capacidade de Inventário
 * - Aumento nos Atributos: Cada ponto amplia a Anima máxima base em +1
 */
export function distributeAttributePoints(characterSheet = {}, distribution = {}) {
  const sheet = JSON.parse(JSON.stringify(characterSheet));

  if (!sheet.atributos) {
    sheet.atributos = { corpo: 1, mente: 1, social: 1, espirito: 1 };
  }

  const disponiveis = Math.max(0, Math.floor(Number(sheet.pontos_atributo_disponiveis) || 0));

  const addCorpo = Math.max(0, Math.floor(Number(distribution.corpo) || 0));
  const addMente = Math.max(0, Math.floor(Number(distribution.mente) || 0));
  const addSocial = Math.max(0, Math.floor(Number(distribution.social) || 0));
  const addEspirito = Math.max(0, Math.floor(Number(distribution.espirito) || 0));

  const totalGasto = addCorpo + addMente + addSocial + addEspirito;

  if (totalGasto <= 0) {
    throw new Error('Nenhum ponto de atributo foi especificado para distribuição.');
  }

  if (totalGasto > disponiveis) {
    throw new Error(`Pontos insuficientes para distribuição. Disponíveis: ${disponiveis}, Solicitados: ${totalGasto}.`);
  }

  // Aplica aumentos
  sheet.atributos.corpo = Math.max(1, Math.floor(Number(sheet.atributos.corpo) || 1)) + addCorpo;
  sheet.atributos.mente = Math.max(1, Math.floor(Number(sheet.atributos.mente) || 1)) + addMente;
  sheet.atributos.social = Math.max(1, Math.floor(Number(sheet.atributos.social) || 1)) + addSocial;
  sheet.atributos.espirito = Math.max(1, Math.floor(Number(sheet.atributos.espirito) || 1)) + addEspirito;

  sheet.pontos_atributo_disponiveis = disponiveis - totalGasto;

  // Se Mente subiu, ganha especializações adicionais
  if (addMente > 0) {
    sheet.especializacoes_disponiveis = Math.max(0, Math.floor(Number(sheet.especializacoes_disponiveis) || 0)) + addMente;
  }

  // Recalcula Riqueza Abstrata
  const wealth = getWealthTier({
    mente: sheet.atributos.mente,
    social: sheet.atributos.social
  });
  sheet.riqueza = wealth;

  // Recalcula bônus de Corpo no Inventário
  const slotsDadosBonus = Array.isArray(sheet.inventario_dados_iniciais) ? sheet.inventario_dados_iniciais : [3, 4];
  sheet.max_slots = slotsDadosBonus[0] + slotsDadosBonus[1] + sheet.atributos.corpo;

  // Cada ponto de atributo investido amplia a Anima máxima em +1
  sheet.max_anima = (Math.max(1, Math.floor(Number(sheet.max_anima) || 20))) + totalGasto;
  sheet.anima = Math.min(sheet.max_anima, (Math.max(0, Math.floor(Number(sheet.anima) || 0))) + totalGasto);

  return {
    sucesso: true,
    sheet,
    atributosAtualizados: sheet.atributos,
    pontosRestantes: sheet.pontos_atributo_disponiveis,
    novasEspecializacoesDisponiveis: sheet.especializacoes_disponiveis || 0,
    wealthTier: wealth,
    maxSlots: sheet.max_slots,
    novaMaxAnima: sheet.max_anima,
    mensagem: `Pontos de atributo distribuídos com sucesso! (+${totalGasto} atributos aplicados).`
  };
}

// ==========================================
// ASSISTENTE DE CRIAÇÃO & FICHA INTERATIVA ALPHAD6
// ==========================================

export const DEFAULT_EQUIPMENT_SLOTS = {
  cabeca: null,
  tronco: null,
  costas: null,
  mao_primaria: null,
  mao_secundaria: null,
  pernas: null,
  pes: null,
  acessorio_1: null,
  acessorio_2: null
};

/**
 * Calcula a Defesa consolidada e armas equipadas a partir dos itens na silhueta
 */
export function calculateEquippedDefenseAndWeapons(atributos = {}, silhueta = {}) {
  let bonusDefesaItens = 0;
  const armasEmPunho = [];

  // Avalia itens da silhueta
  for (const [slot, item] of Object.entries(silhueta || {})) {
    if (item && typeof item === 'object') {
      if (item.bonusDefesa && Number(item.bonusDefesa) > 0) {
        bonusDefesaItens += Number(item.bonusDefesa);
      }
      if (['mao_primaria', 'mao_secundaria'].includes(slot) && item.dano) {
        armasEmPunho.push({
          slot,
          nome: item.nome || 'Arma',
          dano: item.dano,
          atributo: item.atributo || 'corpo',
          tracos: Array.isArray(item.tracos) ? item.tracos : []
        });
      }
    }
  }

  // Defesa total consolidada (Base 1 + bônus de itens da silhueta)
  const defesaTotal = 1 + bonusDefesaItens;

  return {
    defesaTotal,
    bonusDefesaItens,
    armasEmPunho
  };
}

/**
 * Atualiza um slot específico da silhueta de equipamentos e recalcula o estado de combate
 */
export function updateEquipmentSlot(characterSheet = {}, slotKey, item = null) {
  const sheet = JSON.parse(JSON.stringify(characterSheet));

  if (!sheet.equipamento_silhueta) {
    sheet.equipamento_silhueta = { ...DEFAULT_EQUIPMENT_SLOTS };
  }

  if (!(slotKey in sheet.equipamento_silhueta)) {
    throw new Error(`Slot de equipamento "${slotKey}" inválido.`);
  }

  sheet.equipamento_silhueta[slotKey] = item;

  // Recalcula Defesa e armas
  const equipped = calculateEquippedDefenseAndWeapons(sheet.atributos, sheet.equipamento_silhueta);
  
  if (!sheet.sistema_estado) {
    sheet.sistema_estado = {};
  }
  sheet.sistema_estado.defesa_total = equipped.defesaTotal;
  sheet.sistema_estado.armas_ativas = equipped.armasEmPunho;

  return {
    sucesso: true,
    sheet,
    slotKey,
    itemEquipado: item,
    defesaTotal: equipped.defesaTotal,
    armasEmPunho: equipped.armasEmPunho
  };
}

/**
 * Validação rigorosa e montagem da Ficha Canônica de Personagem no AlphaD6
 */
export function validateCharacterCreationAlphaD6({
  name = '',
  sexo = 'Não informado',
  idade = 'Adulto',
  raca = 'Humano',
  nivel = 1,
  arquetipo = 'Aventureiro',
  atributos = {},
  especializacoes = [],
  contatos = [],
  poderes = [],
  lore = {},
  equipamentoSilhueta = {},
  itensMochila = [],
  customAnimaRoll = null,
  customInventoryRoll = null
}) {
  const cleanName = typeof name === 'string' ? name.trim() : '';
  if (!cleanName || cleanName.length < 2) {
    throw new Error('O nome do personagem é obrigatório (mínimo 2 caracteres).');
  }

  const cleanSexo = typeof sexo === 'string' ? sexo.trim().substring(0, 40) : 'Não informado';
  const cleanIdade = typeof idade === 'string' || typeof idade === 'number' ? String(idade).trim().substring(0, 30) : 'Adulto';
  const cleanRaca = typeof raca === 'string' ? raca.trim().substring(0, 50) : 'Humano';
  const cleanArquetipo = typeof arquetipo === 'string' && arquetipo.trim().length > 0 ? arquetipo.trim().substring(0, 80) : 'Aventureiro';
  const cleanNivel = Math.max(1, Math.floor(Number(nivel) || 1));

  // 1. Validação de Atributos (Base 1 cada + 6 pontos livres distribuídos = soma total 10 no nível 1)
  const corpo = Math.max(1, Math.floor(Number(atributos.corpo) || 1));
  const mente = Math.max(1, Math.floor(Number(atributos.mente) || 1));
  const social = Math.max(1, Math.floor(Number(atributos.social) || 1));
  const espirito = Math.max(1, Math.floor(Number(atributos.espirito) || 1));
  const somaAtributos = corpo + mente + social + espirito;

  const esperadoTotal = 4 + 6; // 10
  if (cleanNivel === 1 && somaAtributos !== esperadoTotal) {
    throw new Error(`Distribuição de atributos inválida. A soma dos 4 atributos deve ser exatamente ${esperadoTotal} (4 base + 6 livres). Atual: ${somaAtributos}.`);
  }

  // 2. Validação de Especializações Ranqueadas (Total de pontos igual a Mente, máximo nível 3 por perícia)
  const consolidatedEsp = consolidateSpecializations(especializacoes, mente);

  // 3. Validação dos 3 Contatos Obrigatórios
  const contatosValidados = validateArchetypeAndContacts({
    arquetipo: cleanArquetipo,
    contatos
  });

  // 4. Rolagens Iniciais (Anima & Slots de Inventário)
  const animaResult = calculateInitialAnima({
    atributos: { corpo, mente, social, espirito },
    customRoll: customAnimaRoll
  });

  const slotsResult = calculateMaxInventorySlots({
    corpo,
    customRoll: customInventoryRoll
  });

  const totalSlotsOcupados = Array.isArray(itensMochila) 
    ? itensMochila.reduce((acc, i) => acc + (i.slotsCarga !== undefined ? i.slotsCarga : 1), 0) 
    : 0;
  if (totalSlotsOcupados > slotsResult.maxSlots) {
    throw new Error(`Inventário sobrecarregado: os itens selecionados ocupam ${totalSlotsOcupados} slots, excedendo a capacidade máxima de ${slotsResult.maxSlots} slots.`);
  }

  // 5. Riqueza Abstrata
  const wealth = getWealthTier({ mente, social });

  // 6. Silhueta de Equipamentos e Defesa
  const silhuetaCompleta = {
    ...DEFAULT_EQUIPMENT_SLOTS,
    ...(typeof equipamentoSilhueta === 'object' ? equipamentoSilhueta : {})
  };
  const equipped = calculateEquippedDefenseAndWeapons({ corpo, mente, social, espirito }, silhuetaCompleta);

  // 7. Poderes Iniciais
  const cleanPoderes = Array.isArray(poderes) ? poderes.map((p, idx) => ({
    id: p.id || `pdr_${idx + 1}`,
    nome: typeof p.nome === 'string' ? p.nome.trim() : 'Poder Oculto',
    tipo: p.tipo === 'ativo' ? 'ativo' : 'passivo',
    custoAnima: p.tipo === 'ativo' ? Math.max(0, Math.floor(Number(p.custoAnima) || 0)) : 0,
    sacrificio: typeof p.sacrificio === 'string' ? p.sacrificio.trim() : 'Nenhum',
    descricao: typeof p.descricao === 'string' ? p.descricao.trim() : ''
  })) : [];

  // 8. Lore & Biografia
  const cleanLore = {
    historia_origem: typeof lore.historia_origem === 'string' ? lore.historia_origem.trim() : '',
    personalidade: typeof lore.personalidade === 'string' ? lore.personalidade.trim() : '',
    motivacao: typeof lore.motivacao === 'string' ? lore.motivacao.trim() : '',
    diario_anotacoes: typeof lore.diario_anotacoes === 'string' ? lore.diario_anotacoes.trim() : ''
  };

  // 9. Bloco de Variáveis de Estado do Sistema e Backend
  const sistemaEstado = {
    acoes_por_rodada: 4,
    acoes_restantes: 4,
    reacoes_disponiveis: 0,
    deslocamento_metros: 9,
    defesa_total: equipped.defesaTotal,
    iniciativa_modificador: 0,
    estado_vital: 'ativo',
    condicoes: [],
    armas_ativas: equipped.armasEmPunho,
    recursos_customizados: {}
  };

  // Montagem da Ficha Canônica
  const characterSheet = {
    sistema_id: 'alphad6',
    identidade: {
      nome: cleanName,
      sexo: cleanSexo,
      idade: cleanIdade,
      raca: cleanRaca,
      nivel: cleanNivel,
      arquetipo: cleanArquetipo
    },
    atributos: {
      corpo,
      mente,
      social,
      espirito
    },
    especializacoes: consolidatedEsp,
    especializacoes_disponiveis: 0,
    pontos_atributo_disponiveis: 0,
    nivel: cleanNivel,
    xp_atual: 0,
    max_anima: animaResult.maxAnima,
    anima: animaResult.currentAnima,
    max_slots: slotsResult.maxSlots,
    passagem_para_o_vazio: false,
    riqueza: wealth,
    inventario: {
      max_slots: slotsResult.maxSlots,
      slots_ocupados: Array.isArray(itensMochila) ? itensMochila.reduce((acc, i) => acc + (i.slotsCarga !== undefined ? i.slotsCarga : 1), 0) : 0,
      itens_mochila: Array.isArray(itensMochila) ? itensMochila : []
    },
    equipamento_silhueta: silhuetaCompleta,
    contatos: contatosValidados.contatos,
    poderes: cleanPoderes,
    lore: cleanLore,
    sistema_estado: sistemaEstado
  };

  return {
    sucesso: true,
    name: cleanName,
    sheet: characterSheet,
    mensagem: `Ficha canônica do personagem "${cleanName}" gerada com sucesso para o sistema AlphaD6.`
  };
}

export const rpgEngineService = {
  rollD6,
  evaluateD6Pool,
  resolveOpposedRoll,
  parseAndRollFreeExpression,
  parseChatRollCommand,
  getPartialSuccessThreshold,
  calculateInitialAnima,
  calculateMaxAnima,
  applyAnimaDamage,
  applyRest,
  applyRestoration,
  createDefaultWorldClock,
  advanceWorldClock,
  evaluateClockTrigger,
  validateArchetypeAndContacts,
  getWealthTier,
  calculateMaxInventorySlots,
  calculateCombatInitiative,
  spendCombatAction,
  endCombatTurn,
  spendCombatReaction,
  calculateTotalDefense,
  resolveCombatAttack,
  resolveDyingCheck,
  usePower,
  calculateRequiredXP,
  canLevelUp,
  applyLevelUp,
  distributeAttributePoints,
  calculateEquippedDefenseAndWeapons,
  updateEquipmentSlot,
  validateCharacterCreationAlphaD6,
  DEFAULT_EQUIPMENT_SLOTS,
  DIFFICULTY_TABLE,
  VALID_ATTRIBUTES,
  REST_CONFIG,
  RESTORATION_CONFIG,
  WEALTH_TIERS,
  WEAPONS_CATALOG,
  DEFENSES_CATALOG,
  ITEMS_COMPENDIUM,
  getCompendiumItems,
  SPECIALIZATIONS_CATALOG,
  getCompendiumSpecializations,
  consolidateSpecializations
};



