/**
 * Controlador do Assistente de Criação de Personagens (AlphaD6)
 * RetroForge VTT - Arcana
 */

import { apiClient } from './api/client.js';

let passoAtual = 1;
const totalPassos = 6;

// Estado da criação
const criacaoState = {
  atributos: {
    corpo: 1,
    mente: 1,
    social: 1,
    espirito: 1
  },
  pontosLivresRestantes: 6,
  especializacoes: []
};

document.addEventListener('DOMContentLoaded', async () => {
  renderizarCamposEspecializacoes();
  atualizarPreviewDefesa();
  await carregarCampanhasDisponiveis();
});

/**
 * Carrega campanhas ativas do jogador para vincular a ficha se desejado
 */
async function carregarCampanhasDisponiveis() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const preselectedCampaignId = urlParams.get('campaignId') || urlParams.get('campaign') || urlParams.get('id');

    const res = await apiClient.sync('campaigns.list');
    if (res && res.sucesso && Array.isArray(res.dados)) {
      const select = document.getElementById('input-campanha');
      if (!select) return;

      select.innerHTML = '<option value="">Ficha Avulsa (Sem Campanha)</option>';

      res.dados.forEach(camp => {
        const opt = document.createElement('option');
        opt.value = camp.id;
        opt.textContent = `${camp.name} (${camp.system_id || 'AlphaD6'})`;
        if (preselectedCampaignId && (camp.id === preselectedCampaignId || String(camp.id) === String(preselectedCampaignId))) {
          opt.selected = true;
        }
        select.appendChild(opt);
      });
    }
  } catch (err) {
    console.warn('Falha ao listar campanhas para vinculação:', err);
  }
}

/**
 * Altera um atributo no Passo 2
 */
function alterarAtributo(attr, delta) {
  if (delta > 0) {
    if (criacaoState.pontosLivresRestantes <= 0) return;
    criacaoState.atributos[attr] += 1;
    criacaoState.pontosLivresRestantes -= 1;
  } else if (delta < 0) {
    if (criacaoState.atributos[attr] <= 1) return; // Mínimo 1
    criacaoState.atributos[attr] -= 1;
    criacaoState.pontosLivresRestantes += 1;
  }

  // Atualiza interface
  document.getElementById(`val-${attr}`).textContent = criacaoState.atributos[attr];
  document.getElementById(`badge-${attr}`).textContent = `${criacaoState.atributos[attr]}d6`;
  document.getElementById('pontos-restantes-banner').textContent = criacaoState.pontosLivresRestantes;

  // Se alterou Mente, atualiza a quantidade de especializações no Passo 3
  if (attr === 'mente') {
    renderizarCamposEspecializacoes();
  }

  atualizarResumo();
}

/**
 * Renderiza os campos de especialização conforme o valor de Mente
 */
function renderizarCamposEspecializacoes() {
  const container = document.getElementById('container-especializacoes');
  if (!container) return;

  const totalMente = criacaoState.atributos.mente;
  container.innerHTML = '';

  for (let i = 1; i <= totalMente; i++) {
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';

    const label = document.createElement('label');
    label.className = 'form-label';
    label.textContent = `Especialização ${i} * (Mente ${i}º Ponto)`;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-control esp-input';
    input.placeholder = `Ex: Especialização ${i}...`;
    input.id = `esp-${i}`;
    input.required = true;

    formGroup.appendChild(label);
    formGroup.appendChild(input);
    container.appendChild(formGroup);
  }
}

/**
 * Aplica sugestão clicada no primeiro campo de especialização vazio
 */
function aplicarSugestaoEsp(sugestao) {
  const inputs = document.querySelectorAll('.esp-input');
  for (const input of inputs) {
    if (!input.value || input.value.trim() === '') {
      input.value = sugestao;
      break;
    }
  }
}

/**
 * Atualiza o preview de Defesa na Silhueta
 */
function atualizarPreviewDefesa() {
  const selectTronco = document.getElementById('slot-tronco');
  let bonusArmadura = 0;
  if (selectTronco) {
    if (selectTronco.value === 'defesa_leve') bonusArmadura = 1;
    if (selectTronco.value === 'defesa_media') bonusArmadura = 2;
    if (selectTronco.value === 'defesa_pesada') bonusArmadura = 4;
  }
  const total = 1 + bonusArmadura;
  const label = document.getElementById('preview-defesa-total');
  if (label) label.textContent = total;
}

/**
 * Atualiza os cards de resumo no Passo 6
 */
