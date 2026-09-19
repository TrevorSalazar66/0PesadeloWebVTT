import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { 
  rpgEngineService, 
  DIFFICULTY_TABLE, 
  evaluateD6Pool, 
  resolveOpposedRoll, 
  parseAndRollFreeExpression, 
  parseChatRollCommand, 
  getPartialSuccessThreshold 
} from '../src/services/rpgEngineService.js';

describe('RetroForge VTT - Motor de Regras RPG D6', () => {

  describe('1. Rolagem de Dados e Pool D6', () => {
    it('deve gerar dados entre 1 e 6', () => {
      const dados = rpgEngineService.rollD6(20);
      assert.equal(dados.length, 20);
      for (const d of dados) {
        assert.ok(d >= 1 && d <= 6, `Dado fora do intervalo D6: ${d}`);
      }
    });

    it('deve identificar sucessos (>= 4) e somar os sucessos corretamente', () => {
      const mockRolls = [6, 4, 3, 1, 5, 2]; // Sucessos: 6, 4, 5 (total 3 sucessos, soma 15)
      const resultado = evaluateD6Pool({
        dadosCount: 6,
        customRolls: mockRolls
      });

      assert.equal(resultado.totalSucessos, 3);
      assert.deepEqual(resultado.sucessos, [6, 4, 5]);
      assert.deepEqual(resultado.falhas, [3, 1, 2]);
      assert.equal(resultado.somaSucessos, 15);
    });

    it('deve calcular Sucesso Total, Parcial e Falha conforme a dificuldade', () => {
      // Dificuldade 6: Parcial = 3
      // Caso 1: Sucesso Total (6 sucessos)
      const resTotal = evaluateD6Pool({
        dificuldade: 6,
        customRolls: [6, 5, 4, 5, 4, 6] // 6 sucessos
      });
      assert.equal(resTotal.veredicto, 'SUCESSO_TOTAL');

      // Caso 2: Sucesso Parcial (4 sucessos >= 3 e < 6)
      const resParcial = evaluateD6Pool({
        dificuldade: 6,
        customRolls: [6, 5, 4, 4, 1, 2] // 4 sucessos
      });
      assert.equal(resParcial.veredicto, 'SUCESSO_PARCIAL');

      // Caso 3: Falha Total (2 sucessos < 3)
      const resFalha = evaluateD6Pool({
        dificuldade: 6,
        customRolls: [6, 5, 1, 2, 3, 2] // 2 sucessos
      });
      assert.equal(resFalha.veredicto, 'FALHA_TOTAL');
    });

    it('deve respeitar a tabela de dificuldades oficiais', () => {
      for (const [dif, info] of Object.entries(DIFFICULTY_TABLE)) {
        const threshold = getPartialSuccessThreshold(Number(dif));
        assert.equal(threshold, info.parcial, `Limiar parcial incorreto para dificuldade ${dif}`);
      }
    });
  });

  describe('2. Testes Resistidos', () => {
    it('deve dar vitória para o lado com mais sucessos', () => {
      const rollA = evaluateD6Pool({ customRolls: [6, 5, 4] }); // 3 sucessos
      const rollB = evaluateD6Pool({ customRolls: [6, 4, 1] }); // 2 sucessos

      const resultado = resolveOpposedRoll(rollA, rollB, 'Guerreiro', 'Goblin');
      assert.equal(resultado.vencedor, 'A');
      assert.equal(resultado.motivo, 'maior_quantidade_sucessos');
    });

    it('deve desempatar pela soma dos dados de sucesso quando a quantidade for igual', () => {
      // Ambos com 2 sucessos
      const rollA = evaluateD6Pool({ customRolls: [6, 5, 1, 2] }); // Sucessos 6, 5 -> soma 11
      const rollB = evaluateD6Pool({ customRolls: [4, 4, 2, 3] }); // Sucessos 4, 4 -> soma 8

      const resultado = resolveOpposedRoll(rollA, rollB, 'Ladino', 'Guarda');
      assert.equal(resultado.vencedor, 'A');
      assert.equal(resultado.motivo, 'desempate_soma_sucessos');
    });

    it('deve declarar empate quando quantidade e soma de sucessos forem idênticas', () => {
      const rollA = evaluateD6Pool({ customRolls: [5, 4, 1] }); // Sucessos 5, 4 -> soma 9
      const rollB = evaluateD6Pool({ customRolls: [4, 5, 2] }); // Sucessos 4, 5 -> soma 9

      const resultado = resolveOpposedRoll(rollA, rollB, 'Mago', 'Feiticeiro');
      assert.equal(resultado.vencedor, 'EMPATE');
      assert.equal(resultado.motivo, 'empate_absoluto');
    });
  });

  describe('3. Rolagens Livres Matemáticas', () => {
    it('deve resolver expressões como 2d6+3, 1d20-2, 3d6', () => {
      const roll1 = parseAndRollFreeExpression('2d6+3');
      assert.equal(roll1.quantidadeDados, 2);
      assert.equal(roll1.lados, 6);
      assert.equal(roll1.modificador, 3);
      assert.equal(roll1.total, roll1.somaDados + 3);

      const roll2 = parseAndRollFreeExpression('1d20-2');
      assert.equal(roll2.quantidadeDados, 1);
      assert.equal(roll2.lados, 20);
      assert.equal(roll2.modificador, -2);
      assert.equal(roll2.total, roll2.somaDados - 2);
    });

    it('deve rejeitar expressões inválidas ou com valores abusivos', () => {
      assert.throws(() => parseAndRollFreeExpression('abc'), /Formato de rolagem inválido/);
      assert.throws(() => parseAndRollFreeExpression('101d6'), /quantidade de dados deve ser entre 1 e 100/);
      assert.throws(() => parseAndRollFreeExpression('1d1001'), /número de lados/);
    });
  });

  describe('4. Parser de Comandos de Chat (/roll)', () => {
    it('deve interpretar rolagem livre no chat', () => {
      const res = parseChatRollCommand('/roll 2d6+4');
      assert.equal(res.tipo, 'rolagem_livre');
      assert.equal(res.quantidadeDados, 2);
      assert.equal(res.modificador, 4);
    });

    it('deve interpretar comandos de atributos e modificadores do sistema', () => {
      const res = parseChatRollCommand('/roll mente esp:investigacao vant:1 dif:6 ajuda:1');
      assert.equal(res.tipo, 'pool_d6');
      assert.equal(res.atributo, 'mente');
      assert.equal(res.especializacao, 'investigacao');
      assert.equal(res.vantagens, 1);
      assert.equal(res.ajudas, 1);
      assert.equal(res.dificuldade, 6);
      // Base 1 (mente sem ficha) + 1 (esp) + 1 (vant) + 1 (ajuda) = 4 dados
      assert.equal(res.dadosCount, 4);
    });

    it('deve calcular dados usando valores da ficha quando fornecida', () => {
      const sheet = {
        atributos: {
          corpo: 4,
          mente: 2
        }
      };

      const res = parseChatRollCommand('/roll corpo esp:luta_armada vant:2', sheet);
      assert.equal(res.tipo, 'pool_d6');
      assert.equal(res.atributo, 'corpo');
      assert.equal(res.especializacao, 'luta armada');
      // 4 (corpo) + 1 (esp) + 2 (vant) = 7 dados
      assert.equal(res.dadosCount, 7);
    });
  });

  describe('5. Anima e Dano (AlphaD6)', () => {
    it('deve calcular a Anima inicial pela fórmula 2d6 + soma dos atributos', () => {
      const atributos = { corpo: 3, mente: 3, social: 2, espirito: 2 }; // soma = 10
      const res = rpgEngineService.calculateInitialAnima({ atributos, customRoll: [5, 4] });
      assert.equal(res.somaAtributos, 10);
      assert.equal(res.somaDados, 9);
      assert.equal(res.maxAnima, 19);
      assert.equal(res.currentAnima, 19);
      assert.equal(res.passagemParaOVazio, false);
    });

    it('deve aplicar dano e ativar Passagem para o Vazio quando Anima chega a 0', () => {
      const dano1 = rpgEngineService.applyAnimaDamage({ currentAnima: 15, dano: 5 });
      assert.equal(dano1.animaAtual, 10);
      assert.equal(dano1.passagemParaOVazio, false);

      const danoFatal = rpgEngineService.applyAnimaDamage({ currentAnima: 10, dano: 12 });
      assert.equal(danoFatal.animaAtual, 0);
      assert.equal(danoFatal.passagemParaOVazio, true);
    });
  });

  describe('6. Motor de Descansos (AlphaD6)', () => {
    it('deve aplicar Descanso Curto (3d4, +2 horas)', () => {
      const res = rpgEngineService.applyRest({
        tipo: 'curto',
        currentAnima: 5,
        maxAnima: 20,
        customRoll: [3, 2, 4] // soma 9
      });
      assert.equal(res.duracaoHoras, 2);
      assert.equal(res.somaDados, 9);
      assert.equal(res.animaAtual, 14);
      assert.equal(res.efetivamenteCurado, 9);
    });

    it('deve respeitar o teto de Max Anima no Descanso Longo (3d6, +6 horas)', () => {
      const res = rpgEngineService.applyRest({
        tipo: 'longo',
        currentAnima: 18,
        maxAnima: 20,
        customRoll: [6, 5, 4] // soma 15
      });
      assert.equal(res.duracaoHoras, 6);
      assert.equal(res.animaAtual, 20); // Clamped no teto
      assert.equal(res.efetivamenteCurado, 2);
    });

    it('deve aplicar Descanso Completo (3d8, +8 horas)', () => {
      const res = rpgEngineService.applyRest({
        tipo: 'completo',
        currentAnima: 2,
        maxAnima: 20,
        customRoll: [7, 8, 5] // soma 20
      });
      assert.equal(res.duracaoHoras, 8);
      assert.equal(res.animaAtual, 20);
      assert.equal(res.efetivamenteCurado, 18);
    });
  });

  describe('7. Motor de Restaurações (Medicina & Itens)', () => {
    it('deve aplicar Restauração de Emergência (+6 Anima, 1 item)', () => {
      const res = rpgEngineService.applyRestoration({
        tipo: 'emergencia',
        currentAnima: 4,
        maxAnima: 20,
        itensCuraDisponiveis: 2
      });
      assert.equal(res.custoItens, 1);
      assert.equal(res.itensRestantes, 1);
      assert.equal(res.animaAtual, 10);
      assert.equal(res.efetivamenteCurado, 6);
    });

    it('deve aplicar Restauração Cuidadosa (+12 Anima, 2 itens)', () => {
      const res = rpgEngineService.applyRestoration({
        tipo: 'cuidadosa',
        currentAnima: 5,
        maxAnima: 20,
        itensCuraDisponiveis: 3
      });
      assert.equal(res.custoItens, 2);
      assert.equal(res.itensRestantes, 1);
      assert.equal(res.animaAtual, 17);
      assert.equal(res.efetivamenteCurado, 12);
    });

    it('deve aplicar Restauração Completa (100% Anima, 3 itens, +24h)', () => {
      const res = rpgEngineService.applyRestoration({
        tipo: 'completa',
        currentAnima: 3,
        maxAnima: 22,
        itensCuraDisponiveis: 3
      });
      assert.equal(res.custoItens, 3);
      assert.equal(res.itensRestantes, 0);
      assert.equal(res.animaAtual, 22);
      assert.equal(res.duracaoHoras, 24);
    });

    it('deve rejeitar restauração se não houver itens suficientes', () => {
      assert.throws(() => {
        rpgEngineService.applyRestoration({
          tipo: 'completa',
          currentAnima: 3,
          maxAnima: 20,
          itensCuraDisponiveis: 2 // Precisa de 3
        });
      }, /Itens de cura insuficientes/);
    });
  });

  describe('8. Relógio da Campanha Otimizado (Event-Driven)', () => {
    it('deve avançar horas e virar período do dia corretamente', () => {
      const clockInicial = { ano: 1, mes: 1, dia: 1, hora: 8, minuto: 0 };
      const clockAvancado = rpgEngineService.advanceWorldClock(clockInicial, { hours: 6 });
      assert.equal(clockAvancado.hora, 14);
      assert.equal(clockAvancado.periodo, 'Tarde');
    });

    it('deve avançar dias, meses e anos corretamente', () => {
      const clockInicial = { ano: 1, mes: 12, dia: 30, hora: 22, minuto: 30 };
      const clockAvancado = rpgEngineService.advanceWorldClock(clockInicial, { hours: 3 });
      assert.equal(clockAvancado.hora, 1);
      assert.equal(clockAvancado.dia, 1);
      assert.equal(clockAvancado.mes, 1);
      assert.equal(clockAvancado.ano, 2);
      assert.equal(clockAvancado.periodo, 'Madrugada');
    });

    it('deve disparar gatilho de mensagens de chat quando configurado pelo mestre', () => {
      const clock = rpgEngineService.createDefaultWorldClock();
      const triggers = { messages_threshold: 10, minutes_per_threshold: 15 };

      // Mensagem 9: não dispara
      const res1 = rpgEngineService.evaluateClockTrigger({ clock, triggers, messagesCount: 9 });
      assert.equal(res1.triggered, false);

      // Mensagem 10: dispara +15 minutos
      const res2 = rpgEngineService.evaluateClockTrigger({ clock, triggers, messagesCount: 10 });
      assert.equal(res2.triggered, true);
      assert.equal(res2.clock.minuto, 15);
    });
  });

  describe('9. Arquétipos e Validação dos 3 Contatos', () => {
    it('deve validar arquétipo e limitar contatos a no máximo 3', () => {
      const contatosInput = [
        { nome: 'Barnaby', vinculo: 'amizade', ocupacao: 'Ferreiro' },
        { nome: 'Vanya', vinculo: 'divida', ocupacao: 'Espiã' },
        { nome: 'Kael', vinculo: 'favor', ocupacao: 'Guarda' },
        { nome: 'Extra Excedente', vinculo: 'amizade', ocupacao: 'Mercador' }
      ];

      const res = rpgEngineService.validateArchetypeAndContacts({
        arquetipo: 'Erudita Renegada',
        contatos: contatosInput
      });

      assert.equal(res.arquetipo, 'Erudita Renegada');
      assert.equal(res.contatos.length, 3);
      assert.equal(res.contatos[0].nome, 'Barnaby');
      assert.equal(res.contatos[1].vinculo, 'divida');
      assert.equal(res.contatos[2].nome, 'Kael');
    });
  });

  describe('10. Riqueza Abstrata e Capacidade de Inventário', () => {
    it('deve classificar o nível de riqueza conforme a soma de Mente + Social', () => {
      // Miserável (2-3)
      assert.equal(rpgEngineService.getWealthTier({ mente: 1, social: 1 }).id, 'miseravel');
      assert.equal(rpgEngineService.getWealthTier({ mente: 1, social: 2 }).id, 'miseravel');

      // Pobre (4-7)
      assert.equal(rpgEngineService.getWealthTier({ mente: 2, social: 3 }).id, 'pobre');

      // Classe Média Baixa (8-13)
      assert.equal(rpgEngineService.getWealthTier({ mente: 5, social: 4 }).id, 'classe_media_baixa');

      // Classe Média Alta (14-17)
      assert.equal(rpgEngineService.getWealthTier({ mente: 8, social: 7 }).id, 'classe_media_alta');

      // Rico (18-21)
      assert.equal(rpgEngineService.getWealthTier({ mente: 10, social: 9 }).id, 'rico');

      // Milionário (22-24)
      assert.equal(rpgEngineService.getWealthTier({ mente: 11, social: 12 }).id, 'milionario');
    });

    it('deve calcular slots máximos de inventário como 2d6 + Corpo', () => {
      const res = rpgEngineService.calculateMaxInventorySlots({ corpo: 3, customRoll: [4, 5] });
      assert.equal(res.corpo, 3);
      assert.equal(res.somaDados, 9);
      assert.equal(res.maxSlots, 12);
    });
  });

  describe('11. Catálogo Canônico de Armas e Defesas', () => {
    it('deve possuir armas canônicas simples e de fogo registradas', () => {
      assert.ok(rpgEngineService.WEAPONS_CATALOG.arma_cortante_pequena);
      assert.equal(rpgEngineService.WEAPONS_CATALOG.arma_cortante_pequena.dano, '1d4+1');
      assert.equal(rpgEngineService.WEAPONS_CATALOG.arma_cortante_pequena.atributo, 'corpo');

      assert.ok(rpgEngineService.WEAPONS_CATALOG.fogo_grande_forte);
      assert.equal(rpgEngineService.WEAPONS_CATALOG.fogo_grande_forte.dano, '2d10+6');
      assert.equal(rpgEngineService.WEAPONS_CATALOG.fogo_grande_forte.atributo, 'mente');
    });

    it('deve possuir as 3 faixas canônicas de defesa', () => {
      assert.equal(rpgEngineService.DEFENSES_CATALOG.defesa_leve.bonusDefesa, 1);
      assert.equal(rpgEngineService.DEFENSES_CATALOG.defesa_media.bonusDefesa, 2);
      assert.equal(rpgEngineService.DEFENSES_CATALOG.defesa_pesada.bonusDefesa, 4);
    });
  });

  describe('12. Combate: Iniciativa com Desempate em 3 Níveis', () => {
    it('deve desempatar por 1. Sucessos, 2. Soma dos Sucessos, 3. Atributo Corpo', () => {
      const combatentes = [
        {
          id: 'c1',
          nome: 'Combatente 1',
          corpo: 2,
          customRoll: [6, 4] // 2 sucessos, soma = 10, corpo = 2
        },
        {
          id: 'c2',
          nome: 'Combatente 2',
          corpo: 4,
          customRoll: [6, 5, 2, 1] // 2 sucessos, soma = 11, corpo = 4 (ganha na soma de sucessos)
        },
        {
          id: 'c3',
          nome: 'Combatente 3',
          corpo: 5,
          customRoll: [6, 5, 4, 1, 2] // 3 sucessos (ganha por ter mais sucessos)
        },
        {
          id: 'c4',
          nome: 'Combatente 4',
          corpo: 5,
          customRoll: [6, 4, 1, 2, 3] // 2 sucessos, soma = 10, corpo = 5 (ganha de c1 no desempate de corpo)
        }
      ];

      const resultado = rpgEngineService.calculateCombatInitiative(combatentes);

      assert.equal(resultado[0].characterId, 'c3'); // 3 sucessos -> 1º lugar
      assert.equal(resultado[1].characterId, 'c2'); // 2 sucessos, soma 11 -> 2º lugar
      assert.equal(resultado[2].characterId, 'c4'); // 2 sucessos, soma 10, corpo 5 -> 3º lugar
      assert.equal(resultado[3].characterId, 'c1'); // 2 sucessos, soma 10, corpo 2 -> 4º lugar
    });
  });

  describe('13. Combate: Economia de Ações e Reações', () => {
    it('deve gastar ações e converter ações não utilizadas em reações ao fim do turno', () => {
      const combatente = {
        characterId: 'char_1',
        acoesRestantes: 4,
        reacoesDisponiveis: 0
      };

      rpgEngineService.spendCombatAction(combatente, 2);
      assert.equal(combatente.acoesRestantes, 2);

      rpgEngineService.endCombatTurn(combatente);
      assert.equal(combatente.acoesRestantes, 0);
      assert.equal(combatente.reacoesDisponiveis, 2); // Sobraram 2 ações que viraram reações

      rpgEngineService.spendCombatReaction(combatente);
      assert.equal(combatente.reacoesDisponiveis, 1);
    });

    it('deve lançar erro ao tentar gastar mais ações ou reações do que o disponível', () => {
      const combatente = { acoesRestantes: 1, reacoesDisponiveis: 0 };
      assert.throws(() => rpgEngineService.spendCombatAction(combatente, 2), /Ações insuficientes/);
      assert.throws(() => rpgEngineService.spendCombatReaction(combatente), /Nenhuma reação disponível/);
    });
  });

  describe('14. Combate: Ataque, Defesa, Dano e Contra-Ataque', () => {
    it('deve acertar e calcular dano quando sucessos superam a Defesa do alvo', () => {
      const attackerRoll = evaluateD6Pool({ customRolls: [6, 5, 4] }); // 3 sucessos
      const targetDefense = 2; // Defesa 2

      const attackResult = rpgEngineService.resolveCombatAttack({
        attackerName: 'Arqueiro',
        targetName: 'Orc',
        attackerRoll,
        targetDefense,
        weaponKey: 'arma_cortante_grande',
        customDamageRoll: { total: 7, dados: [5] }
      });

      assert.equal(attackResult.acerto, true);
      assert.equal(attackResult.danoTotal, 7);
      assert.equal(attackResult.contraAtaqueDisponivel, false);
    });

    it('deve errar e permitir contra-ataque quando sucessos <= Defesa do alvo', () => {
      const attackerRoll = evaluateD6Pool({ customRolls: [5, 2, 1] }); // 1 sucesso
      const targetDefense = 2; // Defesa 2

      const attackResult = rpgEngineService.resolveCombatAttack({
        attackerName: 'Guerreiro',
        targetName: 'Defensor Ágil',
        attackerRoll,
        targetDefense,
        weaponKey: 'arma_impactante_pequena'
      });

      assert.equal(attackResult.acerto, false);
      assert.equal(attackResult.danoTotal, 0);
      assert.equal(attackResult.contraAtaqueDisponivel, true);
    });
  });

  describe('15. Combate: Teste de Morrendo (Dificuldade Escalonada)', () => {
    it('deve calcular dificuldade 4 na 1ª tentativa e resistir se passar', () => {
      const res = rpgEngineService.resolveDyingCheck({
        characterName: 'Valeros',
        atributoChoice: 'corpo',
        atributoValue: 5,
        tentativaNumero: 1,
        customRoll: [6, 5, 4, 4, 1] // 4 sucessos (dificuldade 4 -> sucesso total)
      });

      assert.equal(res.dificuldade, 4);
      assert.equal(res.sobreviveu, true);
      assert.equal(res.status, 'morrendo_estabilizado_rodada');
    });

    it('deve escalar para dificuldade 6 na 2ª tentativa e morrer se falhar', () => {
      const res = rpgEngineService.resolveDyingCheck({
        characterName: 'Valeros',
        atributoChoice: 'espirito',
        atributoValue: 4,
        tentativaNumero: 2,
        customRoll: [6, 5, 4, 1] // 3 sucessos (dificuldade 6 exige 6 para sucesso total)
      });

      assert.equal(res.dificuldade, 6);
      assert.equal(res.sobreviveu, false);
      assert.equal(res.status, 'morto_passagem_para_o_vazio');
    });
  });

  describe('16. Sistema de Poderes (Passivos & Ativos)', () => {
    it('deve ativar poder passivo sem consumir Anima', () => {
      const sheet = { anima: 12 };
      const poderPassivo = { nome: 'Visão Espiritual', tipo: 'passivo', descricao: 'Enxerga o éter.' };

      const res = rpgEngineService.usePower({ characterSheet: sheet, power: poderPassivo });
      assert.equal(res.sucesso, true);
      assert.equal(res.custoAnima, 0);
      assert.equal(res.animaAtual, 12);
    });

    it('deve manifestar poder ativo deduzindo Anima', () => {
      const sheet = { anima: 15 };
      const poderAtivo = { nome: 'Rajada de Sombras', tipo: 'ativo', custoAnima: 5 };

      const res = rpgEngineService.usePower({ characterSheet: sheet, power: poderAtivo });
      assert.equal(res.sucesso, true);
      assert.equal(res.custoAnima, 5);
      assert.equal(res.animaAtual, 10);
      assert.equal(res.passagemParaOVazio, false);
    });

    it('deve impedir poder ativo se a Anima for insuficiente', () => {
      const sheet = { anima: 2 };
      const poderCaro = { nome: 'Invocar Tempestade', tipo: 'ativo', custoAnima: 6 };

      assert.throws(() => {
        rpgEngineService.usePower({ characterSheet: sheet, power: poderCaro });
      }, /Anima insuficiente/);
    });
  });

  describe('17. Progressão de XP e Multiplicadores de Campanha', () => {
    it('deve calcular XP necessário com multiplicador padrão (1.0x)', () => {
      assert.equal(rpgEngineService.calculateRequiredXP(2, 1.0), 2);
      assert.equal(rpgEngineService.calculateRequiredXP(3, 1.0), 3);
      assert.equal(rpgEngineService.calculateRequiredXP(4, 1.0), 4);
    });

    it('deve calcular XP necessário com multiplicador 1.5x e 2.0x', () => {
      // 1.5x: Nível 2 = ceil(2 * 1.5) = 3; Nível 3 = ceil(3 * 1.5) = 5
      assert.equal(rpgEngineService.calculateRequiredXP(2, 1.5), 3);
      assert.equal(rpgEngineService.calculateRequiredXP(3, 1.5), 5);

      // 2.0x: Nível 2 = 4; Nível 3 = 6
      assert.equal(rpgEngineService.calculateRequiredXP(2, 2.0), 4);
      assert.equal(rpgEngineService.calculateRequiredXP(3, 2.0), 6);
    });

    it('deve validar se o personagem pode subir de nível (canLevelUp)', () => {
      const sheet = { nivel: 1, xp_atual: 1 };
      const check1 = rpgEngineService.canLevelUp(sheet, 1.0); // Precisa de 2, tem 1
      assert.equal(check1.canLevelUp, false);
      assert.equal(check1.xpFaltante, 1);

      sheet.xp_atual = 2;
      const check2 = rpgEngineService.canLevelUp(sheet, 1.0);
      assert.equal(check2.canLevelUp, true);
      assert.equal(check2.xpFaltante, 0);
    });
  });

  describe('18. Mecânica de Evolução de Nível (Level Up)', () => {
    it('deve incrementar nível, zerar XP, conceder +2 atributos e +3 de Anima', () => {
      const sheet = {
        nivel: 1,
        xp_atual: 3, // Tem 3 XP (precisa de 2)
        max_anima: 18,
        anima: 15,
        pontos_atributo_disponiveis: 0
      };

      const res = rpgEngineService.applyLevelUp(sheet, 1.0);
      assert.equal(res.sucesso, true);
      assert.equal(res.novoNivel, 2);
      assert.equal(res.sheet.nivel, 2);
      assert.equal(res.sheet.xp_atual, 0); // ZERADO conforme a regra
      assert.equal(res.sheet.pontos_atributo_disponiveis, 2); // +2 pontos
      assert.equal(res.sheet.max_anima, 21); // 18 + 3
      assert.equal(res.sheet.anima, 18); // 15 + 3
      assert.equal(res.sheet.historico_evolucao.length, 1);
    });

    it('deve rejeitar subida de nível se não tiver XP suficiente', () => {
      const sheet = { nivel: 2, xp_atual: 2 }; // Nível 2 -> 3 precisa de 3 XP
      assert.throws(() => {
        rpgEngineService.applyLevelUp(sheet, 1.0);
      }, /XP insuficiente/);
    });
  });

  describe('19. Distribuição de Atributos e Impactos Dinâmicos na Ficha', () => {
    it('deve distribuir atributos, gerar especializações ao subir Mente e recalcular Riqueza, Slots e Anima', () => {
      const sheet = {
        nivel: 2,
        pontos_atributo_disponiveis: 2,
        atributos: { corpo: 2, mente: 3, social: 2, espirito: 2 },
        especializacoes_disponiveis: 0,
        inventario_dados_iniciais: [4, 3], // soma 7
        max_anima: 21,
        anima: 18
      };

      // Distribui 1 em Corpo e 1 em Mente
      const res = rpgEngineService.distributeAttributePoints(sheet, { corpo: 1, mente: 1 });

      assert.equal(res.sucesso, true);
      assert.equal(res.atributosAtualizados.corpo, 3); // 2 + 1
      assert.equal(res.atributosAtualizados.mente, 4); // 3 + 1
      assert.equal(res.pontosRestantes, 0);

      // +1 Especialização conquistada pelo aumento em Mente
      assert.equal(res.novasEspecializacoesDisponiveis, 1);

      // Riqueza: Mente (4) + Social (2) = 6 -> 'pobre'
      assert.equal(res.wealthTier.id, 'pobre');
      assert.equal(res.wealthTier.somaMenteSocial, 6);

      // Slots de Inventário: Dados (7) + Corpo (3) = 10
      assert.equal(res.maxSlots, 10);

      // Anima Máxima: 21 + 2 pontos de atributos = 23
      assert.equal(res.novaMaxAnima, 23);
      assert.equal(res.sheet.anima, 20); // 18 + 2
    });

    it('deve rejeitar distribuição se tentar gastar mais pontos do que o disponível', () => {
      const sheet = {
        pontos_atributo_disponiveis: 1,
        atributos: { corpo: 1, mente: 1, social: 1, espirito: 1 }
      };

      assert.throws(() => {
        rpgEngineService.distributeAttributePoints(sheet, { corpo: 2 });
      }, /Pontos insuficientes/);
    });
  });

  describe('20. Criação de Personagem Canônica AlphaD6 (validateCharacterCreationAlphaD6)', () => {
    it('deve validar e montar a ficha completa com identidade aberta, atributos, contatos, lore e sistema_estado', () => {
      const input = {
        name: 'Vanya Salazar',
        sexo: 'Feminino',
        idade: '26 anos',
        raca: 'Humana',
        nivel: 1,
        arquetipo: 'Erudita Renegada',
        atributos: { corpo: 2, mente: 4, social: 2, espirito: 2 }, // soma 10
        especializacoes: ['Luta Armada', 'Investigação', 'Conhecimento Oculto', 'Furtividade'], // 4 para Mente 4
        contatos: [
          { nome: 'Barnaby', vinculo: 'amizade', ocupacao: 'Ferreiro' },
          { nome: 'Kael', vinculo: 'divida', ocupacao: 'Guarda' },
          { nome: 'Sterling', vinculo: 'favor', ocupacao: 'Médico' }
        ],
        lore: {
          historia_origem: 'Fugiu dos arquivos da capital.',
          personalidade: 'Metódica e observadora.',
          motivacao: 'Desvendar os segredos do Vazio.'
        },
        equipamentoSilhueta: {
          tronco: { nome: 'Defesa Reforçada', bonusDefesa: 2 },
          mao_primaria: { nome: 'Arma Cortante Grande', dano: '1d6+2' }
        },
        customAnimaRoll: [5, 4], // soma 9 + 10 = 19
        customInventoryRoll: [3, 4] // soma 7 + 2 = 9
      };

      const res = rpgEngineService.validateCharacterCreationAlphaD6(input);

      assert.equal(res.sucesso, true);
      assert.equal(res.sheet.identidade.nome, 'Vanya Salazar');
      assert.equal(res.sheet.identidade.arquetipo, 'Erudita Renegada');
      assert.equal(res.sheet.max_anima, 19);
      assert.equal(res.sheet.max_slots, 9);
      assert.equal(res.sheet.especializacoes.length, 4);
      assert.equal(res.sheet.contatos.length, 3);
      assert.equal(res.sheet.sistema_estado.acoes_por_rodada, 4);
      assert.equal(res.sheet.sistema_estado.defesa_total, 3); // Base 1 + 2 de armadura
      assert.equal(res.sheet.sistema_estado.armas_ativas.length, 1);
    });

    it('deve rejeitar se a soma dos atributos não for exatamente 10 no nível 1', () => {
      const input = {
        name: 'Falho',
        atributos: { corpo: 3, mente: 4, social: 2, espirito: 2 }, // soma 11 (inválido)
        especializacoes: ['A', 'B', 'C', 'D']
      };

      assert.throws(() => {
        rpgEngineService.validateCharacterCreationAlphaD6(input);
      }, /Distribuição de atributos inválida/);
    });

    it('deve rejeitar se faltarem especializações correspondentes a Mente', () => {
      const input = {
        name: 'Incompleto',
        atributos: { corpo: 2, mente: 4, social: 2, espirito: 2 }, // soma 10
        especializacoes: ['A', 'B'] // Precisa de 4
      };

      assert.throws(() => {
        rpgEngineService.validateCharacterCreationAlphaD6(input);
      }, /Especializações insuficientes/);
    });
  });

  describe('21. Silhueta de Equipamentos e Gestão de Slots (Paperdoll)', () => {
    it('deve equipar/desequipar slot e recalcular Defesa consolidada', () => {
      const sheet = {
        atributos: { corpo: 2, mente: 2, social: 2, espirito: 2 },
        equipamento_silhueta: { ...rpgEngineService.DEFAULT_EQUIPMENT_SLOTS },
        sistema_estado: { defesa_total: 1, armas_ativas: [] }
      };

      // Equipa Armadura Pesada (+4)
      const res1 = rpgEngineService.updateEquipmentSlot(sheet, 'tronco', { nome: 'Defesa Mestra', bonusDefesa: 4 });
      assert.equal(res1.defesaTotal, 5); // 1 + 4
      assert.equal(res1.sheet.sistema_estado.defesa_total, 5);

      // Equipa Arma Primária
      const res2 = rpgEngineService.updateEquipmentSlot(res1.sheet, 'mao_primaria', { nome: 'Arco e Flecha', dano: '1d6+3', atributo: 'mente' });
      assert.equal(res2.armasEmPunho.length, 1);
      assert.equal(res2.armasEmPunho[0].nome, 'Arco e Flecha');
    });
  });

});
