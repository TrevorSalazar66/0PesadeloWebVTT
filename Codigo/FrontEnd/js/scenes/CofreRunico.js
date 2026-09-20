/**
 * Cena: Cofre Rúnico / Senha (Modelo 3)
 */
class CofreRunicoScene {
  constructor(containerId, sceneData, noCodeEngine) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.sceneData = sceneData;
    this.engine = noCodeEngine;
    
    let modelData = {};
    try {
      modelData = typeof sceneData.model_data === 'string' ? JSON.parse(sceneData.model_data) : (sceneData.model_data || {});
    } catch (e) {
      modelData = {};
    }

    // Default charset é numérico se não for fornecido
    this.charset = modelData.charset || ['1','2','3','4','5','6','7','8','9','0'];
    
    // O segredo deve ser um array de caracteres do charset. Se for string, split.
    let sec = modelData.secret || '1337';
    this.secret = Array.isArray(sec) ? sec : sec.split('');
    this.length = this.secret.length;

    this.hintText = modelData.hintText || "As estrelas cadentes caem na ordem de seu nascimento...";
    this.failDamage = modelData.failDamage || 2;
    this.hintsEnabled = modelData.hintsEnabled !== false;

    this.currentGuess = [];
    this.fails = 0;
    this.isSolved = false;

