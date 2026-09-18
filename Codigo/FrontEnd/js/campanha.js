/**
 * Lógica da Interface Interna da Campanha (SPA)
 */

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
}

// Logica de saída da campanha
window.sairCampanha = function() {
  if (confirm("Deseja realmente sair da campanha?")) {
    // Aqui no futuro adicionaremos a lógica para avisar o backend (WebSocket)
    // que o jogador ficou offline.
    console.log("Desconectando do servidor de sessão...");
    window.location.href = "index.html";
  }
};

// === Funcionalidades do Chat ===

window.handleChatEnter = function(event) {
  if (event.key === 'Enter') {
    sendMessage();
  }
};

window.sendMessage = function() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();

  if (!message) return;

  const chatMessages = document.getElementById('chat-messages');

  // Lógica básica para simular o /roll no frontend
  if (message.startsWith('/roll')) {
    const expr = message.replace('/roll', '').trim();
    // Apenas simulação visual por enquanto
    addMessageToChat('Sistema', `Rolou ${expr}: [ Simulação de Dado ]`, 'roll');
  } else {
    // Simula mensagem de personagem
    addMessageToChat('Você (Personagem)', message, 'player');
  }

  input.value = '';
  // Rolar para baixo para ver a mensagem mais recente
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

import { apiClient } from './api/client.js';

let currentCampaignId = new URLSearchParams(window.location.search).get('id');
let currentCampaignData = null;

async function loadCampaignData() {
  if (!currentCampaignId) {
    document.getElementById('campaign-title').textContent = "Campanha não encontrada";
    document.getElementById('campaign-summary').textContent = "ID da campanha não fornecido na URL.";
    return;
  }

  try {
    const res = await apiClient.getCampaign({ id: currentCampaignId });
    if (res.sucesso && res.dados) {
      const camp = res.dados;
      currentCampaignData = camp;

      // Preenche os dados
      document.getElementById('campaign-title').textContent = camp.name || "Campanha Sem Nome";
      document.getElementById('campaign-summary').textContent = camp.description || "Nenhum resumo fornecido.";
      document.getElementById('campaign-system').textContent = camp.system || "D&D 5e";
      document.getElementById('campaign-sessions').textContent = camp.sessions || "0";
      document.getElementById('campaign-next-session').textContent = camp.next_session || "Não agendada";
      document.getElementById('campaign-notices').textContent = camp.notices || "Ainda não há avisos importantes fixados.";
      
      // Ajusta o nome do GM
      if (camp.master_id) { // Simulação, caso tenhamos nome do master no DB
        // Para simplificar vamos apenas mudar o label visual. Numa aplicação real, iteraríamos nos `players`.
        // document.getElementById('gm-name').textContent = camp.master_name; 
      }

    } else {
      document.getElementById('campaign-title').textContent = "Mina de Phandelver"; // Fallback se a API falhar
      document.getElementById('campaign-summary').textContent = "Os heróis chegaram à cidade de Phandalin..."; // Fallback
    }

  } catch (error) {
    console.error("Erro ao buscar campanha:", error);
    // Fallbacks temporários para não quebrar a página de teste
    document.getElementById('campaign-title').textContent = "Mina de Phandelver";
    document.getElementById('campaign-summary').textContent = "Os heróis chegaram à cidade de Phandalin e descobriram a ameaça das marcas vermelhas. Agora se preparam para adentrar a floresta de Neverwinter em busca da Caverna Ecoante.";
  }
}

// === Lógica do Modal de Edição ===

window.openEditModal = function() {
  document.getElementById('input-campaign-name').value = document.getElementById('campaign-title').textContent;
  document.getElementById('input-sessions').value = document.getElementById('campaign-sessions').textContent;
  document.getElementById('input-next-session').value = document.getElementById('campaign-next-session').textContent;
  document.getElementById('input-summary').value = document.getElementById('campaign-summary').textContent === "Nenhum resumo fornecido." ? "" : document.getElementById('campaign-summary').textContent;
  document.getElementById('input-notices').value = document.getElementById('campaign-notices').textContent === "Ainda não há avisos importantes fixados." ? "" : document.getElementById('campaign-notices').textContent;
  
  document.getElementById('editModal').classList.add('active');
};

window.closeEditModal = function() {
  document.getElementById('editModal').classList.remove('active');
};

window.saveCampaignDetails = async function(event) {
  event.preventDefault();

  const newData = {
    campaignId: currentCampaignId,
    name: document.getElementById('input-campaign-name').value,
    sessions: document.getElementById('input-sessions').value,
    nextSession: document.getElementById('input-next-session').value,
    description: document.getElementById('input-summary').value,
    notices: document.getElementById('input-notices').value
  };

  try {
    // Atualiza via API se possível
    // const res = await apiClient.sync('campaigns.update', newData);
    
    // Atualiza o DOM para feedback visual imediato
    document.getElementById('campaign-title').textContent = newData.name || "Campanha Sem Nome";
    document.getElementById('campaign-sessions').textContent = newData.sessions || "0";
    document.getElementById('campaign-next-session').textContent = newData.nextSession || "Não agendada";
    document.getElementById('campaign-summary').textContent = newData.description || "Nenhum resumo fornecido.";
    document.getElementById('campaign-notices').textContent = newData.notices || "Ainda não há avisos importantes fixados.";

    window.closeEditModal();
  } catch (error) {
    console.error("Erro ao salvar campanha:", error);
    alert("Ocorreu um erro ao salvar as alterações.");
  }
};

document.addEventListener('DOMContentLoaded', loadCampaignData);
