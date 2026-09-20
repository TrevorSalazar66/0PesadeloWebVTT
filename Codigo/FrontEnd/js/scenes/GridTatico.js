/**
 * Cena: Grid Tático (Modelo 1)
 */
class GridTaticoScene {
  constructor(containerId, sceneData, noCodeEngine, p2pManager) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.sceneData = sceneData;
    this.engine = noCodeEngine;
    this.p2p = p2pManager; // Not rigorously passed yet in campanha.js, but good to have
    
    // Configurações do mapa
    let modelData = {};
    try {
      modelData = typeof sceneData.model_data === 'string' ? JSON.parse(sceneData.model_data) : (sceneData.model_data || {});
    } catch (e) {
      modelData = {};
    }
    
    this.rows = modelData.rows || 12;
    this.cols = modelData.cols || 16;
    this.matrix = modelData.matrix || [];
    
    // Estado local do jogador (inicializa lendo o global se existir)
    this.playerX = window.palcoPlayerPosition ? window.palcoPlayerPosition.x : 0;
    this.playerY = window.palcoPlayerPosition ? window.palcoPlayerPosition.y : 0;
    
    // Direção (facing) para interações: {dx, dy}
    this.facing = { dx: 0, dy: 1 }; 
    
    // Tokens remotos (sincronizados via P2P)
    this.remoteTokens = window.palcoRemoteTokens || {}; 
    