function atualizarResumo() {
  const nome = document.getElementById('input-nome')?.value || 'Sem Nome';
  const arquetipo = document.getElementById('input-arquetipo')?.value || 'Aventureiro';
  const raca = document.getElementById('input-raca')?.value || 'Humano';

  const revNome = document.getElementById('rev-nome');
  if (revNome) revNome.textContent = nome;

  const revSub = document.getElementById('rev-subtitulo');
  if (revSub) revSub.textContent = `${arquetipo} • ${raca}`;

  document.getElementById('rev-corpo').textContent = `${criacaoState.atributos.corpo}d6`;
  document.getElementById('rev-mente').textContent = `${criacaoState.atributos.mente}d6`;
  document.getElementById('rev-social').textContent = `${criacaoState.atributos.social}d6`;
  document.getElementById('rev-espirito').textContent = `${criacaoState.atributos.espirito}d6`;

  // Riqueza calculada (Mente + Social)
  const somaMS = criacaoState.atributos.mente + criacaoState.atributos.social;
  let riquezaLabel = 'Miserável';
  if (somaMS >= 22) riquezaLabel = 'Milionário';
  else if (somaMS >= 18) riquezaLabel = 'Rico';
  else if (somaMS >= 14) riquezaLabel = 'Classe Média Alta';
  else if (somaMS >= 8) riquezaLabel = 'Classe Média Baixa';
  else if (somaMS >= 4) riquezaLabel = 'Pobre';

  const revRiqueza = document.getElementById('rev-riqueza');
  if (revRiqueza) revRiqueza.textContent = `Riqueza: ${riquezaLabel} (${somaMS})`;
}

/**
 * Navegação entre os passos do Wizard
 */
async function avancarPasso(direcao) {
  // Validação ao avançar
  if (direcao > 0) {
    if (passoAtual === 1) {
      const nome = document.getElementById('input-nome').value.trim();
      const arquetipo = document.getElementById('input-arquetipo').value.trim();
      if (!nome) {
        alert('Por favor, digite o nome do personagem.');
        return;
      }
      if (!arquetipo) {
        alert('Por favor, defina o arquétipo do seu personagem.');
        return;
      }
    } else if (passoAtual === 2) {
      if (criacaoState.pontosLivresRestantes > 0) {
        alert(`Você ainda possui ${criacaoState.pontosLivresRestantes} ponto(s) para distribuir nos seus atributos.`);
        return;
      }
    } else if (passoAtual === 3) {
      const inputs = document.querySelectorAll('.esp-input');
      for (const inp of inputs) {
        if (!inp.value || inp.value.trim() === '') {
          alert('Por favor, preencha todas as especializações concedidas pelo seu valor de Mente.');
          return;
        }
      }
    } else if (passoAtual === 4) {
      const c1 = document.getElementById('contato-1-nome').value.trim();
      const c2 = document.getElementById('contato-2-nome').value.trim();
      const c3 = document.getElementById('contato-3-nome').value.trim();
      if (!c1 || !c2 || !c3) {
        alert('Por favor, cadastre os 3 contatos obrigatórios do seu personagem.');
        return;
      }
    } else if (passoAtual === totalPassos) {
      // Passo final -> Submeter criação
      await submeterCriacaoPersonagem();
      return;
    }
  }

  // Altera passo
  passoAtual += direcao;
  passoAtual = Math.max(1, Math.min(totalPassos, passoAtual));

  // Atualiza visibilidade dos passos
  for (let i = 1; i <= totalPassos; i++) {
    const stepEl = document.getElementById(`step-${i}`);
    const nodeEl = document.getElementById(`node-${i}`);
    if (stepEl) {
      stepEl.classList.toggle('active', i === passoAtual);
    }
    if (nodeEl) {
      nodeEl.classList.toggle('active', i === passoAtual);
      nodeEl.classList.toggle('done', i < passoAtual);
    }
  }

  // Atualiza botões
  const btnVoltar = document.getElementById('btn-voltar');
  const btnProx = document.getElementById('btn-proximo');

  btnVoltar.style.visibility = passoAtual === 1 ? 'hidden' : 'visible';
  btnProx.textContent = passoAtual === totalPassos ? 'Concluir & Criar Personagem ⚔️' : 'Próximo Passo →';

  if (passoAtual === totalPassos) {
    atualizarResumo();
  }
}

/**
 * Envia o personagem completo ao backend via Sync Gateway
 */
