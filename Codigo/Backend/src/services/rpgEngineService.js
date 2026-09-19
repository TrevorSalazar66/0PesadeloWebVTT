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

export const WEALTH_TIERS = {
  milionario: { min: 22, max: 24, label: 'Milionário', nivel: 6 },
  rico: { min: 18, max: 21, label: 'Rico', nivel: 5 },
  classe_media_alta: { min: 14, max: 17, label: 'Classe Média Alta', nivel: 4 },
  classe_media_baixa: { min: 8, max: 13, label: 'Classe Média Baixa', nivel: 3 },
  pobre: { min: 4, max: 7, label: 'Pobre', nivel: 2 },
  miseravel: { min: 2, max: 3, label: 'Miserável', nivel: 1 }
};

export function getWealthTier({ mente = 1, social = 1 }) {
  const soma = Math.max(2, Math.floor(Number(mente) || 1) + Math.floor(Number(social) || 1));
  
  for (const [key, tier] of Object.entries(WEALTH_TIERS)) {
    if (soma >= tier.min && soma <= tier.max) {
      return {
        id: key,
        label: tier.label,
        somaMenteSocial: soma,
        nivel: tier.nivel
      };
    }
  }

  // Fallbacks
  if (soma > 24) {
    return { id: 'milionario', label: 'Milionário', somaMenteSocial: soma, nivel: 6 };
  }
  return { id: 'miseravel', label: 'Miserável', somaMenteSocial: soma, nivel: 1 };
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
// CATÁLOGO CANÔNICO DE ARMAS E DEFESAS
// ==========================================

export const WEAPONS_CATALOG = {
  // Armas Simples
  arma_cortante_pequena: { nome: 'Arma Cortante Pequena', dano: '1d4+1', riquezaMinima: 'miseravel', atributo: 'corpo', tracos: [] },
  arma_cortante_grande: { nome: 'Arma Cortante Grande', dano: '1d6+2', riquezaMinima: 'classe_media_baixa', atributo: 'corpo', tracos: ['Especializada'] },
  arma_impactante_pequena: { nome: 'Arma Impactante Pequena', dano: '1d6+2', riquezaMinima: 'miseravel', atributo: 'corpo', tracos: [] },
  arma_impactante_grande: { nome: 'Arma Impactante Grande', dano: '1d8+3', riquezaMinima: 'classe_media_alta', atributo: 'corpo', tracos: ['Especializada'] },
  arma_perfurante_pequena: { nome: 'Arma Perfurante Pequena', dano: '1d4+3', riquezaMinima: 'miseravel', atributo: 'corpo', tracos: [] },
  arma_perfurante_grande: { nome: 'Arma Perfurante Grande', dano: '1d6+4', riquezaMinima: 'classe_media_alta', atributo: 'corpo', tracos: ['Especializada'] },
  arco_e_flecha: { nome: 'Arco e Flecha', dano: '1d6+3', riquezaMinima: 'pobre', atributo: 'mente', tracos: ['Especializada', 'Munição (12)', 'Recarregável'] },
  arremessador: { nome: 'Arremessador', dano: '1d4+2', riquezaMinima: 'miseravel', atributo: 'mente', tracos: ['Recarregável'] },
  arma_de_haste: { nome: 'Arma de Haste', dano: '1d10+2', riquezaMinima: 'rico', atributo: 'corpo', tracos: ['Especializada', 'Longa'] },
  chicote: { nome: 'Chicote', dano: '1d8+2', riquezaMinima: 'pobre', atributo: 'mente', tracos: ['Especializada', 'Longa', 'Laço'] },
  arma_de_arremesso: { nome: 'Arma de Arremesso', dano: '1d4', riquezaMinima: 'miseravel', atributo: 'mente', tracos: ['Munição (3)'] },

  // Armas de Fogo (Todas usam Mente)
  fogo_pequena_fraca: { nome: 'Arma de Fogo Pequena e Fraca', dano: '2d4', riquezaMinima: 'pobre', atributo: 'mente', tracos: ['Especializada', 'Recarregável', 'Munição (6)'] },
  fogo_pequena_forte: { nome: 'Arma de Fogo Pequena e Forte', dano: '2d6+3', riquezaMinima: 'classe_media_baixa', atributo: 'mente', tracos: ['Especializada', 'Recarregável', 'Munição (8)'] },
  fogo_media_fraca: { nome: 'Arma de Fogo Média e Fraca', dano: '2d8+2', riquezaMinima: 'classe_media_baixa', atributo: 'mente', tracos: ['Especializada', 'Recarregável', 'Munição (12)'] },
  fogo_media_forte: { nome: 'Arma de Fogo Média e Forte', dano: '2d8+4', riquezaMinima: 'classe_media_alta', atributo: 'mente', tracos: ['Especializada', 'Recarregável', 'Munição (14)'] },
  fogo_grande_fraca: { nome: 'Arma de Fogo Grande e Fraca', dano: '2d10+4', riquezaMinima: 'classe_media_alta', atributo: 'mente', tracos: ['Especializada', 'Recarregável', 'Munição (16)'] },
  fogo_grande_forte: { nome: 'Arma de Fogo Grande e Forte', dano: '2d10+6', riquezaMinima: 'rico', atributo: 'mente', tracos: ['Especializada', 'Recarregável', 'Munição (18)'] },
  fogo_especial_fraca: { nome: 'Arma de Fogo Especial e Fraca', dano: '2d12+6', riquezaMinima: 'rico', atributo: 'mente', tracos: ['Especializada', 'Recarregável', 'Munição (20)'] },
  fogo_especial_forte: { nome: 'Arma de Fogo Especial e Forte', dano: '2d12+8', riquezaMinima: 'milionario', atributo: 'mente', tracos: ['Especializada', 'Recarregável', 'Munição (22)'] }
};

export const DEFENSES_CATALOG = {
  defesa_leve: { id: 'defesa_leve', nome: 'Defesa Básica', bonusDefesa: 1, riquezaMinima: 'pobre' },
  defesa_media: { id: 'defesa_media', nome: 'Defesa Reforçada', bonusDefesa: 2, riquezaMinima: 'classe_media_alta' },
  defesa_pesada: { id: 'defesa_pesada', nome: 'Defesa Mestra', bonusDefesa: 4, riquezaMinima: 'milionario' }
};

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

  // 2. Validação de Especializações (Exatamente igual ao valor final de Mente)
  const rawEsp = Array.isArray(especializacoes) ? especializacoes : [];
  const cleanEsp = rawEsp
    .map(e => typeof e === 'string' ? e.trim() : (e.nome || ''))
    .filter(e => e.length > 0)
    .slice(0, mente);

  if (cleanEsp.length < mente) {
    throw new Error(`Especializações insuficientes. Você possui ${mente} pontos em Mente e deve escolher ${mente} especializações (atual: ${cleanEsp.length}).`);
  }

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
    especializacoes: cleanEsp,
    especializacoes_disponiveis: 0,
    pontos_atributo_disponiveis: 0,
    nivel: cleanNivel,
    xp_atual: 0,
    max_anima: animaResult.maxAnima,
    anima: animaResult.currentAnima,
    passagem_para_o_vazio: false,
    riqueza: wealth,
    max_slots: slotsResult.maxSlots,
    inventario_dados_iniciais: slotsResult.dados,
    equipamento_silhueta: silhuetaCompleta,
    itens_mochila: Array.isArray(itensMochila) ? itensMochila : [],
    contatos: contatosValidados.contatos,
    poderes: cleanPoderes,
    lore: cleanLore,
    sistema_estado: sistemaEstado,
    historico_evolucao: [
      {
        nivel: cleanNivel,
        data: new Date().toISOString(),
        beneficios: 'Criação inicial do personagem (Nível 1)'
      }
    ],
    criado_em: new Date().toISOString()
  };

  return {
    sucesso: true,
    sheet: characterSheet,
    name: cleanName,
    mensagem: `Personagem "${cleanName}" (${cleanArquetipo}) validado e pronto para a aventura!`
  };
}

export const rpgEngineService = {
  rollSingleDie,
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
  DEFENSES_CATALOG
};