    // Calcula o "valor global" do segredo (Soma dos índices no charset)
    this.targetGlobalValue = 0;
    for (let i = 0; i < this.length; i++) {
       const charIdx = this.charset.indexOf(this.secret[i]);
       this.targetGlobalValue += (charIdx !== -1 ? charIdx : 0);
    }
  }

  render() {
    if (!this.container) return;

    let html = `
      <div id="cofre-hint-text" class="cofre-hint-text" style="display: none; text-align: center; font-style: italic; color: #a78bfa; margin-bottom: 16px;">
        "${this.hintText}"
      </div>
      
      <div id="cofre-slots-container" style="display: flex; gap: 8px; justify-content: center; margin-bottom: 24px; padding: 12px; border: 2px solid transparent; transition: border 0.3s ease;">
    `;

    // Slots
    for (let i = 0; i < this.length; i++) {
      let val = this.currentGuess[i] || '_';
      html += `
        <div id="pwd-slot-${i}" class="password-slot-box">
          ${val}
        </div>
      `;
    }
    html += `</div>`;

    // Keypad Dinâmico
    html += `<div style="display: flex; justify-content: center;"><div id="password-keypad" style="display: grid; grid-template-columns: repeat(4, 54px); gap: 8px; margin: 16px auto;">`;
    
    this.charset.forEach((char, index) => {
      html += `
        <button type="button" class="btn-secondary btn-keypad" data-char="${char}">
          ${char}
        </button>
      `;
    });
    html += `</div></div>`;

    // Controles
    html += `
      <div style="display: flex; justify-content: center; gap: 16px; margin-top: 16px;">
        <button id="btn-cofre-clear" type="button" class="btn-danger">Limpar</button>
        <button id="btn-cofre-submit" type="button" class="btn-primary">Confirmar</button>
      </div>
      <div id="password-feedback-msg" style="text-align: center; margin-top: 16px; min-height: 24px;">
        Insira a combinação...
      </div>
    `;

    this.container.innerHTML = html;

    // Binds
    const keys = this.container.querySelectorAll('.btn-keypad');
    keys.forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (this.isSolved) return;
        const char = e.currentTarget.getAttribute('data-char');
        this.addChar(char);
      });
    });

    this.container.querySelector('#btn-cofre-clear').addEventListener('click', () => {
      if (!this.isSolved) this.clearPassword();
    });

    this.container.querySelector('#btn-cofre-submit').addEventListener('click', () => {
      if (!this.isSolved) this.submitPassword();
    });

    this.updateSlotsUI();
    this.applyHintsUI(); // Reaplica as cores de dicas se houver redraw
  }

  addChar(char) {
    if (this.currentGuess.length >= this.length) return;
    this.currentGuess.push(char);
    this.updateSlotsUI();
  }

  clearPassword() {
    this.currentGuess = [];
    this.updateSlotsUI();
    const fb = this.container.querySelector('#password-feedback-msg');
    if (fb) fb.innerText = "Insira a combinação...";
    
    // Remove as cores individuais (Level 3)
    for (let i = 0; i < this.length; i++) {
       const slot = this.container.querySelector(`#pwd-slot-${i}`);
       if (slot) slot.className = 'password-slot-box';
    }
  }

  updateSlotsUI() {
    for (let i = 0; i < this.length; i++) {
      const slot = this.container.querySelector(`#pwd-slot-${i}`);
      if (slot) {
        slot.innerText = this.currentGuess[i] || '_';
      }
    }
  }

  async submitPassword() {
    if (this.currentGuess.length !== this.length) {
      alert(`Preencha todos os ${this.length} símbolos da combinação.`);
      return;
    }

    const isMatch = this.currentGuess.every((val, index) => val === this.secret[index]);
    const fb = this.container.querySelector('#password-feedback-msg');

    if (isMatch) {
      this.isSolved = true;
      for (let i = 0; i < this.length; i++) {
        const slot = this.container.querySelector(`#pwd-slot-${i}`);
        if (slot) slot.className = 'password-slot-box hint-exact';
      }
      if (fb) fb.innerHTML = `<span style="color: #34d399; font-weight: 700;">🔓 ACESSO PERMITIDO! O mecanismo ancestral se destrancou.</span>`;
      
      const slotsContainer = this.container.querySelector('#cofre-slots-container');
      if (slotsContainer) {
          slotsContainer.style.borderColor = '#34d399'; // Verde Global
      }

      if (window.obterUsuarioAtual && window.currentPartyCharacters && window.apiClient) {
        const user = window.obterUsuarioAtual();
        const meuChar = window.currentPartyCharacters.find(c => c.user_id === (user ? user.id : ''));
        await window.apiClient.triggerSceneAction(window.currentCampaignId, this.sceneData.id, {
          trigger: 'on_password_correct',
          actionType: 'award_xp',
          actionParams: 40,
          characterId: meuChar ? meuChar.id : null
        });
        if (window.loadDiarioData) await window.loadDiarioData();
        if (window.atualizarHudPersonagemPalco) window.atualizarHudPersonagemPalco();
      }
    } else {
      this.fails++;
      this.applyHintsUI();
      
      if (fb) fb.innerHTML = `<span style="color: #f87171;">❌ Combinação incorreta! O cofre liberou uma descarga mágica (${this.failDamage} Dano).</span>`;

      if (window.obterUsuarioAtual && window.currentPartyCharacters && window.apiClient) {
        const user = window.obterUsuarioAtual();
        const meuChar = window.currentPartyCharacters.find(c => c.user_id === (user ? user.id : ''));
        if (meuChar) {
          await window.apiClient.triggerSceneAction(window.currentCampaignId, this.sceneData.id, {
            trigger: 'on_password_fail',
            actionType: 'apply_damage',
            actionParams: this.failDamage,
            characterId: meuChar.id
          });
          if (window.loadDiarioData) await window.loadDiarioData();
          if (window.atualizarHudPersonagemPalco) window.atualizarHudPersonagemPalco();
        }
      }
    }
  }

  applyHintsUI() {
    if (!this.hintsEnabled) return;

    // Level 1: Texto (Fails >= 1)
    if (this.fails >= 1) {
      const hintEl = this.container.querySelector('#cofre-hint-text');
      if (hintEl) hintEl.style.display = 'block';
    }

    // Calcula o "valor inserido" global
    let currentGlobalValue = 0;
    for (let i = 0; i < this.length; i++) {
       const charIdx = this.charset.indexOf(this.currentGuess[i]);
       currentGlobalValue += (charIdx !== -1 ? charIdx : 0);
    }

    // Level 2: Borda Global (Fails >= 3)
    if (this.fails >= 3) {
      const slotsContainer = this.container.querySelector('#cofre-slots-container');
      if (slotsContainer) {
        if (currentGlobalValue > this.targetGlobalValue) {
           slotsContainer.style.borderColor = '#ef4444'; // Vermelho (Maior)
        } else if (currentGlobalValue < this.targetGlobalValue) {
           slotsContainer.style.borderColor = '#3b82f6'; // Azul (Menor)
        } else {
           slotsContainer.style.borderColor = '#facc15'; // Amarelo (Igual soma, mas ordem errada)
        }
      }
    }

    // Level 3: RGB Posicional (Fails >= 5)
    if (this.fails >= 5) {
      for (let i = 0; i < this.length; i++) {
        const slot = this.container.querySelector(`#pwd-slot-${i}`);
        if (slot) {
          const gIdx = this.charset.indexOf(this.currentGuess[i]);
          const sIdx = this.charset.indexOf(this.secret[i]);
          
          if (gIdx === sIdx) slot.className = 'password-slot-box hint-exact';
          else if (gIdx > sIdx) slot.className = 'password-slot-box hint-high';
          else slot.className = 'password-slot-box hint-low';
        }
      }
    }
  }

  destroy() {
    if (this.container) this.container.innerHTML = '';
  }
}

window.CofreRunicoScene = CofreRunicoScene;