async function submeterCriacaoPersonagem() {
  const btnProx = document.getElementById('btn-proximo');
  btnProx.disabled = true;
  btnProx.textContent = 'Gravando Personagem...';

  const nome = document.getElementById('input-nome').value.trim();
  const arquetipo = document.getElementById('input-arquetipo').value.trim();
  const raca = document.getElementById('input-raca').value.trim() || 'Humano';
  const sexo = document.getElementById('input-sexo').value.trim() || 'Não informado';
  const idade = document.getElementById('input-idade').value.trim() || 'Adulto';
  const campaignId = document.getElementById('input-campanha').value || null;

  // Especializações
  const especializacoes = Array.from(document.querySelectorAll('.esp-input')).map(i => i.value.trim());

  // Contatos
  const contatos = [
    {
      nome: document.getElementById('contato-1-nome').value.trim(),
      vinculo: document.getElementById('contato-1-vinculo').value,
      ocupacao: document.getElementById('contato-1-ocupacao').value.trim(),
      detalhes: document.getElementById('contato-1-detalhes').value.trim()
    },
    {
      nome: document.getElementById('contato-2-nome').value.trim(),
      vinculo: document.getElementById('contato-2-vinculo').value,
      ocupacao: document.getElementById('contato-2-ocupacao').value.trim(),
      detalhes: document.getElementById('contato-2-detalhes').value.trim()
    },
    {
      nome: document.getElementById('contato-3-nome').value.trim(),
      vinculo: document.getElementById('contato-3-vinculo').value,
      ocupacao: document.getElementById('contato-3-ocupacao').value.trim(),
      detalhes: document.getElementById('contato-3-detalhes').value.trim()
    }
  ];

  // Silhueta
  const selectTronco = document.getElementById('slot-tronco').value;
  let itemTronco = null;
  if (selectTronco === 'defesa_leve') itemTronco = { nome: 'Defesa Básica', bonusDefesa: 1 };
  if (selectTronco === 'defesa_media') itemTronco = { nome: 'Defesa Reforçada', bonusDefesa: 2 };
  if (selectTronco === 'defesa_pesada') itemTronco = { nome: 'Defesa Mestra', bonusDefesa: 4 };

  const armaKey = document.getElementById('slot-mao-primaria').value;

  const equipamentoSilhueta = {
    cabeca: document.getElementById('slot-cabeca').value.trim() ? { nome: document.getElementById('slot-cabeca').value.trim() } : null,
    tronco: itemTronco,
    costas: document.getElementById('slot-costas').value.trim() ? { nome: document.getElementById('slot-costas').value.trim() } : null,
    mao_primaria: armaKey ? { nome: armaKey.replace(/_/g, ' '), key: armaKey } : null,
    mao_secundaria: document.getElementById('slot-mao-secundaria').value.trim() ? { nome: document.getElementById('slot-mao-secundaria').value.trim() } : null,
    pernas: document.getElementById('slot-pernas').value.trim() ? { nome: document.getElementById('slot-pernas').value.trim() } : null,
    pes: document.getElementById('slot-pes').value.trim() ? { nome: document.getElementById('slot-pes').value.trim() } : null,
    acessorio_1: document.getElementById('slot-acessorios').value.trim() ? { nome: document.getElementById('slot-acessorios').value.trim() } : null,
    acessorio_2: null
  };

  // Lore
  const lore = {
    historia_origem: document.getElementById('input-historia').value.trim(),
    personalidade: document.getElementById('input-personalidade').value.trim(),
    motivacao: document.getElementById('input-motivacao').value.trim(),
    diario_anotacoes: ''
  };

  const payload = {
    action: 'rpg.character.createAlphaD6',
    data: {
      name: nome,
      arquetipo,
      raca,
      sexo,
      idade,
      nivel: 1,
      atributos: criacaoState.atributos,
      especializacoes,
      contatos,
      equipamentoSilhueta,
      lore,
      campaignId
    }
  };

  try {
    const result = await apiClient.sync('rpg.character.createAlphaD6', {
      name: nome,
      arquetipo,
      raca,
      sexo,
      idade,
      nivel: 1,
      atributos: criacaoState.atributos,
      especializacoes,
      contatos,
      equipamentoSilhueta,
      lore,
      campaignId: campaignId ? Number(campaignId) : null
    });

    if (result && result.sucesso) {
      alert(`🎉 Personagem "${nome}" criado com sucesso!`);
      if (campaignId) {
        window.location.href = `campanha.html?id=${campaignId}`;
      } else {
        window.location.href = 'index.html';
      }
    } else {
      alert(`Erro ao criar personagem: ${(result && result.erro) || 'Falha na validação dos dados.'}`);
      btnProx.disabled = false;
      btnProx.textContent = 'Concluir & Criar Personagem ⚔️';
    }
  } catch (err) {
    alert(`Erro de conexão com o servidor: ${err.message}`);
    btnProx.disabled = false;
    btnProx.textContent = 'Concluir & Criar Personagem ⚔️';
  }
}

// Exportar funções necessárias no escopo global para acionamento pelos eventos de template HTML
if (typeof window !== 'undefined') {
  window.alterarAtributo = alterarAtributo;
  window.aplicarSugestaoEsp = aplicarSugestaoEsp;
  window.atualizarPreviewDefesa = atualizarPreviewDefesa;
  window.avancarPasso = avancarPasso;
  window.submeterCriacaoPersonagem = submeterCriacaoPersonagem;
}