    // Raio de visão
    this.sightRadius = 8;
  }

  // --- Inicialização e Sincronização ---
  
  setPlayerPosition(x, y) {
    this.playerX = x;
    this.playerY = y;
  }
  
  updateRemoteTokens(tokensMap) {
    this.remoteTokens = tokensMap;
    this.render();
  }

  // --- Algoritmo de Linha de Visão (Fog of War) ---
  
  // Função auxiliar para verificar se uma célula bloqueia a visão
  isSolid(x, y) {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return true;
    const cell = this.matrix[y] && this.matrix[y][x];
    if (cell && cell.l2) {
      if (window.getAssetById) {
        const asset = window.getAssetById(cell.l2);
        return asset && asset.solid;
      }
    }
    return false;
  }

  // Bresenham's line algorithm simples para checar visibilidade
  checkLineOfSight(x0, y0, x1, y1) {
    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);
    let sx = (x0 < x1) ? 1 : -1;
    let sy = (y0 < y1) ? 1 : -1;
    let err = dx - dy;

    let cx = x0;
    let cy = y0;

    while (true) {
      if (cx === x1 && cy === y1) return true;
      if (this.isSolid(cx, cy) && (cx !== x0 || cy !== y0)) return false; // Bloqueado no meio do caminho

      let e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        cx += sx;
      }
      if (e2 < dx) {
        err += dx;
        cy += sy;
      }
    }
  }

  calculateVisibility() {
    const visibleSet = new Set();
    // Apenas marca como visível o que estiver no raio de visão e com LoS livre
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        // Distância Euclidiana
        const dist = Math.sqrt(Math.pow(c - this.playerX, 2) + Math.pow(r - this.playerY, 2));
        if (dist <= this.sightRadius) {
          if (this.checkLineOfSight(this.playerX, this.playerY, c, r)) {
            visibleSet.add(`${c},${r}`);
          }
        }
      }
    }
    return visibleSet;
  }

  // --- Movimentação e Controles ---
  
  handleKeyDown(e) {
    if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.movePlayer(0, -1);
    } else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
      e.preventDefault();
      this.movePlayer(0, 1);
    } else if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
      e.preventDefault();
      this.movePlayer(-1, 0);
    } else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
      e.preventDefault();
      this.movePlayer(1, 0);
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      this.interact();
    }
  }

  movePlayer(dx, dy) {
    this.facing = { dx, dy };
    
    const targetX = this.playerX + dx;
    const targetY = this.playerY + dy;

    // Limites do mapa
    if (targetX < 0 || targetX >= this.cols || targetY < 0 || targetY >= this.rows) return;

    // Colisão Layer 2
    if (this.isSolid(targetX, targetY)) return;

    // Movimentação permitida
    this.playerX = targetX;
    this.playerY = targetY;
    
    // Atualiza a posição no estado global do campanha.js para broadcast e reload
    if (window.palcoPlayerPosition) {
      window.palcoPlayerPosition.x = targetX;
      window.palcoPlayerPosition.y = targetY;
    }
    
    // Sincroniza via P2P
    if (window.obterUsuarioAtual && window.syncService) {
      const user = window.obterUsuarioAtual();
      const me = window.currentPartyCharacters ? window.currentPartyCharacters.find(c => c.user_id === user.id) : null;
      if (me) {
        window.syncService.broadcastStateUpdate({
          type: 'token_move',
          charId: me.id,
          charName: me.nome,
          avatar: me.avatar,
          x: targetX,
          y: targetY
        });
      }
    }

    this.render();
  }

  async interact() {
    // Interage com o tile à frente do jogador
    const targetX = this.playerX + this.facing.dx;
    const targetY = this.playerY + this.facing.dy;
    
    if (targetX < 0 || targetX >= this.cols || targetY < 0 || targetY >= this.rows) return;
    
    const cellData = this.matrix[targetY][targetX];
    if (cellData) {
      // Dispara os gatilhos usando a engine
      if (window.testarEDispararGatilhos) {
        await window.testarEDispararGatilhos('on_tile_click', targetX, targetY, cellData);
      }
    }
  }

  // --- Renderização HTML ---
  
  render() {
    if (!this.container) return;
    
    const visibleTiles = this.calculateVisibility();
    
    const table = document.createElement('table');
    table.className = 'grid-board';
    table.id = 'scene-interactive-grid';
    table.style.display = 'table';
    
    // Recuperar usuário atual para desenhar o token local
    const user = window.obterUsuarioAtual ? window.obterUsuarioAtual() : null;
    const meuChar = window.currentPartyCharacters && user ? window.currentPartyCharacters.find(c => c.user_id === user.id) : null;

    for (let r = 0; r < this.rows; r++) {
      const tr = document.createElement('tr');
      for (let c = 0; c < this.cols; c++) {
        const cellData = (this.matrix[r] && this.matrix[r][c]) ? this.matrix[r][c] : { l1: 'floor_stone', l2: null, l3: null };
        const td = document.createElement('td');
        td.className = 'grid-board-cell';
        td.dataset.row = r;
        td.dataset.col = c;
        
        // Verifica visibilidade (Fog of War)
        const isVisible = visibleTiles.has(`${c},${r}`);
        
        if (isVisible) {
          // Camada 1
          const l1Asset = window.getAssetById ? window.getAssetById(cellData.l1) : {icon: '🪨'};
          const l1Div = document.createElement('div');
          l1Div.className = 'cell-l1';
          l1Div.innerHTML = l1Asset ? l1Asset.icon : '🪨';
          td.appendChild(l1Div);

          // Camada 2
          if (cellData.l2) {
            const l2Asset = window.getAssetById ? window.getAssetById(cellData.l2) : null;
            if (l2Asset) {
              const l2Div = document.createElement('div');
              l2Div.className = 'cell-l2';
              l2Div.innerHTML = l2Asset.icon;
              td.appendChild(l2Div);
            }
          }

          // Camada 3
          if (cellData.l3) {
            const l3Asset = window.getAssetById ? window.getAssetById(cellData.l3) : null;
            if (l3Asset) {
              const l3Div = document.createElement('div');
              l3Div.className = 'cell-l3';
              l3Div.innerHTML = l3Asset.icon;
              td.appendChild(l3Div);
            }
          }

          // Tokens de outros jogadores remotos
          if (this.remoteTokens) {
             Object.keys(this.remoteTokens).forEach(peerCharId => {
               const remoteToken = this.remoteTokens[peerCharId];
               if (remoteToken.x === c && remoteToken.y === r) {
                 const rTokenDiv = document.createElement('div');
                 rTokenDiv.className = 'grid-token-entity';
                 rTokenDiv.innerHTML = remoteToken.avatar || '🧙';

                 const rNameTag = document.createElement('div');
                 rNameTag.className = 'grid-token-name';
                 rNameTag.innerText = remoteToken.charName || 'Herói';
                 rTokenDiv.appendChild(rNameTag);
                 td.appendChild(rTokenDiv);
               }
             });
          }
          
          // Token do Jogador Local
          if (this.playerX === c && this.playerY === r) {
            const tokenDiv = document.createElement('div');
            tokenDiv.className = 'grid-token-entity token-player';
            tokenDiv.innerHTML = meuChar ? (meuChar.avatar || '🗡️') : '🛡️';

            const nameTag = document.createElement('div');
            nameTag.className = 'grid-token-name';
            nameTag.innerText = meuChar ? meuChar.nome : (user ? user.username : 'Você');
            tokenDiv.appendChild(nameTag);

            td.appendChild(tokenDiv);
          }
        } else {
           // Fora do Line of Sight: Renderiza apenas a Layer 4 (Névoa)
           const l4Div = document.createElement('div');
           l4Div.className = 'cell-l4';
           td.appendChild(l4Div);
        }

        td.addEventListener('click', () => {
          if (window.testarEDispararGatilhos) {
             window.testarEDispararGatilhos('on_tile_click', c, r, cellData);
          }
        });

        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
    
    this.container.innerHTML = '';
    this.container.appendChild(table);
  }

  destroy() {
    this.container.innerHTML = '';
  }
}

window.GridTaticoScene = GridTaticoScene;
