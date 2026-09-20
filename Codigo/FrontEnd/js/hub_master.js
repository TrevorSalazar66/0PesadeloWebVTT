/**
 * hub_master.js
 * Gerencia a abertura e fechamento dos modais do Hub do Mestre: Cenas, Compêndio e Mundo.
 */

window.abrirHubMestre = function() {
  // Por padrão, ao clicar no botão "Hub do Mestre", abre a Oficina de Cenas
  window.abrirModalHub('hub-modal-cenas');
};

window.abrirModalHub = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'flex';
    
    // Se estiver abrindo a Oficina de Cenas, força o recarregamento da lista de cenas
    if (modalId === 'hub-modal-cenas' && typeof window.loadOficinaScenes === 'function') {
      window.loadOficinaScenes();
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

// Ajuste para evitar conflitos com a lógica antiga da Oficina que estava em changeTab
// Se existir algo no loadOficinaScenes, ele já atualizará o DOM apropriado no modal.
