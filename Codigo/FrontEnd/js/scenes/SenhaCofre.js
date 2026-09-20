/**
 * Cena: Senha / Cofre (Modelo 3)
 */
class SenhaCofreScene {
  constructor(containerId, sceneData, noCodeEngine) {
    this.container = document.getElementById(containerId);
    this.sceneData = sceneData;
    this.engine = noCodeEngine;
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div id="password-puzzle-wrapper">
         <p id="password-feedback-msg">Insira a combinação</p>
         <div id="password-slots-container"></div>
         <div style="margin-top:20px;">
           <button class="btn-primary" onclick="window.submeterSenhaCofre()">Confirmar</button>
           <button class="btn-secondary" onclick="window.limparSenhaCofre()">Limpar</button>
         </div>
      </div>
    `;
    if(window.renderPasswordPalco) {
        window.renderPasswordPalco(this.sceneData);
    }
  }

  destroy() {
    this.container.innerHTML = '';
  }
}
window.SenhaCofreScene = SenhaCofreScene;
