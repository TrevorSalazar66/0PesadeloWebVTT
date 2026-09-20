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

// Alterna o menu gaveta da campanha em dispositivos móveis
window.toggleMobileDrawer = function(forceState) {
  const sidebar = document.getElementById('campaign-sidebar');
  const overlay = document.getElementById('drawer-overlay');
  if (!sidebar) return;

  const shouldOpen = forceState !== undefined ? forceState : !sidebar.classList.contains('mobile-open');
  if (shouldOpen) {
    sidebar.classList.add('mobile-open');
    if (overlay) overlay.classList.add('active');
  } else {
    sidebar.classList.remove('mobile-open');
    if (overlay) overlay.classList.remove('active');
  }
};

// Alterna entre as abas principais da campanha
window.changeTab = function(tabId) {
  // Fecha a gaveta mobile se aberta
  window.toggleMobileDrawer(false);

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

  // 4. Marca o botão de navegação como ativo na sidebar
  const activeBtn = document.querySelector(`.nav-btn[onclick="changeTab('${tabId}')"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
  }

  // 5. Marca o botão de navegação ativo na bottom nav mobile
  const bottomBtns = document.querySelectorAll('.bottom-nav-btn');
  bottomBtns.forEach(btn => btn.classList.remove('active'));
  const activeBottomBtn = document.getElementById(`cnav-${tabId}`);
  if (activeBottomBtn) {
    activeBottomBtn.classList.add('active');
  }

  // Ações específicas por aba
  if (tabId === 'chat') {
    loadChatHistory(true);
  } else if (tabId === 'diario') {
    loadDiarioData();
  } else if (tabId === 'config') {
    loadConfigData();
  }
};

// Logica de saída da campanha
window.sairCampanha = function() {
  if (confirm("Deseja realmente sair da campanha?")) {
    window.location.href = "index.html";
  }
};

// === Estado e Configurações do Chat da Campanha ===

let userCampaignRole = 'jogador';
let chatMessagesCache = [];
let chatPollingTimer = null;
let currentPersona = { type: 'ic', name: '', avatar: '🗡️' };
let currentReplyTo = null;

const RPG_CHAT_COMMANDS = [
  { cmd: '/roll', alias: '/r', syntax: '/roll [1d20 | 2d6+3 | corpo | mente]', desc: 'Rola dados livres ou teste AlphaD6', template: '/roll ' },
  { cmd: '/r', alias: '/roll', syntax: '/r [1d20 | 2d6+3 | atributo]', desc: 'Atalho rápido de rolagem de dados', template: '/r ' },
  { cmd: '/gmroll', alias: '/gr', syntax: '/gmroll [1d20 | 2d6+3 | atributo]', desc: 'Rolagem secreta visível apenas ao Mestre', template: '/gmroll ' },
  { cmd: '/gr', alias: '/gmroll', syntax: '/gr [expressão]', desc: 'Atalho rápido para rolagem secreta ao Mestre', template: '/gr ' },
  { cmd: '/w', alias: '/whisper', syntax: '/w [nome ou @nick] [mensagem]', desc: 'Sussurra uma mensagem privada a um participante', template: '/w ' },
  { cmd: '/whisper', alias: '/w', syntax: '/whisper [nome ou @nick] [mensagem]', desc: 'Sussurro privado a um jogador ou Mestre', template: '/whisper ' },
  { cmd: '/me', alias: null, syntax: '/me [ação do personagem]', desc: 'Ação narrativa ou emote de personagem', template: '/me ' },
  { cmd: '/ooc', alias: '/b', syntax: '/ooc [mensagem]', desc: 'Fala fora do personagem (Out Of Character)', template: '/ooc ' },
  { cmd: '/b', alias: '/ooc', syntax: '/b [mensagem]', desc: 'Atalho de fala fora do jogo (OOC)', template: '/b ' },
  { cmd: '/gm', alias: null, syntax: '/gm [narração solene]', desc: 'Narração de cena solene do Mestre', template: '/gm ' },
  { cmd: '/npc', alias: null, syntax: '/npc [Nome] [fala]', desc: 'Fala ou ação através de um NPC da cena', template: '/npc ' },
  { cmd: '/descanso', alias: '/rest', syntax: '/descanso [curto|longo]', desc: 'Recupera Anima e avança relógio da mesa', template: '/descanso curto' },
  { cmd: '/rest', alias: '/descanso', syntax: '/rest [curto|longo]', desc: 'Atalho de descanso de personagem', template: '/rest curto' },
  { cmd: '/iniciativa', alias: '/init', syntax: '/iniciativa', desc: 'Rola iniciativa na cena de combate', template: '/iniciativa' },
  { cmd: '/init', alias: '/iniciativa', syntax: '/init', desc: 'Atalho rápido de iniciativa', template: '/init' },
  { cmd: '/limpar', alias: '/clear', syntax: '/limpar', desc: 'Limpa o histórico de mensagens da mesa', template: '/limpar' },
  { cmd: '/clear', alias: '/limpar', syntax: '/clear', desc: 'Atalho para limpar histórico de mensagens', template: '/clear' },
  { cmd: '/ajuda', alias: '/help', syntax: '/ajuda', desc: 'Exibe guia de comandos disponíveis no chat', template: '/ajuda' },
  { cmd: '/help', alias: '/ajuda', syntax: '/help', desc: 'Exibe guia de comandos disponíveis no chat', template: '/help' }
];

let autocompleteFiltered = [];
let autocompleteIndex = 0;

function setupChatAutocomplete() {
  const input = document.getElementById('chat-input');
  const dropdown = document.getElementById('chat-autocomplete');
  if (!input || !dropdown) return;

  input.addEventListener('input', () => {
    const val = input.value;

    if (!val.startsWith('/')) {
      fecharAutocomplete();
      return;
    }

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
      <span>Comandos do RPG (${total})</span>
      <span class="autocomplete-hint">[Tab] autocompleta</span>
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

// === Carregamento e Polling do Histórico do Chat ===

window.loadChatHistory = async function(forceScroll = false) {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages || !currentCampaignId) return;

  try {
    const res = await apiClient.sync('chat.getHistory', { campaignId: currentCampaignId });
    const messages = Array.isArray(res?.dados) 
      ? res.dados 
      : (Array.isArray(res?.mensagens) ? res.mensagens : (Array.isArray(res) ? res : null));

    if (res && res.sucesso && messages !== null) {
      userCampaignRole = res.userRole || userCampaignRole || 'jogador';

      // Atualiza visibilidade de ferramentas exclusivas de Mestre
      atualizarControlesMestreChat();

      // Checa se o cache mudou para evitar repinturas desnecessárias
      const hasChanged = JSON.stringify(messages) !== JSON.stringify(chatMessagesCache);
      if (hasChanged || forceScroll) {
        const wasAtBottom = (chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight) < 80;
        chatMessagesCache = messages;
        renderizarListaMensagensChat(messages);

        if (wasAtBottom || forceScroll) {
          setTimeout(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
          }, 40);
        }
        
        // Se mudou e eu for o Líder P2P, aviso os outros
        if (hasChanged && typeof window.notificarChatAtualizado === 'function') {
          window.notificarChatAtualizado();
        }
      }

      // Atualiza status de conexão
      const statusEl = document.getElementById('chat-connection-status');
      if (statusEl) statusEl.textContent = 'Ao Vivo';
    } else {
      console.warn("Falha ao carregar histórico do chat:", res?.erro);
    }
  } catch (err) {
    console.error("Erro ao sincronizar mensagens do chat:", err);
    const statusEl = document.getElementById('chat-connection-status');
    if (statusEl) statusEl.textContent = 'Reconectando...';
  }
};

function iniciarChatPolling() {
  if (chatPollingTimer) clearInterval(chatPollingTimer);
  chatPollingTimer = setInterval(() => {
    const chatView = document.getElementById('view-chat');
    if (chatView && chatView.classList.contains('active')) {
      // Se não houver líder eleito ou eu for o líder, faço polling rápido.
      // Se eu for follower, polling de fallback bem mais lento (15s)
      const pollingAllowed = (typeof isP2PLeader === 'undefined' || isP2PLeader) ? true : (Date.now() % 15000 < 3500);
      
      if (pollingAllowed) {
        loadChatHistory(false);
      }
    }
  }, 3500);
}

function atualizarControlesMestreChat() {
  const user = obterUsuarioAtual();
  const isGM = (userCampaignRole === 'mestre' || userCampaignRole === 'assistente de mestre' || user?.userId === currentCampaignData?.owner_id);

  const btnClearHistory = document.getElementById('btn-chat-clear-history');
  if (btnClearHistory) {
    btnClearHistory.style.display = isGM ? 'inline-flex' : 'none';
  }

  const optGm = document.getElementById('opt-persona-gm');
  const optNpc = document.getElementById('opt-persona-npc');
  if (optGm) optGm.style.display = isGM ? 'flex' : 'none';
  if (optNpc) optNpc.style.display = isGM ? 'flex' : 'none';

  // Configura o nome do personagem do jogador se disponível
  const charOptName = document.getElementById('persona-menu-char-name');
  if (charOptName) {
    const userChar = currentPartyCharacters.find(c => c.userId === user?.userId);
    if (userChar && userChar.nome) {
      charOptName.textContent = userChar.nome;
      if (!currentPersona.name && currentPersona.type === 'ic') {
        currentPersona.name = userChar.nome;
      }
    } else {
      charOptName.textContent = user?.displayName || 'Meu Personagem';
      if (!currentPersona.name && currentPersona.type === 'ic') {
        currentPersona.name = user?.displayName || 'Meu Personagem';
      }
    }
  }
}

function renderizarListaMensagensChat(messages) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  if (messages.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-dim); padding: 48px 16px;">
        <div style="font-size: 32px; margin-bottom: 12px;">📜</div>
        <div style="font-family: var(--font-title); font-size: 16px; color: var(--gold-light); margin-bottom: 6px;">
          A Crônica Começa Aqui
        </div>
        <p style="font-size: 13px; max-width: 400px; margin: 0 auto; line-height: 1.5;">
          Nenhuma mensagem registrada nesta mesa ainda. Lance dados com <code>/roll</code>, descreva ações com <code>/me</code> ou converse com o grupo!
        </p>
      </div>
    `;
    return;
  }

  const user = obterUsuarioAtual();
  const isGM = (userCampaignRole === 'mestre' || userCampaignRole === 'assistente de mestre' || user?.userId === currentCampaignData?.owner_id);

  container.innerHTML = messages.map(msg => renderChatMessageHTML(msg, user, isGM)).join('');
}

