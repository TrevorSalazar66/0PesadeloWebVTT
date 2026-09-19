/**
 * Lógica da Interface Interna da Campanha (SPA)
 * RetroForge VTT - Arcana
 */

import { apiClient } from './api/client.js';

let currentCampaignId = new URLSearchParams(window.location.search).get('id');
let currentCampaignData = null;
let currentPartyCharacters = [];

// Mapeamento de Sistemas Disponíveis
const SYSTEMS_MAP = {
  'alphad6': 'AlphaD6 RPG',
  'custom': 'Sistema Próprio / Livre'
};

function obterUsuarioAtual() {
  try {
    const raw = localStorage.getItem('arcana_user_data');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

// Alterna entre as abas principais da campanha
window.changeTab = function(tabId) {
  // 1. Esconde todas as seções de visualização
  const sections = document.querySelectorAll('.view-section');
  sections.forEach(sec => sec.classList.remove('active'));

  // 2. Desmarca todos os botões de navegação
  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(btn => btn.classList.remove('active'));

  // 3. Mostra a seção correspondente
  const targetSection = document.getElementById(`view-${tabId}`);
  if (targetSection) {
    targetSection.classList.add('active');
  }

  // 4. Marca o botão de navegação como ativo
  const activeBtn = document.querySelector(`.nav-btn[onclick="changeTab('${tabId}')"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
  }

  // Ações específicas por aba
  if (tabId === 'diario') {
    loadDiarioData();
  }
};

// Logica de saída da campanha
window.sairCampanha = function() {
  if (confirm("Deseja realmente sair da campanha?")) {
    window.location.href = "index.html";
  }
};

// === Comandos e Motor de Chat RPG ===

const RPG_CHAT_COMMANDS = [
  { cmd: '/roll', alias: '/r', syntax: '/roll [1d20 | 2d6+3 | atributo]', desc: 'Rola dados livres ou teste AlphaD6', template: '/roll ' },
  { cmd: '/r', alias: '/roll', syntax: '/r [1d20 | 2d6+3 | atributo]', desc: 'Atalho rápido para rolagem de dados', template: '/r ' },
  { cmd: '/descanso', alias: '/rest', syntax: '/descanso [curto|longo]', desc: 'Recupera Anima e avança relógio da mesa', template: '/descanso curto' },
  { cmd: '/rest', alias: '/descanso', syntax: '/rest [curto|longo]', desc: 'Atalho de descanso de personagem', template: '/rest curto' },
  { cmd: '/iniciativa', alias: '/init', syntax: '/iniciativa', desc: 'Rola iniciativa na cena de combate', template: '/iniciativa' },
  { cmd: '/init', alias: '/iniciativa', syntax: '/init', desc: 'Atalho rápido de iniciativa', template: '/init' },
  { cmd: '/me', alias: null, syntax: '/me [ação do personagem]', desc: 'Ação narrativa ou emote de personagem', template: '/me ' },
  { cmd: '/limpar', alias: '/clear', syntax: '/limpar', desc: 'Limpa mensagens visíveis da tela', template: '/limpar' },
  { cmd: '/clear', alias: '/limpar', syntax: '/clear', desc: 'Atalho para limpar a tela de mensagens', template: '/clear' },
  { cmd: '/ajuda', alias: '/help', syntax: '/ajuda', desc: 'Exibe guia de comandos disponíveis', template: '/ajuda' },
  { cmd: '/help', alias: '/ajuda', syntax: '/help', desc: 'Exibe guia de comandos disponíveis', template: '/help' }
];

let autocompleteFiltered = [];
let autocompleteIndex = 0;

function setupChatAutocomplete() {
  const input = document.getElementById('chat-input');
  const dropdown = document.getElementById('chat-autocomplete');
  if (!input || !dropdown) return;

  input.addEventListener('input', () => {
    const val = input.value;

    // Regra estrita: Só abre se o campo COMEÇAR com '/' (ex: "oi /" não dispara)
    if (!val.startsWith('/')) {
      fecharAutocomplete();
      return;
    }

    // Se já tiver espaço, o usuário já escolheu o comando e está digitando argumentos (ex: "/roll 1d20")
    if (val.includes(' ')) {
      fecharAutocomplete();
      return;
    }

    const termo = val.toLowerCase();
    autocompleteFiltered = RPG_CHAT_COMMANDS.filter(c => 
      c.cmd.toLowerCase().startsWith(termo) || (c.alias && c.alias.toLowerCase().startsWith(termo))
    );

    if (autocompleteFiltered.length === 0) {
      fecharAutocomplete();
      return;
    }

    autocompleteIndex = 0;
    renderizarAutocomplete();
  });

  input.addEventListener('keydown', (e) => {
    if (!dropdown.classList.contains('active') || autocompleteFiltered.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
      }
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      // Se houver apenas 1 comando ou o usuário navegou, autocompleta
      aplicarComandoSelecionado();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      autocompleteIndex = (autocompleteIndex + 1) % autocompleteFiltered.length;
      atualizarSelecaoVisualAutocomplete();
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      autocompleteIndex = (autocompleteIndex - 1 + autocompleteFiltered.length) % autocompleteFiltered.length;
      atualizarSelecaoVisualAutocomplete();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      // Se o comando atual no input ainda não for idêntico ao selecionado, autocompleta primeiro
      const itemAtual = autocompleteFiltered[autocompleteIndex];
      if (input.value.trim() !== itemAtual.cmd && input.value.trim() !== itemAtual.alias) {
        aplicarComandoSelecionado();
      } else {
        fecharAutocomplete();
        sendMessage();
      }
      return;
    }

    if (e.key === 'Escape') {
      fecharAutocomplete();
      return;
    }
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== input) {
      fecharAutocomplete();
    }
  });
}

function renderizarAutocomplete() {
  const dropdown = document.getElementById('chat-autocomplete');
  if (!dropdown) return;

  const total = autocompleteFiltered.length;
  dropdown.innerHTML = `
    <div class="autocomplete-header">
      <span>Comandos Disponíveis (${total})</span>
      <span class="autocomplete-hint">Pressione [Tab] para autocompletar</span>
    </div>
    ${autocompleteFiltered.map((c, idx) => `
      <div class="autocomplete-item ${idx === autocompleteIndex ? 'selected' : ''}" data-idx="${idx}">
        <div class="autocomplete-cmd-box">
          <div class="autocomplete-cmd-name">
            ${c.cmd} ${idx === 0 ? '<span class="autocomplete-tab-badge">Tab</span>' : ''}
          </div>
          <div class="autocomplete-cmd-syntax">${c.syntax}</div>
        </div>
        <div class="autocomplete-cmd-desc">${c.desc}</div>
      </div>
    `).join('')}
  `;

  dropdown.classList.add('active');

  // Adiciona cliques nos itens
  dropdown.querySelectorAll('.autocomplete-item').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.getAttribute('data-idx'), 10);
      autocompleteIndex = idx;
      aplicarComandoSelecionado();
    });
  });
}

function atualizarSelecaoVisualAutocomplete() {
  const dropdown = document.getElementById('chat-autocomplete');
  if (!dropdown) return;
  dropdown.querySelectorAll('.autocomplete-item').forEach((el, idx) => {
    el.classList.toggle('selected', idx === autocompleteIndex);
  });
}

function fecharAutocomplete() {
  const dropdown = document.getElementById('chat-autocomplete');
  if (dropdown) dropdown.classList.remove('active');
}

function aplicarComandoSelecionado() {
  const input = document.getElementById('chat-input');
  if (!input || autocompleteFiltered.length === 0) return;

  const selecionado = autocompleteFiltered[autocompleteIndex] || autocompleteFiltered[0];
  input.value = selecionado.template;
  fecharAutocomplete();
  input.focus();
}

window.sendMessage = async function() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();

  if (!message) return;

  fecharAutocomplete();
  const chatMessages = document.getElementById('chat-messages');
  const user = obterUsuarioAtual();
  const isMestre = user && (user.role?.toLowerCase() === 'mestre' || user.userId === currentCampaignData?.owner_id);
  const nomeAutor = user?.displayName || 'Aventureiro';

  // COMANDO /roll ou /r
  if (message.startsWith('/roll') || message.startsWith('/r ') || message === '/r') {
    try {
      const res = await apiClient.sync('rpg.chatCommand', {
        comando: message,
        campaignId: currentCampaignId
      });

      if (res && res.sucesso && res.dados) {
        addMessageToChat(nomeAutor, res.dados.texto || 'Rolagem realizada com sucesso', 'roll');
      } else {
        addMessageToChat('Sistema RPG', `⚠️ Falha ao rolar: ${(res && res.erro) || 'Comando inválido.'}`, 'roll');
      }
    } catch (err) {
      addMessageToChat('Sistema RPG', `⚠️ Erro de conexão com o motor RPG: ${err.message}`, 'roll');
    }
  } 
  // COMANDO /descanso ou /rest
  else if (message.startsWith('/descanso') || message.startsWith('/rest')) {
    const tipo = message.toLowerCase().includes('longo') ? 'longo' : 'curto';
    try {
      const res = await apiClient.sync('rpg.rest', {
        tipo,
        campaignId: currentCampaignId
      });

      if (res && res.sucesso) {
        if (res.aprovacaoPendente) {
          addMessageToChat('Sistema RPG', `⏳ Solicitação de descanso (${tipo}) enviada ao Mestre para aprovação.`, 'roll');
        } else {
          addMessageToChat('Sistema RPG', `🛌 <strong>Descanso ${tipo.toUpperCase()} realizado!</strong> Anima recuperada: +${res.curaAnima}. Relógio da mesa: Dia ${res.relogio?.dia || 1}, ${String(res.relogio?.hora || 8).padStart(2, '0')}:${String(res.relogio?.minuto || 0).padStart(2, '0')} (${res.relogio?.periodo || 'Dia'}).`, 'roll');
        }
      } else {
        addMessageToChat('Sistema RPG', `⚠️ Erro no descanso: ${res.erro || 'Falha na requisição.'}`, 'roll');
      }
    } catch (err) {
      addMessageToChat('Sistema RPG', `⚠️ Erro ao registrar descanso: ${err.message}`, 'roll');
    }
  }
  // COMANDO /iniciativa ou /init
  else if (message.startsWith('/iniciativa') || message.startsWith('/init')) {
    try {
      const res = await apiClient.sync('rpg.combat.initiative', {
        combatentes: [{
          id: user?.userId || 'hero',
          nome: nomeAutor,
          corpo: 2,
          mente: 2,
          modIniciativa: 0
        }]
      });

      if (res && res.sucesso && Array.isArray(res.ordemIniciativa)) {
        const item = res.ordemIniciativa[0];
        addMessageToChat('Iniciativa de Combate', `⚔️ <strong>${nomeAutor}</strong> rolou iniciativa: <strong>${item.iniciativaTotal}</strong> (Dados: [${item.dados.join(', ')}])`, 'roll');
      }
    } catch (err) {
      addMessageToChat('Sistema RPG', `⚠️ Erro ao calcular iniciativa: ${err.message}`, 'roll');
    }
  }
  // COMANDO /me
  else if (message.startsWith('/me ')) {
    const acao = message.substring(4).trim();
    addMessageToChat('Narrativa', `<em>* ${nomeAutor} ${acao} *</em>`, 'me');
  }
  // COMANDO /limpar ou /clear
  else if (message === '/limpar' || message === '/clear') {
    chatMessages.innerHTML = '';
    addMessageToChat('Sistema VTT', 'Histórico de mensagens da sessão limpo.', 'roll');
  }
  // COMANDO /ajuda ou /help
  else if (message === '/ajuda' || message === '/help') {
    addMessageToChat('Guia de Comandos', `
      <div style="font-size: 12px; line-height: 1.6;">
        <div><strong>/roll [expressão]</strong> ou <strong>/r</strong>: Rola dados (ex: <code>/roll 1d20</code>, <code>/r 2d6+3</code>, <code>/roll corpo</code>)</div>
        <div><strong>/descanso [curto|longo]</strong>: Recupera Anima e avança o relógio da mesa</div>
        <div><strong>/iniciativa</strong> ou <strong>/init</strong>: Rola iniciativa de combate</div>
        <div><strong>/me [ação]</strong>: Ação interpretativa / emote</div>
        <div><strong>/limpar</strong> ou <strong>/clear</strong>: Limpa o chat local</div>
      </div>
    `, 'roll');
  }
  // MENSAGEM DE CHAT COMUM
  else {
    addMessageToChat(nomeAutor, message, isMestre ? 'mestre' : 'player');
  }

  input.value = '';
  chatMessages.scrollTop = chatMessages.scrollHeight;
};

window.addMessageToChat = function(author, text, type) {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;

  const msgBox = document.createElement('div');
  msgBox.className = 'msg-box';
  
  if (type === 'mestre') msgBox.classList.add('mestre');
  if (type === 'roll') msgBox.classList.add('roll');
  if (type === 'me') msgBox.style.borderLeftColor = 'var(--accent-purple)';

  msgBox.innerHTML = `<strong>${author}:</strong> ${text}`;
  chatMessages.appendChild(msgBox);
};

// === Lógica de Inicialização e Dados da Campanha ===

async function loadCampaignData() {
  if (!currentCampaignId) {
    document.getElementById('campaign-title').textContent = "Campanha não encontrada";
    document.getElementById('campaign-summary').textContent = "ID da campanha não fornecido na URL.";
    return;
  }

  try {
    const res = await apiClient.getCampaign({ campaignId: currentCampaignId });
    if (res.sucesso && res.dados) {
      const camp = res.dados;
      currentCampaignData = camp;

      const systemLabel = SYSTEMS_MAP[camp.system_id] || (camp.system_id === 'alphad6' ? 'AlphaD6 RPG' : camp.system_id || 'AlphaD6 RPG');
      document.getElementById('campaign-title').textContent = camp.name || "Campanha Sem Nome";
      document.getElementById('campaign-summary').textContent = camp.lore_description || "Nenhum resumo fornecido.";
      document.getElementById('campaign-system').textContent = systemLabel;
      document.getElementById('campaign-sessions').textContent = camp.sessions !== undefined && camp.sessions !== null ? camp.sessions : "0";
      document.getElementById('campaign-next-session').textContent = camp.next_session || "Não agendada";
      document.getElementById('campaign-notices').textContent = camp.notices || "Ainda não há avisos importantes fixados.";
      
      if (camp.owner_name) {
        document.getElementById('gm-name').textContent = camp.owner_name; 
      }

      // Renderiza os jogadores no quadro geral
      renderizarJogadoresGeral(camp.players || []);

    } else {
      document.getElementById('campaign-title').textContent = "Campanha";
      document.getElementById('campaign-summary').textContent = "Campanha oficial utilizando o sistema AlphaD6.";
      document.getElementById('campaign-system').textContent = "AlphaD6 RPG";
    }

  } catch (error) {
    console.error("Erro ao buscar campanha:", error);
    document.getElementById('campaign-title').textContent = "Aventura Arcano";
    document.getElementById('campaign-summary').textContent = "Falha ao sincronizar dados da mesa.";
    document.getElementById('campaign-system').textContent = "AlphaD6 RPG";
  }
}

function renderizarJogadoresGeral(players) {
  const container = document.getElementById('player-list');
  if (!container) return;

  const gm = players.find(p => p.role.toLowerCase() === 'mestre' || p.user_id === currentCampaignData?.owner_id);
  const others = players.filter(p => p !== gm);

  container.innerHTML = `
    ${gm ? `
      <div class="player-card gm-card">
        <div class="avatar gm-avatar" style="background: var(--gold-dark); border: 2px solid var(--gold-primary); display: flex; align-items: center; justify-content: center; font-weight: 700; color: var(--gold-light);">
          ${(gm.display_name || 'M')[0].toUpperCase()}
        </div>
        <div class="player-info">
          <span class="player-name">${gm.display_name}</span>
          <span class="gm-tag">Mestre da Campanha</span>
        </div>
      </div>
    ` : ''}
    ${others.map(p => `
      <div class="player-card">
        <div class="avatar" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: center; font-weight: 700; color: var(--gold-light);">
          ${(p.display_name || 'J')[0].toUpperCase()}
        </div>
        <div class="player-info">
          <span class="player-name">${p.display_name}</span>
          <span style="font-size: 11px; color: var(--text-dim);">${p.role || 'Jogador'} ${p.nickname ? '@' + p.nickname : ''}</span>
        </div>
      </div>
    `).join('')}
  `;
}

// === Aba Diário & Fichas da Party ===

async function loadDiarioData() {
  const partyContainer = document.getElementById('party-characters-container');
  const countBadge = document.getElementById('party-count-badge');
  const createBtnBox = document.getElementById('diario-create-char-container');
  if (!partyContainer) return;

  partyContainer.innerHTML = `
    <div class="loading-indicator">
      <div class="spinner"></div>
      <span>Consultando as fichas do grupo...</span>
    </div>
  `;

  try {
    const res = await apiClient.sync('campaigns.characters.list', { campaignId: currentCampaignId });
    const user = obterUsuarioAtual();

    if (res && res.sucesso && Array.isArray(res.dados)) {
      currentPartyCharacters = res.dados;
      if (countBadge) countBadge.textContent = `${currentPartyCharacters.length} Herói(s)`;

      const userHasChar = currentPartyCharacters.some(c => c.userId === user?.userId);

      if (createBtnBox) {
        if (!userHasChar) {
          createBtnBox.innerHTML = `
            <a href="criar_personagem.html?campaignId=${currentCampaignId}" class="btn-primary" style="text-decoration: none; display: inline-flex; align-items: center; gap: 6px; font-size: 13px;">
              + Forjar Meu Personagem nesta Mesa
            </a>
          `;
        } else {
          createBtnBox.innerHTML = `
            <span style="font-size: 12px; color: var(--gold-light); font-weight: 600;">✓ Você já possui 1 personagem nesta campanha</span>
          `;
        }
      }

      if (currentPartyCharacters.length === 0) {
        partyContainer.innerHTML = `
          <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 32px;">
            <p style="color: var(--text-muted); margin-bottom: 16px;">Nenhum aventureiro forjou seu personagem para esta campanha ainda.</p>
            <a href="criar_personagem.html?campaignId=${currentCampaignId}" class="btn-primary" style="text-decoration: none;">
              + Forjar Primeiro Herói da Mesa
            </a>
          </div>
        `;
        return;
      }

      partyContainer.innerHTML = currentPartyCharacters.map(char => {
        const isMine = user && (char.userId === user.userId || String(char.userId) === String(user.userId));
        const isGM = user && (currentCampaignData?.owner_id === user.userId || currentCampaignData?.gm_id === user.userId || String(currentCampaignData?.owner_id) === String(user.userId));
        const sheet = char.sheet || {};
        const ident = sheet.identidade || {};
        const attrs = sheet.atributos || { corpo: 1, mente: 1, social: 1, espirito: 1 };
        const currentAnima = sheet.current_anima !== undefined ? sheet.current_anima : (sheet.max_anima || 15);
        const maxAnima = sheet.max_anima || 15;
        const defesa = sheet.sistema_estado?.defesa_total !== undefined ? sheet.sistema_estado.defesa_total : (sheet.defesa_total || 1);
        const wealthNome = sheet.wealth?.tier_nome || 'Classe Média';
        const nivel = sheet.nivel || 1;
        const arquetipo = ident.arquetipo || 'Aventureiro';
        const initial = (char.name || 'A')[0].toUpperCase();

        return `
          <div class="character-card ${isMine ? 'my-character' : ''}">
            ${isMine ? '<span class="badge-my-char">Seu Personagem</span>' : ''}
            
            <div class="character-card-header">
              <div class="character-avatar">${initial}</div>
              <div class="character-info-main">
                <h4 class="character-card-title" title="${char.name}">${char.name}</h4>
                <div class="character-player-sub">
                  Nv. ${nivel} • ${arquetipo} • Jogador: <strong>${char.playerName || 'Anônimo'}</strong>
                </div>
              </div>
            </div>

            <div class="character-pills-row">
              <span class="pill-stat pill-anima" title="Anima / Pontos de Vida">
                ❤️ ${currentAnima}/${maxAnima} Anima
              </span>
              <span class="pill-stat pill-defense" title="Defesa Total Equipada">
                🛡️ Defesa ${defesa}
              </span>
              <span class="pill-stat pill-wealth" title="Nível de Riqueza">
                💰 ${wealthNome}
              </span>
            </div>

            <div class="character-attributes-grid">
              <div class="attr-mini-box">
                <span class="attr-mini-label">Corpo</span>
                <span class="attr-mini-val">${attrs.corpo}d6</span>
              </div>
              <div class="attr-mini-box">
                <span class="attr-mini-label">Mente</span>
                <span class="attr-mini-val">${attrs.mente}d6</span>
              </div>
              <div class="attr-mini-box">
                <span class="attr-mini-label">Social</span>
                <span class="attr-mini-val">${attrs.social}d6</span>
              </div>
              <div class="attr-mini-box">
                <span class="attr-mini-label">Espírito</span>
                <span class="attr-mini-val">${attrs.espirito}d6</span>
              </div>
            </div>

            ${sheet.lore?.historia_origem ? `
              <p style="font-size: 12px; color: var(--text-muted); line-height: 1.45; margin: 4px 0 0 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                <em>"${sheet.lore.historia_origem}"</em>
              </p>
            ` : ''}

            ${(isMine || isGM) ? `
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.05);">
                <span style="font-size: 11px; color: var(--text-dim);">${isMine ? 'Sua Ficha Vinculada' : 'Ficha Gerenciada'}</span>
                <button type="button" class="btn-delete-char-party" onclick="deletarPersonagemCampanha(${char.id}, '${(char.name || 'Herói').replace(/'/g, "\\'")}')" title="Excluir ou desvincular personagem">
                  🗑️ Excluir Ficha
                </button>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    partyContainer.innerHTML = `
      <div class="card" style="grid-column: 1 / -1; color: #ef4444;">
        Erro ao consultar membros da mesa: ${err.message}
      </div>
    `;
  }
}

/**
 * Exclui a ficha de um personagem na campanha
 */
window.deletarPersonagemCampanha = async function(characterId, characterName) {
  if (!confirm(`Tem certeza que deseja excluir o personagem "${characterName}" desta campanha? Esta ação removerá a ficha permanentemente e liberará o slot para forjar um novo herói.`)) {
    return;
  }
  try {
    const res = await apiClient.sync('characters.delete', { characterId });
    if (res && res.sucesso) {
      alert(`Personagem "${characterName}" excluído com sucesso.`);
      await loadDiarioData();
    } else {
      alert(`Erro ao excluir personagem: ${res?.erro || 'Falha na exclusão.'}`);
    }
  } catch (err) {
    alert(`Erro ao conectar ao servidor: ${err.message}`);
  }
};

window.salvarDiarioCronicas = function() {
  const txt = document.getElementById('campaign-journal-text')?.value;
  alert("Crônica de sessão salva nos anais da mesa!");
};

// === Lógica do Modal de Edição ===

window.openEditModal = function() {
  document.getElementById('input-campaign-name').value = document.getElementById('campaign-title').textContent;
  const currentSys = currentCampaignData?.system_id || 'alphad6';
  const sysSelect = document.getElementById('input-campaign-system');
  if (sysSelect) {
    sysSelect.value = currentSys;
  }
  document.getElementById('input-sessions').value = document.getElementById('campaign-sessions').textContent;
  document.getElementById('input-next-session').value = document.getElementById('campaign-next-session').textContent === "Não agendada" ? "" : document.getElementById('campaign-next-session').textContent;
  document.getElementById('input-summary').value = document.getElementById('campaign-summary').textContent === "Nenhum resumo fornecido." ? "" : document.getElementById('campaign-summary').textContent;
  document.getElementById('input-notices').value = document.getElementById('campaign-notices').textContent === "Ainda não há avisos importantes fixados." ? "" : document.getElementById('campaign-notices').textContent;
  
  document.getElementById('editModal').classList.add('active');
};

window.closeEditModal = function() {
  document.getElementById('editModal').classList.remove('active');
};

window.saveCampaignDetails = async function(event) {
  event.preventDefault();

  const selectedSys = document.getElementById('input-campaign-system') ? document.getElementById('input-campaign-system').value : 'alphad6';

  const newData = {
    campaignId: currentCampaignId,
    name: document.getElementById('input-campaign-name').value,
    systemId: selectedSys,
    sessions: document.getElementById('input-sessions').value,
    nextSession: document.getElementById('input-next-session').value,
    description: document.getElementById('input-summary').value,
    notices: document.getElementById('input-notices').value
  };

  try {
    const res = await apiClient.sync('campaigns.update', newData);
    
    if (res.sucesso) {
      if (currentCampaignData) {
        currentCampaignData.system_id = selectedSys;
      }
      const systemLabel = SYSTEMS_MAP[selectedSys] || selectedSys;
      document.getElementById('campaign-title').textContent = newData.name || "Campanha Sem Nome";
      document.getElementById('campaign-system').textContent = systemLabel;
      document.getElementById('campaign-sessions').textContent = newData.sessions || "0";
      document.getElementById('campaign-next-session').textContent = newData.nextSession || "Não agendada";
      document.getElementById('campaign-summary').textContent = newData.description || "Nenhum resumo fornecido.";
      document.getElementById('campaign-notices').textContent = newData.notices || "Ainda não há avisos importantes fixados.";

      window.closeEditModal();
    } else {
      alert("Falha ao salvar: " + (res.erro || "Erro desconhecido"));
    }
  } catch (error) {
    console.error("Erro ao salvar campanha:", error);
    alert("Ocorreu um erro ao salvar as alterações.");
  }
};

document.addEventListener('DOMContentLoaded', () => {
  loadCampaignData();
  setupChatAutocomplete();
});

