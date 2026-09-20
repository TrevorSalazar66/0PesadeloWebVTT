/**
 * Cena: Mahjong / Campo Minado (Modelo 2)
 */
class MahjongMinasScene {
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

    this.rows = modelData.rows || 6;
    this.cols = modelData.cols || 6;
    this.bombCount = modelData.bombCount || 6;
    this.bombDamage = modelData.bombDamage || 4;
    
    // ICONS_POOL para mapear números de 0 a 8
    const pool = ['💎', '🔮', '📜', '🗝️', '🗡️', '🛡️', '👑', '⚡', '🌙'];
    // Embaralha o pool para a sessão
    this.symbolMap = pool.sort(() => Math.random() - 0.5); 

    this.board = [];
    this.phase = 1; // 1: Revelação (todos visíveis), 2: Dedução (ocultos)
    this.revealedCards = [];
    this.matchedCount = 0;
    this.totalPairs = 0;
    this.isBusy = false;
    
    this.generateBoard();
  }

  generateBoard() {
    this.board = [];
    for (let r = 0; r < this.rows; r++) {
      const row = [];
      for (let c = 0; c < this.cols; c++) {
        row.push({
          r, c,
          isBomb: false,
          adjacent: 0,
          symbol: '',
          cleared: false,
          flipped: true // Começam viradas para cima na Fase 1
        });
      }
      this.board.push(row);
    }

    // Distribui bombas
    let bombsPlaced = 0;
    while (bombsPlaced < this.bombCount) {
      let r = Math.floor(Math.random() * this.rows);
      let c = Math.floor(Math.random() * this.cols);
      if (!this.board[r][c].isBomb) {
        this.board[r][c].isBomb = true;
        this.board[r][c].symbol = '💣';
        bombsPlaced++;
      }
    }

    // Calcula adjacências
    const frequencies = {};
    
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.board[r][c].isBomb) {
          let adj = this.countAdjacentBombs(r, c);
          this.board[r][c].adjacent = adj;
          this.board[r][c].symbol = this.symbolMap[adj];
          
          if (!frequencies[adj]) frequencies[adj] = 0;
          frequencies[adj]++;
        }
      }
    }

    // Conta o total de pares possíveis
    this.totalPairs = 0;
    Object.keys(frequencies).forEach(k => {
      this.totalPairs += Math.floor(frequencies[k] / 2);
    });
  }

  countAdjacentBombs(r, c) {
    let count = 0;
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        if (i === 0 && j === 0) continue;
        let nr = r + i, nc = c + j;
        if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
          if (this.board[nr][nc].isBomb) count++;
        }
      }
    }
    return count;
  }

  async handleCardClick(r, c) {
    if (this.isBusy) return;
    const card = this.board[r][c];
    if (card.cleared) return;

    if (this.phase === 1) {
      // Qualquer clique na Fase 1 ativa a Fase 2 (Ocultação)
      this.phase = 2;
      for (let i = 0; i < this.rows; i++) {
        for (let j = 0; j < this.cols; j++) {
          this.board[i][j].flipped = false;
        }
      }
      this.render();
      return;
    }

    // Fase 2: Lógica de jogo
    if (card.flipped) return;

    card.flipped = true;
    
    if (card.isBomb) {
      this.render();
      await this.hitBomb();
      return;
    }

    this.revealedCards.push(card);
    this.render();

    if (this.revealedCards.length === 2) {
      this.isBusy = true;
      const [c1, c2] = this.revealedCards;
      
      if (c1.symbol === c2.symbol) {
        // MATCH
        setTimeout(() => {
          c1.cleared = true;
          c2.cleared = true;
          this.matchedCount++;
          this.revealedCards = [];
          this.isBusy = false;
          this.checkWinCondition();
          this.render();
        }, 600);
      } else {
        // MISS
        setTimeout(() => {
          c1.flipped = false;
          c2.flipped = false;
          this.revealedCards = [];
          this.isBusy = false;
          this.render();
        }, 1000);
      }
    }
  }

  async hitBomb() {
    this.isBusy = true;
    
    if (window.obterUsuarioAtual && window.currentPartyCharacters && window.apiClient) {
      const user = window.obterUsuarioAtual();
      const meuChar = window.currentPartyCharacters.find(c => c.user_id === (user ? user.id : ''));
      if (meuChar) {
        await window.apiClient.triggerSceneAction(window.currentCampaignId, this.sceneData.id, {
          trigger: 'on_password_fail', // Reaproveitado para hitBomb na engine
          actionType: 'apply_damage',
          actionParams: this.bombDamage,
          characterId: meuChar.id
        });
        if (window.loadDiarioData) await window.loadDiarioData();
        if (window.atualizarHudPersonagemPalco) window.atualizarHudPersonagemPalco();
      }
    }

    setTimeout(() => {
      // Vira todas as cartas para reiniciar a fase de revelação (Punição leve)
      this.phase = 1;
      this.revealedCards = [];
      for (let i = 0; i < this.rows; i++) {
        for (let j = 0; j < this.cols; j++) {
          if (!this.board[i][j].cleared) {
             this.board[i][j].flipped = true;
          }
        }
      }
      this.isBusy = false;
      this.render();
    }, 1500);
  }

  async checkWinCondition() {
    if (this.matchedCount >= this.totalPairs) {
      // Venceu!
      // Limpa sobras (ímpares que não formam pares)
      for (let i = 0; i < this.rows; i++) {
        for (let j = 0; j < this.cols; j++) {
          if (!this.board[i][j].isBomb) {
             this.board[i][j].cleared = true;
          }
        }
      }
      this.render();
      
      alert("Parabéns! Você resolveu o Enigma do Mahjong/Campo Minado!");
      
      if (window.obterUsuarioAtual && window.currentPartyCharacters && window.apiClient) {
        const user = window.obterUsuarioAtual();
        const meuChar = window.currentPartyCharacters.find(c => c.user_id === (user ? user.id : ''));
        await window.apiClient.triggerSceneAction(window.currentCampaignId, this.sceneData.id, {
          trigger: 'on_score_reach',
          actionType: 'award_xp',
          actionParams: 50,
          characterId: meuChar ? meuChar.id : null
        });
        if (window.loadDiarioData) await window.loadDiarioData();
        if (window.atualizarHudPersonagemPalco) window.atualizarHudPersonagemPalco();
      }
    }
  }

  render() {
    if (!this.container) return;
    
    // UI header info
    let html = `
      <div style="margin-bottom: 16px; display: flex; justify-content: center; gap: 16px;">
        <div class="pill-info">Fase: ${this.phase === 1 ? 'Revelação (Clique para Esconder)' : 'Dedução (Encontre os Pares)'}</div>
        <div class="pill-info" id="mahjong-score-pill">Pares: ${this.matchedCount}/${this.totalPairs}</div>
      </div>
      <div class="mahjong-grid-board" style="display: grid; grid-template-columns: repeat(${this.cols}, 60px); gap: 10px; justify-content: center; margin-top:20px;">
    `;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const card = this.board[r][c];
        let content = '❓';
        let extraClass = 'hidden';

        if (card.cleared) {
          extraClass = 'cleared';
          content = '';
        } else if (card.flipped) {
          content = card.symbol;
          extraClass = card.isBomb ? 'bomb' : 'revealed';
        }

        html += `
          <div class="mahjong-tile-card ${extraClass}" data-r="${r}" data-c="${c}">
            ${content}
          </div>
        `;
      }
    }
    
    html += `</div>`;
    this.container.innerHTML = html;
    
    // Bind click events
    const tiles = this.container.querySelectorAll('.mahjong-tile-card');
    tiles.forEach(tile => {
      tile.addEventListener('click', (e) => {
        const r = parseInt(e.currentTarget.getAttribute('data-r'));
        const c = parseInt(e.currentTarget.getAttribute('data-c'));
        this.handleCardClick(r, c);
      });
    });
  }

  destroy() {
    this.container.innerHTML = '';
  }
}

window.MahjongMinasScene = MahjongMinasScene;