function renderChatMessageHTML(msg, currentUser, isGM) {
  const isMine = currentUser && (msg.user_id === currentUser.userId);
  const canDelete = isMine || isGM;
  const timeStr = msg.created_at ? new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
  
  const typeClass = `msg-card-${msg.msg_type || 'ic'}`;
  const roleBadge = formatarBadgePapel(msg.author_role, msg.msg_type, msg.is_secret);

  // Avatar do autor
  const initial = (msg.author_name || 'A')[0].toUpperCase();
  const avatarContent = msg.author_avatar && msg.author_avatar.startsWith('http')
    ? `<img src="${escapeHtml(msg.author_avatar)}" alt="avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: inherit;">`
    : (msg.author_avatar || initial);

  // Bloco de citação (Reply To)
  let replyHTML = '';
  let meta = null;
  try {
    meta = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
  } catch (e) {}

  if (meta && meta.reply_to) {
    const rep = meta.reply_to;
    replyHTML = `
      <div class="chat-msg-quote">
        <span class="quote-author">💬 ${escapeHtml(rep.author || 'Alguém')}:</span>
        <span>${escapeHtml(rep.text || '')}</span>
      </div>
    `;
  }

  // Corpo principal por tipo
  let bodyHTML = '';
  if (msg.msg_type === 'roll') {
    bodyHTML = renderRollCardBody(msg, meta);
  } else if (msg.msg_type === 'action_card') {
    bodyHTML = renderActionCardBody(msg, meta, isGM);
  } else if (msg.msg_type === 'whisper') {
    const target = msg.whisper_target_name ? ` (para @${escapeHtml(msg.whisper_target_name)})` : '';
    bodyHTML = `<div class="chat-msg-text" style="color: #c4b5fd;">🔒 <em>${escapeHtml(msg.content)}${target}</em></div>`;
  } else if (msg.msg_type === 'acao') {
    bodyHTML = `<div class="chat-msg-text" style="color: #c084fc; font-style: italic;">* ${escapeHtml(msg.content)} *</div>`;
  } else if (msg.msg_type === 'narracao') {
    bodyHTML = `<div class="chat-msg-text" style="color: #fef08a; font-family: Georgia, serif; font-size: 14.5px; line-height: 1.6;">${escapeHtml(msg.content)}</div>`;
  } else if (msg.msg_type === 'ooc') {
    bodyHTML = `<div class="chat-msg-text" style="color: #94a3b8; font-style: italic;">(( ${escapeHtml(msg.content)} ))</div>`;
  } else {
    // 'ic' padrão
    bodyHTML = `<div class="chat-msg-text">${escapeHtml(msg.content)}</div>`;
  }

  const safeAuthor = (msg.author_name || 'Personagem').replace(/'/g, "\\'");
  const safeContent = (msg.content || '').replace(/'/g, "\\'").replace(/\n/g, ' ').substring(0, 50);

  return `
    <div class="chat-msg-card ${typeClass}" id="chat-msg-${msg.id}">
      <div class="chat-msg-header">
        <div class="chat-msg-author-info">
          <div class="chat-msg-avatar">${avatarContent}</div>
          <span class="chat-msg-name">${escapeHtml(msg.author_name || 'Desconhecido')}</span>
          ${roleBadge}
        </div>
        <div class="chat-msg-meta">
          <span class="chat-msg-time">${timeStr}</span>
          <div class="chat-msg-actions-hover">
            <button type="button" class="btn-msg-action" onclick="iniciarRespostaMensagem(${msg.id}, '${safeAuthor}', '${safeContent}')" title="Responder esta mensagem">
              💬
            </button>
            ${canDelete ? `
              <button type="button" class="btn-msg-action btn-msg-delete" onclick="excluirMensagem(${msg.id})" title="Excluir mensagem">
                🗑️
              </button>
            ` : ''}
          </div>
        </div>
      </div>
      <div class="chat-msg-body">
        ${replyHTML}
        ${bodyHTML}
      </div>
    </div>
  `;
}

function formatarBadgePapel(role, msgType, isSecret) {
  if (isSecret) {
    return `<span class="chat-msg-badge badge-secret">🔒 Rolagem Secreta</span>`;
  }
  if (msgType === 'whisper') {
    return `<span class="chat-msg-badge badge-whisper">🔒 Sussurro</span>`;
  }
  if (msgType === 'narracao') {
    return `<span class="chat-msg-badge badge-narracao">👑 Narração</span>`;
  }
  if (msgType === 'ooc') {
    return `<span class="chat-msg-badge badge-ooc">OOC</span>`;
  }
  if (msgType === 'acao') {
    return `<span class="chat-msg-badge badge-acao">Ação</span>`;
  }
  if (role === 'npc') {
    return `<span class="chat-msg-badge badge-npc">🎭 NPC</span>`;
  }
  if (role === 'mestre') {
    return `<span class="chat-msg-badge badge-gm">Mestre</span>`;
  }
  if (role === 'assistente de mestre') {
    return `<span class="chat-msg-badge badge-gm">Assistente</span>`;
  }
  if (role === 'sistema') {
    return `<span class="chat-msg-badge badge-system">Arcana VTT</span>`;
  }
  return `<span class="chat-msg-badge badge-player">Jogador</span>`;
}

function renderRollCardBody(msg, meta) {
  if (!meta || !meta.tipo) {
    return `<div class="chat-msg-text">${escapeHtml(msg.content)}</div>`;
  }

  // Rolagem AlphaD6
  if (meta.tipo === 'alphad6') {
    const dados = meta.dados || [];
    const sucessos = meta.sucessos || 0;
    const dano = meta.danoTotal || 0;
    const isSuccess = sucessos > 0;

    return `
      <div class="roll-result-box">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 12px; color: var(--gold-light); font-weight: 600;">
            ${meta.nomeAtributo ? `Teste de ${meta.nomeAtributo.toUpperCase()}` : 'Rolagem AlphaD6'}
          </span>
          <span style="font-size: 11px; color: var(--text-dim);">Fórmula: ${escapeHtml(meta.expressaoOriginal || '')}</span>
        </div>
        <div class="roll-dice-pool">
          ${dados.map(d => `<div class="die-face ${d >= 4 ? 'success' : ''}">${d}</div>`).join('')}
        </div>
        <div class="roll-total-pill ${isSuccess ? 'roll-success' : 'roll-fail'}">
          ${isSuccess ? `✨ ${sucessos} Sucesso(s) • Dano: ${dano}` : `💀 Falha (0 Sucessos)`}
        </div>
      </div>
    `;
  }

  // Rolagem Livre D20 / D6
  if (meta.tipo === 'livre') {
    const dados = meta.dados || [];
    const total = meta.total !== undefined ? meta.total : (dados.reduce((a, b) => a + b, 0) + (meta.modificador || 0));
    return `
      <div class="roll-result-box">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 12px; color: var(--gold-light); font-weight: 600;">
            Rolagem de Dados
          </span>
          <span style="font-size: 11px; color: var(--text-dim);">Expressão: ${escapeHtml(meta.expressaoOriginal || '')}</span>
        </div>
        <div class="roll-dice-pool">
          ${dados.map(d => `<div class="die-face">${d}</div>`).join('')}
        </div>
        <div class="roll-total-pill roll-success">
          🎯 Total: <strong>${total}</strong> ${meta.modificador ? `(Mod: ${meta.modificador > 0 ? '+' : ''}${meta.modificador})` : ''}
        </div>
      </div>
    `;
  }

  return `<div class="chat-msg-text">${escapeHtml(msg.content)}</div>`;
}

function renderActionCardBody(msg, meta, isGM) {
  const status = meta?.status || 'pendente';
  const tipoDescanso = meta?.tipoDescanso || 'curto';

  return `
    <div class="action-card-box">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <span style="font-size: 18px;">🛌</span>
        <div>
          <div style="font-size: 13.5px; font-weight: 700; color: #fff;">Solicitação de Descanso ${tipoDescanso.toUpperCase()}</div>
          <div style="font-size: 11.5px; color: var(--text-muted);">
            ${escapeHtml(msg.author_name)} solicitou avanço de tempo e recuperação de Anima.
          </div>
        </div>
      </div>

      <div style="margin-top: 10px; display: flex; align-items: center; justify-content: space-between;">
        <div>
          ${status === 'pendente' ? `
            <span style="font-size: 11.5px; color: #f59e0b; font-weight: 600;">⏳ Aguardando aprovação do Mestre</span>
          ` : status === 'aprovado' ? `
            <span style="font-size: 11.5px; color: #4ade80; font-weight: 600;">✅ Aprovado pelo Mestre</span>
          ` : `
            <span style="font-size: 11.5px; color: #f87171; font-weight: 600;">❌ Recusado pelo Mestre</span>
          `}
        </div>

        ${(isGM && status === 'pendente') ? `
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn-action-sm btn-action-accept" onclick="responderCardAcao(${msg.id}, 'aprovar')">
              Aprovar
            </button>
            <button type="button" class="btn-action-sm btn-action-kick" onclick="responderCardAcao(${msg.id}, 'recusar')">
              Recusar
            </button>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// === Envio de Mensagens e Comandos ===

window.sendMessage = async function() {
  const input = document.getElementById('chat-input');
  if (!input) return;

  const message = input.value.trim();
  if (!message) return;

  fecharAutocomplete();

  // Tratamento de comandos de interface local
  if (message === '/ajuda' || message === '/help') {
    exibirGuiaAjudaLocal();
    input.value = '';
    return;
  }

  const payload = {
    campaignId: currentCampaignId,
    content: message,
    persona: {
      type: currentPersona.type || 'ic',
      name: currentPersona.name || '',
      avatar: currentPersona.avatar || '🗡️'
    },
    replyTo: currentReplyTo ? {
      id: currentReplyTo.id,
      author: currentReplyTo.author,
      text: currentReplyTo.text
    } : null
  };

  try {
    input.disabled = true;
    const res = await apiClient.sync('chat.send', payload);
    input.disabled = false;

    if (res && res.sucesso) {
      input.value = '';
      cancelarRespostaMensagem();
      await loadChatHistory(true);
      input.focus();
    } else {
      alert(`⚠️ Erro ao enviar mensagem: ${res?.erro || 'Falha na requisição'}`);
      input.focus();
    }
  } catch (err) {
    input.disabled = false;
    console.error("Erro ao enviar mensagem:", err);
    alert(`⚠️ Erro de conexão com o servidor: ${err.message}`);
  }
};

function exibirGuiaAjudaLocal() {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const helpCard = document.createElement('div');
  helpCard.className = 'chat-msg-card msg-card-roll';
  helpCard.innerHTML = `
    <div class="chat-msg-header">
      <div class="chat-msg-author-info">
        <div class="chat-msg-avatar">📜</div>
        <span class="chat-msg-name">Guia de Comandos da Mesa</span>
        <span class="chat-msg-badge badge-system">Ajuda</span>
      </div>
    </div>
    <div class="chat-msg-body">
      <div style="font-size: 12.5px; line-height: 1.7; color: var(--text-muted);">
        <div><strong style="color: var(--gold-light);">/roll [expr]</strong> ou <strong style="color: var(--gold-light);">/r</strong>: Rola dados ou atributos (ex: <code>/roll 2d6+3</code>, <code>/roll corpo</code>)</div>
        <div><strong style="color: var(--gold-light);">/gmroll [expr]</strong> ou <strong style="color: var(--gold-light);">/gr</strong>: Rolagem secreta cujo resultado só é visto pelo Mestre</div>
        <div><strong style="color: var(--gold-light);">/w [jogador] [texto]</strong>: Envia um sussurro privado</div>
        <div><strong style="color: var(--gold-light);">/me [ação]</strong>: Emite uma ação interpretativa do personagem</div>
        <div><strong style="color: var(--gold-light);">/ooc [texto]</strong>: Mensagem fora do jogo (Out Of Character)</div>
        <div><strong style="color: var(--gold-light);">/gm [narração]</strong>: Narração solene da mesa (Exclusivo Mestre)</div>
        <div><strong style="color: var(--gold-light);">/npc [Nome] [fala]</strong>: Fala no chat como um NPC específico</div>
        <div><strong style="color: var(--gold-light);">/descanso [curto|longo]</strong>: Recupera Anima e avança o relógio da campanha</div>
        <div><strong style="color: var(--gold-light);">/iniciativa</strong>: Rola e calcula iniciativa de combate</div>
      </div>
    </div>
  `;
  container.appendChild(helpCard);
  container.scrollTop = container.scrollHeight;
}

// === Atalhos de Rolagem Rápida e Gaveta ===

window.toggleQuickDiceDrawer = function() {
  const drawer = document.getElementById('chat-quick-dice-drawer');
  const btn = document.getElementById('btn-toggle-quick-dice');
  if (!drawer) return;

  drawer.classList.toggle('active');
  if (btn) {
    btn.classList.toggle('active', drawer.classList.contains('active'));
  }
};

window.executarAtalhoRolagem = function(tipo) {
  const input = document.getElementById('chat-input');
  if (!input) return;

  if (tipo === 'corpo' || tipo === 'mente' || tipo === 'social' || tipo === 'espirito') {
    input.value = `/roll ${tipo}`;
    sendMessage();
  } else if (tipo === '1d6' || tipo === '2d6' || tipo === '1d20') {
    input.value = `/roll ${tipo}`;
    sendMessage();
  } else if (tipo === 'iniciativa') {
    input.value = `/iniciativa`;
    sendMessage();
  } else if (tipo === 'descanso_curto') {
    input.value = `/descanso curto`;
    sendMessage();
  } else if (tipo === 'descanso_longo') {
    input.value = `/descanso longo`;
    sendMessage();
  }
};

// === Seletor "Falar Como..." (Personas) ===

window.togglePersonaMenu = function() {
  const menu = document.getElementById('persona-menu');
  if (menu) menu.classList.toggle('active');
};

window.selecionarPersona = function(tipo, customName = '', customAvatar = '') {
  const menu = document.getElementById('persona-menu');
  if (menu) menu.classList.remove('active');

  const btnAvatar = document.getElementById('persona-btn-avatar');
  const btnLabel = document.getElementById('persona-btn-label');
  const user = obterUsuarioAtual();

  currentPersona.type = tipo;

  if (tipo === 'ic') {
    const userChar = currentPartyCharacters.find(c => c.userId === user?.userId);
    currentPersona.name = customName || userChar?.nome || user?.displayName || 'Personagem';
    currentPersona.avatar = customAvatar || '🗡️';
    if (btnAvatar) btnAvatar.textContent = '🗡️';
    if (btnLabel) btnLabel.textContent = currentPersona.name;
  } else if (tipo === 'ooc') {
    currentPersona.name = user?.displayName || 'Jogador';
    currentPersona.avatar = '💬';
    if (btnAvatar) btnAvatar.textContent = '💬';
    if (btnLabel) btnLabel.textContent = 'OOC (Fora)';
  } else if (tipo === 'narracao') {
    currentPersona.name = 'Mestre';
    currentPersona.avatar = '👑';
    if (btnAvatar) btnAvatar.textContent = '👑';
    if (btnLabel) btnLabel.textContent = 'Narrador';
  } else if (tipo === 'npc') {
    currentPersona.name = customName || 'NPC';
    currentPersona.avatar = customAvatar || '🎭';
    if (btnAvatar) btnAvatar.textContent = currentPersona.avatar;
    if (btnLabel) btnLabel.textContent = currentPersona.name;
  }
};

// === Resposta a Mensagens (Citação) ===

window.iniciarRespostaMensagem = function(msgId, authorName, textSnippet) {
  currentReplyTo = {
    id: msgId,
    author: authorName,
    text: textSnippet
  };

  const banner = document.getElementById('chat-reply-banner');
  const authorEl = document.getElementById('reply-author-name');
  const textEl = document.getElementById('reply-text-preview');
  const input = document.getElementById('chat-input');

  if (banner && authorEl && textEl) {
    authorEl.textContent = authorName;
    textEl.textContent = `"${textSnippet}"`;
    banner.classList.add('active');
  }

  if (input) input.focus();
};

window.cancelarRespostaMensagem = function() {
  currentReplyTo = null;
  const banner = document.getElementById('chat-reply-banner');
  if (banner) banner.classList.remove('active');
};

// === Moderação e Limpeza do Chat ===

window.excluirMensagem = async function(messageId) {
  if (!confirm("Deseja realmente apagar esta mensagem da crônica da mesa?")) {
    return;
  }

  try {
    const res = await apiClient.sync('chat.deleteMessage', {
      campaignId: currentCampaignId,
      messageId: messageId
    });

    if (res && res.sucesso) {
      await loadChatHistory(false);
    } else {
      alert(`Falha ao excluir mensagem: ${res?.erro || 'Permissão negada'}`);
    }
  } catch (err) {
    alert(`Erro ao excluir mensagem: ${err.message}`);
  }
};

window.abrirModalLimparChat = function() {
  const modal = document.getElementById('modal-clear-chat');
  if (modal) modal.classList.add('active');
};

window.fecharModalLimparChat = function() {
  const modal = document.getElementById('modal-clear-chat');
  if (modal) modal.classList.remove('active');
};

window.confirmarLimpezaChat = async function() {
  try {
    const res = await apiClient.sync('chat.clearHistory', { campaignId: currentCampaignId });
    fecharModalLimparChat();
    if (res && res.sucesso) {
      await loadChatHistory(true);
    } else {
      alert(`Falha ao limpar histórico: ${res?.erro || 'Permissão negada'}`);
    }
  } catch (err) {
    fecharModalLimparChat();
    alert(`Erro de conexão: ${err.message}`);
  }
};

// === Modal de Quick NPC do Mestre ===

window.abrirModalQuickNPC = function() {
  const menu = document.getElementById('persona-menu');
  if (menu) menu.classList.remove('active');

  const modal = document.getElementById('modal-quick-npc');
  if (modal) modal.classList.add('active');
};

window.fecharModalQuickNPC = function() {
  const modal = document.getElementById('modal-quick-npc');
  if (modal) modal.classList.remove('active');
};

window.salvarQuickNPC = function(e) {
  e.preventDefault();
  const nameInput = document.getElementById('input-npc-name');
  const avatarInput = document.getElementById('input-npc-avatar');

  const name = nameInput ? nameInput.value.trim() : 'NPC';
  const avatar = avatarInput && avatarInput.value.trim() ? avatarInput.value.trim() : '🎭';

  selecionarPersona('npc', name, avatar);
  fecharModalQuickNPC();
};

// === Resposta a Card de Ação (Aprovar / Recusar) ===

window.responderCardAcao = async function(messageId, acao) {
  try {
    const res = await apiClient.sync('chat.respondActionCard', {
      campaignId: currentCampaignId,
      messageId: messageId,
      acao: acao
    });

    if (res && res.sucesso) {
      await loadChatHistory(false);
    } else {
      alert(`Falha ao responder card: ${res?.erro || 'Erro'}`);
    }
  } catch (err) {
    alert(`Erro ao processar ação: ${err.message}`);
  }
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

// === Aba de Configurações & Governança da Campanha ===

let configAutoApprove = 1;
let configSceneAccess = 'free';

window.selecionarOpcaoAutoApprove = function(val) {
  configAutoApprove = Number(val);
  const card1 = document.getElementById('card-opt-auto-approve-1');
  const card0 = document.getElementById('card-opt-auto-approve-0');
  if (card1 && card0) {
    if (configAutoApprove === 1) {
      card1.classList.add('selected');
      card0.classList.remove('selected');
    } else {
      card0.classList.add('selected');
      card1.classList.remove('selected');
    }
  }
};

window.selecionarOpcaoSceneAccess = function(mode) {
  configSceneAccess = mode === 'approval_required' ? 'approval_required' : 'free';
  const cardFree = document.getElementById('card-opt-scene-free');
  const cardApproval = document.getElementById('card-opt-scene-approval');
  if (cardFree && cardApproval) {
    if (configSceneAccess === 'free') {
      cardFree.classList.add('selected');
      cardApproval.classList.remove('selected');
    } else {
      cardApproval.classList.add('selected');
      cardFree.classList.remove('selected');
    }
  }
};

window.atualizarVolumePreview = function(val) {
  const lbl = document.getElementById('config-sfx-val');
  if (lbl) lbl.textContent = `${val}%`;
};

window.copiarCodigoConviteMesa = function() {
  const input = document.getElementById('config-camp-simple-id');
  if (!input || !input.value) return;
  navigator.clipboard.writeText(input.value).then(() => {
    alert("Código de convite copiado para a área de transferência!");
  }).catch(() => {
    input.select();
    document.execCommand('copy');
    alert("Código de convite copiado!");
  });
};

window.testarCanalVozDiscord = function() {
  const voiceInput = document.getElementById('config-discord-voice');
  const url = voiceInput?.value?.trim();
  if (!url) {
    alert("Informe uma URL de canal de voz ou convite do Discord antes de testar.");
    return;
  }
  window.open(url, '_blank');
};

/**
 * Carrega todos os dados da aba de Configurações
 */
window.loadConfigData = async function() {
  if (!currentCampaignId) return;

  try {
    // Sincroniza dados da campanha atual se necessário
    if (!currentCampaignData) {
      const res = await apiClient.getCampaign({ campaignId: currentCampaignId });
      if (res.sucesso && res.dados) {
        currentCampaignData = res.dados;
      }
    }

    const camp = currentCampaignData;
    if (!camp) return;

    const user = obterUsuarioAtual();
    const isGM = user && (camp.owner_id === user.userId || camp.owner_id === user.id || camp.gm_id === user.userId || camp.gm_id === user.id || String(camp.owner_id) === String(user.userId || user.id));
    const isSuperAdmin = user && (user.role === 'superadmin' || user.role === 'admin');

    // Preenche campos de identidade
    const inputName = document.getElementById('config-camp-name');
    if (inputName) inputName.value = camp.name || '';

    const selectSys = document.getElementById('config-camp-system');
    if (selectSys) selectSys.value = camp.system_id || 'alphad6';

    const selectTheme = document.getElementById('config-camp-theme');
    if (selectTheme) selectTheme.value = camp.theme_id || 'dark-fantasy';

    const selectVis = document.getElementById('config-camp-visibility');
    if (selectVis) selectVis.value = camp.is_public !== undefined ? String(camp.is_public) : '1';

    const inputMax = document.getElementById('config-camp-max-players');
    if (inputMax) inputMax.value = camp.max_players || 5;

    const inputSimpleId = document.getElementById('config-camp-simple-id');
    if (inputSimpleId) inputSimpleId.value = camp.simple_id || camp.id || '';

    const inputNotices = document.getElementById('config-camp-notices');
    if (inputNotices) inputNotices.value = camp.notices || '';

    // Preenche configurações e regras
    const settings = camp.settings || {};
    selecionarOpcaoAutoApprove(settings.auto_approve_actions !== undefined ? settings.auto_approve_actions : 1);
    selecionarOpcaoSceneAccess(settings.scene_access_mode || 'free');

    const selectXp = document.getElementById('config-camp-xp-mult');
    if (selectXp) selectXp.value = settings.xp_multiplier !== undefined ? String(settings.xp_multiplier) : '1.0';

    const inputVoice = document.getElementById('config-discord-voice');
    if (inputVoice) inputVoice.value = settings.discord_voice_url || '';

    const inputWebhook = document.getElementById('config-discord-webhook');
    if (inputWebhook) inputWebhook.value = settings.discord_webhook_url || '';

    const rangeSfx = document.getElementById('config-sfx-volume');
    const sfxVal = settings.sound_effects_volume !== undefined ? settings.sound_effects_volume : 80;
    if (rangeSfx) {
      rangeSfx.value = sfxVal;
      atualizarVolumePreview(sfxVal);
    }

    // Exibe ou oculta zona de perigo
    const dangerZone = document.getElementById('card-danger-zone');
    if (dangerZone) {
      dangerZone.style.display = (isGM || isSuperAdmin) ? 'block' : 'none';
    }

    // Carrega solicitações pendentes e lista de jogadores
    await Promise.all([
      carregarSolicitacoesConfig(),
      carregarJogadoresConfig()
    ]);

  } catch (err) {
    console.error("Erro ao carregar configurações da campanha:", err);
  }
};

/**
 * Salva todas as configurações gerais da campanha
 */
window.salvarConfiguracoesCampanhaCompleta = async function() {
  if (!currentCampaignId) return;

  const btn = document.getElementById('btn-save-campaign-config');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Salvando...';
  }

  try {
    const payload = {
      campaignId: currentCampaignId,
      name: document.getElementById('config-camp-name')?.value?.trim(),
      systemId: document.getElementById('config-camp-system')?.value,
      themeId: document.getElementById('config-camp-theme')?.value,
      isPublic: Number(document.getElementById('config-camp-visibility')?.value || 1),
      maxPlayers: Number(document.getElementById('config-camp-max-players')?.value || 5),
      notices: document.getElementById('config-camp-notices')?.value || '',
      autoApproveActions: configAutoApprove,
      sceneAccessMode: configSceneAccess,
      xpMultiplier: Number(document.getElementById('config-camp-xp-mult')?.value || 1.0),
      discordVoiceUrl: document.getElementById('config-discord-voice')?.value?.trim() || '',
      discordWebhookUrl: document.getElementById('config-discord-webhook')?.value?.trim() || '',
      soundEffectsVolume: Number(document.getElementById('config-sfx-volume')?.value || 80)
    };

    const res = await apiClient.updateCampaignSettings(payload);
    if (res && res.sucesso) {
      alert("Configurações da campanha salvas com sucesso!");
      
      // Atualiza os dados locais e a visão geral
      if (currentCampaignData) {
        Object.assign(currentCampaignData, {
          name: payload.name || currentCampaignData.name,
          system_id: payload.systemId,
          theme_id: payload.themeId,
          is_public: payload.isPublic,
          max_players: payload.maxPlayers,
          notices: payload.notices,
          settings: {
            ...(currentCampaignData.settings || {}),
            auto_approve_actions: payload.autoApproveActions,
            scene_access_mode: payload.sceneAccessMode,
            xp_multiplier: payload.xpMultiplier,
            discord_voice_url: payload.discordVoiceUrl,
            discord_webhook_url: payload.discordWebhookUrl,
            sound_effects_volume: payload.soundEffectsVolume
          }
        });
      }

      // Atualiza textos do cabeçalho
      if (payload.name) {
        document.getElementById('campaign-title').textContent = payload.name;
      }
      const sysLabel = SYSTEMS_MAP[payload.systemId] || payload.systemId;
      document.getElementById('campaign-system').textContent = sysLabel;
      document.getElementById('campaign-notices').textContent = payload.notices || "Ainda não há avisos importantes fixados.";

    } else {
      alert(`Falha ao salvar configurações: ${res?.erro || 'Erro desconhecido.'}`);
    }
  } catch (err) {
    console.error("Erro ao salvar configurações:", err);
    alert(`Erro ao conectar ao servidor: ${err.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '💾 Salvar Configurações';
    }
  }
};

/**
 * Carrega a lista de solicitações de entrada pendentes
 */
async function carregarSolicitacoesConfig() {
  const container = document.getElementById('config-requests-list-container');
  const badge = document.getElementById('badge-config-requests-count');
  if (!container) return;

  try {
    const res = await apiClient.sync('campaigns.requests.list', { campaignId: currentCampaignId });
    if (res && res.sucesso && Array.isArray(res.dados)) {
      const requests = res.dados.filter(r => r.status === 'pendente' || r.status === 'pending');
      if (badge) badge.textContent = `${requests.length} pendente(s)`;

      if (requests.length === 0) {
        container.innerHTML = `
          <div style="font-size: 12.5px; color: var(--text-dim); text-align: center; padding: 20px;">
            Nenhuma solicitação pendente no momento.
          </div>
        `;
        return;
      }

      container.innerHTML = requests.map(req => {
        const initial = (req.display_name || req.username || req.name || 'A')[0].toUpperCase();
        const dateStr = req.created_at ? new Date(req.created_at).toLocaleDateString('pt-BR') : '';
        const name = req.display_name || req.username || req.name || 'Aventureiro';
        const nick = req.nickname || req.username || '';
        return `
          <div class="manage-list-item">
            <div class="manage-player-avatar">${initial}</div>
            <div class="manage-player-info">
              <div class="manage-player-name">${name} ${nick ? `<span style="font-size: 11px; color: var(--text-dim);">@${nick}</span>` : ''}</div>
              <div class="manage-player-role">Solicitou entrada ${dateStr ? `em ${dateStr}` : ''}</div>
            </div>
            <div class="manage-player-actions">
              <button type="button" class="btn-action-sm btn-action-accept" onclick="responderSolicitacaoConfig('${req.id}', 'aceito')" title="Aceitar na Mesa">
                ✓ Aceitar
              </button>
              <button type="button" class="btn-action-sm btn-action-reject" onclick="responderSolicitacaoConfig('${req.id}', 'recusado')" title="Negar Entrada">
                ✕ Negar
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    container.innerHTML = `<div style="color: #ef4444; font-size: 12px; padding: 12px;">Erro ao carregar solicitações: ${err.message}</div>`;
  }
}

/**
 * Responde a uma solicitação de entrada (aceitar ou rejeitar)
 */
window.responderSolicitacaoConfig = async function(requestId, status) {
  try {
    const res = await apiClient.sync('campaigns.requests.respond', {
      campaignId: currentCampaignId,
      requestId,
      status
    });

    if (res && res.sucesso) {
      alert(status === 'aceito' || status === 'approved' ? "Jogador aceito na campanha!" : "Solicitação recusada.");
      // Atualiza os dados da campanha e a lista
      const campRes = await apiClient.getCampaign({ campaignId: currentCampaignId });
      if (campRes.sucesso && campRes.dados) {
        currentCampaignData = campRes.dados;
        renderizarJogadoresGeral(currentCampaignData.players || []);
      }
      await carregarSolicitacoesConfig();
      await carregarJogadoresConfig();
    } else {
      alert(`Falha ao responder solicitação: ${res?.erro || 'Erro desconhecido'}`);
    }
  } catch (err) {
    alert(`Erro ao conectar ao servidor: ${err.message}`);
  }
};

/**
 * Carrega a lista de jogadores da mesa com opções de moderação
 */
async function carregarJogadoresConfig() {
  const container = document.getElementById('config-players-list-container');
  if (!container) return;

  const players = currentCampaignData?.players || [];
  const user = obterUsuarioAtual();
  const isGM = user && (currentCampaignData?.owner_id === user.userId || currentCampaignData?.owner_id === user.id || currentCampaignData?.gm_id === user.userId || currentCampaignData?.gm_id === user.id || String(currentCampaignData?.owner_id) === String(user.userId || user.id));
  const isSuperAdmin = user && (user.role === 'superadmin' || user.role === 'admin');

  if (players.length === 0) {
    container.innerHTML = `
      <div style="font-size: 12.5px; color: var(--text-dim); text-align: center; padding: 20px;">
        Nenhum jogador na mesa ainda.
      </div>
    `;
    return;
  }

  container.innerHTML = players.map(p => {
    const isPlayerGM = p.role?.toLowerCase() === 'mestre' || p.user_id === currentCampaignData?.owner_id;
    const initial = (p.display_name || 'J')[0].toUpperCase();
    const safeName = (p.display_name || 'Jogador').replace(/'/g, "\\'");
    const isAssistant = p.role?.toLowerCase() === 'assistente' || p.role?.toLowerCase() === 'assistente de mestre';

    return `
      <div class="manage-list-item">
        <div class="manage-player-avatar" style="${isPlayerGM ? 'border-color: var(--gold-primary); color: var(--gold-light);' : ''}">${initial}</div>
        <div class="manage-player-info">
          <div class="manage-player-name">${p.display_name} ${p.nickname ? '<span style="font-size: 11px; color: var(--text-dim);">@' + p.nickname + '</span>' : ''}</div>
          <div class="manage-player-role">
            ${isPlayerGM ? '<strong style="color: var(--gold-light);">👑 Mestre da Campanha</strong>' : (isAssistant ? '<span style="color: #60a5fa;">🛡️ Assistente de Mestre</span>' : 'Jogador')}
          </div>
        </div>
        <div class="manage-player-actions">
          ${isPlayerGM ? `
            <span style="font-size: 11px; color: var(--gold-light); padding: 4px 8px; border: 1px solid var(--border-gold); border-radius: var(--radius-sm);">Criador</span>
          ` : `
            ${(isGM || isSuperAdmin) ? `
              <select class="form-control" style="width: auto; padding: 4px 8px; font-size: 11.5px;" onchange="alterarCargoJogadorConfig(${p.user_id}, this.value)">
                <option value="jogador" ${!isAssistant ? 'selected' : ''}>Jogador</option>
                <option value="assistente" ${isAssistant ? 'selected' : ''}>Assistente de Mestre</option>
              </select>
              <button type="button" class="btn-action-sm btn-action-kick" onclick="expulsarJogadorConfig(${p.user_id}, '${safeName}')" title="Expulsar da Mesa">
                🚪 Expulsar
              </button>
              <button type="button" class="btn-action-sm btn-action-ban" onclick="banirJogadorConfig(${p.user_id}, '${safeName}')" title="Banir de Todas as Mesas do Mestre">
                🚫 Banir
              </button>
            ` : `
              <span style="font-size: 11px; color: var(--text-dim);">${p.role || 'Jogador'}</span>
            `}
          `}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Altera o cargo de um jogador na mesa (Jogador vs Assistente de Mestre)
 */
window.alterarCargoJogadorConfig = async function(userId, role) {
  try {
    const res = await apiClient.sync('campaigns.players.setRole', {
      campaignId: currentCampaignId,
      userId,
      role
    });

    if (res && res.sucesso) {
      alert(`Cargo atualizado para "${role === 'assistente' ? 'Assistente de Mestre' : 'Jogador'}".`);
      const campRes = await apiClient.getCampaign({ campaignId: currentCampaignId });
      if (campRes.sucesso && campRes.dados) {
        currentCampaignData = campRes.dados;
        renderizarJogadoresGeral(currentCampaignData.players || []);
      }
      await carregarJogadoresConfig();
    } else {
      alert(`Falha ao alterar cargo: ${res?.erro || 'Erro desconhecido'}`);
    }
  } catch (err) {
    alert(`Erro ao conectar ao servidor: ${err.message}`);
  }
};

/**
 * Expulsa um jogador da mesa atual
 */
window.expulsarJogadorConfig = async function(userId, playerName) {
  if (!confirm(`Tem certeza que deseja expulsar o jogador "${playerName}" desta campanha? Ele poderá solicitar entrada novamente no futuro caso a mesa seja pública.`)) {
    return;
  }

  try {
    const res = await apiClient.kickCampaignPlayer({
      campaignId: currentCampaignId,
      userId
    });

    if (res && res.sucesso) {
      alert(`Jogador "${playerName}" foi expulso da campanha.`);
      const campRes = await apiClient.getCampaign({ campaignId: currentCampaignId });
      if (campRes.sucesso && campRes.dados) {
        currentCampaignData = campRes.dados;
        renderizarJogadoresGeral(currentCampaignData.players || []);
      }
      await carregarJogadoresConfig();
    } else {
      alert(`Falha ao expulsar jogador: ${res?.erro || 'Erro desconhecido'}`);
    }
  } catch (err) {
    alert(`Erro ao conectar ao servidor: ${err.message}`);
  }
};

/**
 * Bane um jogador em nível de Mestre (todas as mesas do Mestre)
 */
window.banirJogadorConfig = async function(userId, playerName) {
  const confirmMsg = `ATENÇÃO: Banir "${playerName}" expulsará o jogador desta campanha e o BLOQUEARÁ PERMANENTEMENTE de ingressar ou solicitar entrada em TODAS as suas mesas de RPG.\n\nDeseja realmente aplicar o banimento de Mestre?`;
  if (!confirm(confirmMsg)) {
    return;
  }

  const reason = prompt("Informe o motivo do banimento (opcional):", "Violação de conduta na mesa");
  if (reason === null) return; // Usuário cancelou

  try {
    const res = await apiClient.banPlayerFromGM({
      campaignId: currentCampaignId,
      playerId: userId,
      reason: reason || "Violação de conduta"
    });

    if (res && res.sucesso) {
      alert(`Jogador "${playerName}" foi banido com sucesso de todas as suas campanhas.`);
      const campRes = await apiClient.getCampaign({ campaignId: currentCampaignId });
      if (campRes.sucesso && campRes.dados) {
        currentCampaignData = campRes.dados;
        renderizarJogadoresGeral(currentCampaignData.players || []);
      }
      await carregarJogadoresConfig();
      await carregarSolicitacoesConfig();
    } else {
      alert(`Falha ao banir jogador: ${res?.erro || 'Erro desconhecido'}`);
    }
  } catch (err) {
    alert(`Erro ao conectar ao servidor: ${err.message}`);
  }
};

/**
 * Abre o modal de jogadores banidos pelo Mestre
 */
window.abrirModalJogadoresBanidos = async function() {
  const modal = document.getElementById('modal-banned-players');
  const container = document.getElementById('banned-players-list-container');
  if (!modal || !container) return;

  modal.classList.add('active');
  container.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 20px;">Carregando lista de banidos...</div>`;

  try {
    const res = await apiClient.listGMBannedPlayers({ campaignId: currentCampaignId });
    if (res && res.sucesso && Array.isArray(res.dados)) {
      const list = res.dados;
      if (list.length === 0) {
        container.innerHTML = `
          <div style="font-size: 12.5px; color: var(--text-dim); text-align: center; padding: 24px;">
            Você não possui nenhum jogador banido das suas mesas.
          </div>
        `;
        return;
      }

      container.innerHTML = list.map(b => {
        const initial = (b.display_name || b.username || 'B')[0].toUpperCase();
        const safeName = (b.display_name || b.username || 'Jogador').replace(/'/g, "\\'");
        const dateStr = b.created_at ? new Date(b.created_at).toLocaleDateString('pt-BR') : '';
        return `
          <div class="manage-list-item">
            <div class="manage-player-avatar" style="border-color: #f87171; color: #f87171;">${initial}</div>
            <div class="manage-player-info">
              <div class="manage-player-name" style="color: #fca5a5;">${b.display_name || b.username} <span style="font-size: 11px; color: var(--text-dim);">@${b.username}</span></div>
              <div class="manage-player-role">Motivo: <em>${b.reason || 'Sem motivo informado'}</em> • Banido em ${dateStr}</div>
            </div>
            <div class="manage-player-actions">
              <button type="button" class="btn-action-sm btn-action-accept" onclick="desbanirJogadorConfig(${b.player_id}, '${safeName}')" title="Revogar Banimento">
                Desbanir
              </button>
            </div>
          </div>
        `;
      }).join('');
    } else {
      container.innerHTML = `<div style="color: #ef4444; font-size: 12px; padding: 12px;">Falha ao obter lista: ${res?.erro || 'Erro'}</div>`;
    }
  } catch (err) {
    container.innerHTML = `<div style="color: #ef4444; font-size: 12px; padding: 12px;">Erro ao carregar banidos: ${err.message}</div>`;
  }
};

window.fecharModalJogadoresBanidos = function() {
  const modal = document.getElementById('modal-banned-players');
  if (modal) modal.classList.remove('active');
};

/**
 * Revoga o banimento de um jogador
 */
window.desbanirJogadorConfig = async function(playerId, playerName) {
  if (!confirm(`Deseja revogar o banimento de "${playerName}"? O usuário poderá voltar a interagir e solicitar vaga em suas campanhas.`)) {
    return;
  }

  try {
    const res = await apiClient.unbanPlayerFromGM({ playerId });
    if (res && res.sucesso) {
      alert(`Banimento de "${playerName}" foi revogado.`);
      await abrirModalJogadoresBanidos();
    } else {
      alert(`Falha ao desbanir jogador: ${res?.erro || 'Erro desconhecido'}`);
    }
  } catch (err) {
    alert(`Erro ao conectar ao servidor: ${err.message}`);
  }
};

/**
 * Exclui a campanha definitivamente
 */
window.executarExclusaoCampanha = async function() {
  const campName = currentCampaignData?.name || "esta campanha";
  const confirmPrompt = prompt(`ATENÇÃO: A exclusão é PERMANENTE e IRREVERSÍVEL.\nTodas as fichas vinculadas, crônicas e dados desta mesa serão apagados.\n\nPara confirmar a exclusão, digite o nome exato da campanha abaixo:\n"${campName}"`);

  if (confirmPrompt === null) return; // Cancelado

  if (confirmPrompt.trim().toLowerCase() !== campName.trim().toLowerCase()) {
    alert("O nome digitado não confere. Operação de exclusão cancelada.");
    return;
  }

  try {
    const res = await apiClient.deleteCampaign({ campaignId: currentCampaignId });
    if (res && res.sucesso) {
      alert("A campanha foi excluída com sucesso.");
      window.location.href = "index.html";
    } else {
      alert(`Falha ao excluir campanha: ${res?.erro || 'Erro desconhecido'}`);
    }
  } catch (err) {
    alert(`Erro ao conectar ao servidor: ${err.message}`);
  }
};

let p2pNetManager = null;
let isP2PLeader = false;
let p2pHeartbeatInterval = null;
let p2pSignalPollInterval = null;

async function initSyncP2P() {
  const user = obterUsuarioAtual();
  if (!user || !user.id || !currentCampaignId) return;

  p2pNetManager = new window.P2PNetworkManager(currentCampaignId, user.id, apiClient);
  p2pNetManager.setDataCallback((peerId, data) => {
    if (data.type === 'chat_update') {
      // Se for follower e receber um update do leader, carrega o chat novo.
      if (!isP2PLeader) {
        console.log(`[P2P] Update de chat recebido do líder ${peerId}`);
        loadChatHistory(true);
      }
    }
  });

  // Loop de presença
  p2pHeartbeatInterval = setInterval(async () => {
    try {
      const res = await apiClient.sync('sync.presence', {
        campaignId: currentCampaignId,
        isLeader: isP2PLeader ? 1 : 0
      });
      if (res && res.sucesso) {
        const { ativos, liderId, meuId } = res;
        
        // Verifica se eu sou o líder
        const wasLeader = isP2PLeader;
        isP2PLeader = (liderId === meuId);

        if (isP2PLeader && !wasLeader) {
          console.log("[P2P] Você agora é o LÍDER (WebRTC Host).");
          // O líder para o polling de chat tradicional, quem avisa é ele
          // (na verdade o lider envia o sinal). Aqui apenas reage a mensagens
        } else if (!isP2PLeader && wasLeader) {
          console.log("[P2P] Você deixou de ser o LÍDER (WebRTC Follower).");
          p2pNetManager.closeAll();
        }

        // Se eu for o líder, tento conectar em todo mundo
        if (isP2PLeader) {
          ativos.forEach(u => {
            if (u.user_id !== meuId) {
              p2pNetManager.connectToPeer(u.user_id);
            }
          });
        }
      }
    } catch (e) {
      console.warn("Erro no heartbeat P2P", e);
    }
  }, 10000); // 10 segundos

  // Loop de busca de sinais P2P (ofertas, respostas, ICE)
  p2pSignalPollInterval = setInterval(() => {
    p2pNetManager.pollSignals();
  }, 3000);
}

// Interceptador para quando o usuário (líder) atualiza o chat, enviar o broadcast
window.notificarChatAtualizado = function() {
  if (isP2PLeader && p2pNetManager) {
    p2pNetManager.broadcast('chat_update', { time: Date.now() });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  loadCampaignData();
  setupChatAutocomplete();
  loadChatHistory(false);
  iniciarChatPolling(); // Mantemos como Fallback, depois podemos otimizar diminuindo a frequencia
  initSyncP2P();
});

