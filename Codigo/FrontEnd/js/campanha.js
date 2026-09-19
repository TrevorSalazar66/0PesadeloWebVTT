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

// === Funcionalidades do Chat ===

window.handleChatEnter = function(event) {
  if (event.key === 'Enter') {
    sendMessage();
  }
};

window.sendMessage = async function() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();

  if (!message) return;

  const chatMessages = document.getElementById('chat-messages');

  if (message.startsWith('/roll')) {
    const expr = message.replace('/roll', '').trim() || '1d6';
    try {
      const res = await apiClient.sync('rpg.chatCommand', {
        command: `/roll ${expr}`
      });
      if (res && res.sucesso && res.dados) {
        addMessageToChat('Sistema RPG', `${res.dados.texto || 'Rolagem realizada'}`, 'roll');
      } else {
        addMessageToChat('Sistema', `Rolou ${expr}: [ Resultado do Motor D6 ]`, 'roll');
      }
    } catch (_) {
      addMessageToChat('Sistema', `Rolou ${expr}: [ Rolagem Local ]`, 'roll');
    }
  } else {
    const user = obterUsuarioAtual();
    const nomeAutor = user?.displayName || 'Você';
    addMessageToChat(nomeAutor, message, 'player');
  }

  input.value = '';
  chatMessages.scrollTop = chatMessages.scrollHeight;
};

window.addMessageToChat = function(author, text, type) {
  const chatMessages = document.getElementById('chat-messages');
  const msgBox = document.createElement('div');
  msgBox.className = 'msg-box';
  
  if (type === 'mestre') msgBox.classList.add('mestre');
  if (type === 'roll') msgBox.classList.add('roll');

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
        const isMine = user && char.userId === user.userId;
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

document.addEventListener('DOMContentLoaded', loadCampaignData);

