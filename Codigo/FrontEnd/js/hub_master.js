/**
 * hub_master.js
 * Gerencia a abertura e fechamento dos modais do Hub do Mestre: Cenas, Compêndio e Mundo.
 */

/**
 * Navega para a aba da Oficina do Mestre (Hub Central com 3 cards).
 * Chamado pelo botão de nav lateral/inferior.
 */
window.abrirHubMestre = function() {
  if (typeof window.changeTab === 'function') {
    window.changeTab('oficina');
  }
};

window.abrirModalHub = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'flex';

    // Se estiver abrindo a Oficina de Cenas, força o recarregamento da lista de cenas
    if (modalId === 'hub-modal-cenas' && typeof window.loadOficinaScenes === 'function') {
      window.loadOficinaScenes();
    }

    // Se estiver abrindo o Gerenciamento de Compêndio, inicializa a interface
    if (modalId === 'hub-modal-compendio') {
      if (window.CompendiumUI && !window.compendiumInstance) {
        window.compendiumInstance = new window.CompendiumUI('compendium-hub-container', window.apiClient);
        window.compendiumInstance.loadItems();
      } else if (window.compendiumInstance) {
        window.compendiumInstance.loadItems();
      }
    }
  }
};


window.fecharModalHub = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
  }
};

// Quando o usuário clicar fora do modal-content, fecha o modal
window.addEventListener('click', function(event) {
  if (event.target.classList.contains('modal-overlay') && event.target.id.startsWith('hub-modal-')) {
    window.fecharModalHub(event.target.id);
  }
});
