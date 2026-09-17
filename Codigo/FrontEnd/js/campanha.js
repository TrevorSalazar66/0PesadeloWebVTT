/**
 * Lógica da Interface Interna da Campanha (SPA)
 */

// Alterna entre as abas principais da campanha
function changeTab(tabId) {
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
function sairCampanha() {
  if (confirm("Deseja realmente sair da campanha?")) {
    // Aqui no futuro adicionaremos a lógica para avisar o backend (WebSocket)
    // que o jogador ficou offline.
    console.log("Desconectando do servidor de sessão...");
    window.location.href = "index.html";
  }
}

// === Funcionalidades do Chat ===

function handleChatEnter(event) {
  if (event.key === 'Enter') {
    sendMessage();
  }
}

function sendMessage() {
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
}

function addMessageToChat(author, text, type) {
  const chatMessages = document.getElementById('chat-messages');
  const msgBox = document.createElement('div');
  msgBox.className = 'msg-box';
  
  if (type === 'mestre') msgBox.classList.add('mestre');
  if (type === 'roll') msgBox.classList.add('roll');

  msgBox.innerHTML = `<strong>${author}:</strong> ${text}`;
  chatMessages.appendChild(msgBox);
}
