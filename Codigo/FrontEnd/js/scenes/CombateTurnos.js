/**
 * Cena: Combate por Turnos (Modelo 5)
 */
class CombateTurnosScene {
  constructor(containerId, sceneData, noCodeEngine, syncService) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.sceneData = sceneData;
    this.engine = noCodeEngine;
    this.syncService = syncService;
    
    // Configurações do Modelo de Combate
    let modelData = {};
    try {
      modelData = typeof sceneData.model_data === 'string' ? JSON.parse(sceneData.model_data) : (sceneData.model_data || {});
    } catch (e) {
      modelData = {};
    }

    this.enemiesPerPlayer = modelData.enemiesPerPlayer || 2;
    
    // Estado da Batalha
    this.heroes = [];
    this.enemies = [];
    this.initiativeQueue = [];
    this.currentTurnIndex = 0;
    this.currentWave = 1;
    this.isBattleOver = false;

    // Recursos do Turno
    this.currentAp = 0;
    this.maxAp = 3;

    this.initializeBattle();
  }

  initializeBattle() {
    this.loadHeroes();
    this.spawnWave();
    this.rollInitiative();
  }

  loadHeroes() {
    // Carrega os heróis presentes na party (simulação de leitura do window.currentPartyCharacters)
    if (window.currentPartyCharacters && window.currentPartyCharacters.length > 0) {
       this.heroes = window.currentPartyCharacters.map(c => ({
         id: c.id,
         name: c.name,
         avatar: c.avatar_url || '👤',
         hp: c.anima_atual,
         maxHp: c.anima_maxima,
         initiativeScore: (c.mente || 3) + (c.agilidade || 3) + Math.floor(Math.random() * 20),
         isHero: true,
         userId: c.user_id
       }));
    } else {
       // Mock fallback
       this.heroes = [{
         id: 'h1', name: 'Herói Teste', avatar: '🛡️', hp: 20, maxHp: 20, initiativeScore: 15, isHero: true, userId: window.obterUsuarioAtual?.()?.id || 'u1'
       }];
    }
  }

  spawnWave() {
    console.log(`[Combate] Spawnando Wave ${this.currentWave}...`);
    this.enemies = [];
    const totalEnemies = this.heroes.length * this.enemiesPerPlayer;
    
    for (let i = 0; i < totalEnemies; i++) {
       this.enemies.push({
         id: `e_${this.currentWave}_${i}`,
         name: `Esqueleto Lacaio ${i+1}`,
         avatar: '💀',
         hp: 10,
         maxHp: 10,
         initiativeScore: Math.floor(Math.random() * 20) + 5,
         isHero: false
       });
    }
  }

  rollInitiative() {
    this.initiativeQueue = [...this.heroes, ...this.enemies];
    this.initiativeQueue.sort((a, b) => b.initiativeScore - a.initiativeScore);
    this.currentTurnIndex = 0;
    this.startTurn();
  }

  startTurn() {
    if (this.isBattleOver) return;

    const activeCombatant = this.initiativeQueue[this.currentTurnIndex];
    if (activeCombatant.hp <= 0) {
      this.nextTurn();
      return;
    }

    if (activeCombatant.isHero) {
      this.currentAp = this.maxAp;
    } else {
      // Turno de Inimigo: Simula Ação e passa
      setTimeout(() => {
        this.executeEnemyTurn(activeCombatant);
      }, 1500);
    }
    this.render();
  }

  executeEnemyTurn(enemy) {
    if (this.isBattleOver || enemy.hp <= 0) return;
    
    // Simula ataque no primeiro herói vivo
    const aliveHero = this.heroes.find(h => h.hp > 0);
    if (aliveHero) {
       this.applyDamage(aliveHero, 2);
    }
    this.nextTurn();
  }

  nextTurn() {
    this.currentTurnIndex++;
    if (this.currentTurnIndex >= this.initiativeQueue.length) {
      this.currentTurnIndex = 0;
    }
    this.startTurn();
  }

  applyDamage(target, amount) {
    target.hp -= amount;
    if (target.hp < 0) target.hp = 0;
    console.log(`[Combate] ${target.name} sofreu ${amount} de dano! HP: ${target.hp}`);

    // Check Win/Loss conditions
    this.checkWinLoss();
    this.render();
  }

  checkWinLoss() {
    const aliveHeroes = this.heroes.filter(h => h.hp > 0);
    const aliveEnemies = this.enemies.filter(e => e.hp > 0);

    if (aliveHeroes.length === 0) {
      this.isBattleOver = true;
      alert("A equipe foi derrotada! (on_party_defeat)");
      if (this.engine) this.engine.triggerSceneAction(window.currentCampaignId, this.sceneData.id, { trigger: 'on_party_defeat' });
    } else if (aliveEnemies.length === 0) {
      alert(`Onda ${this.currentWave} eliminada! (on_wave_clear)`);
      if (this.engine) this.engine.triggerSceneAction(window.currentCampaignId, this.sceneData.id, { trigger: 'on_wave_clear' });
      this.currentWave++;
      this.spawnWave();
      this.rollInitiative(); // Re-roll for new wave
    }
  }

  useAction(cost, callback) {
    const active = this.initiativeQueue[this.currentTurnIndex];
    if (!active.isHero) return; // Não pode agir no turno do inimigo
    
    if (this.currentAp >= cost) {
      this.currentAp -= cost;
      callback();
      if (this.currentAp <= 0) {
        this.nextTurn();
      } else {
        this.render(); // Update AP display
      }
    } else {
      alert("PA Insuficiente!");
    }
  }

  handlePlayerAttack() {
    this.useAction(1, () => {
       // Auto-target o primeiro inimigo vivo para simplificar o protótipo
       const aliveEnemy = this.enemies.find(e => e.hp > 0);
       if (aliveEnemy) {
         this.applyDamage(aliveEnemy, 5);
       }
    });
  }

  handlePlayerMagic() {
    this.useAction(2, () => {
       const aliveEnemy = this.enemies.find(e => e.hp > 0);
       if (aliveEnemy) {
         this.applyDamage(aliveEnemy, 10);
       }
    });
  }

  render() {
    if (!this.container) return;
    
    const initBar = document.getElementById('combat-initiative-bar');
    const heroesSide = document.getElementById('combat-heroes-side');
    const enemiesSide = document.getElementById('combat-enemies-side');
    const activeName = document.getElementById('combat-active-name');
    const activeHp = document.getElementById('combat-active-hp');
    const activeAp = document.getElementById('combat-active-ap');
    const btnAttack = document.getElementById('btn-combat-attack');
    const btnMagic = document.getElementById('btn-combat-magic');
    const btnItem = document.getElementById('btn-combat-item');

    if (!initBar) return; // Segurança

    // Render Initiative
    initBar.innerHTML = this.initiativeQueue.map((c, idx) => {
      const isCurrent = idx === this.currentTurnIndex;
      const border = isCurrent ? '2px solid #fbbf24' : '1px solid #475569';
      const opacity = c.hp <= 0 ? '0.3' : '1';
      return `<div style="min-width: 40px; height: 40px; background: #0f172a; border: ${border}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; opacity: ${opacity};" title="${c.name}">
                ${c.avatar.length > 2 && c.avatar.includes('http') ? `<img src="${c.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : c.avatar}
              </div>`;
    }).join('');

    // Render Heroes
    heroesSide.innerHTML = this.heroes.map(h => {
      const isCurrent = (this.initiativeQueue[this.currentTurnIndex].id === h.id);
      return `<div style="background: #1e293b; border: ${isCurrent ? '2px solid #60a5fa' : '1px solid #334155'}; border-radius: 8px; padding: 12px; width: 200px; display: flex; gap: 12px; opacity: ${h.hp <= 0 ? '0.4' : '1'};">
         <div style="font-size: 32px;">${h.avatar}</div>
         <div style="flex: 1;">
            <div style="font-weight: bold; font-size: 14px;">${h.name}</div>
            <div style="background: #0f172a; height: 8px; border-radius: 4px; margin-top: 4px; overflow: hidden;">
               <div style="background: #ef4444; width: ${(h.hp / h.maxHp) * 100}%; height: 100%;"></div>
            </div>
            <div style="font-size: 10px; color: #94a3b8; text-align: right; margin-top: 2px;">${h.hp}/${h.maxHp}</div>
         </div>
      </div>`;
    }).join('');

    // Render Enemies
    enemiesSide.innerHTML = this.enemies.map(e => {
      const isCurrent = (this.initiativeQueue[this.currentTurnIndex].id === e.id);
      return `<div style="background: #1e293b; border: ${isCurrent ? '2px solid #ef4444' : '1px solid #334155'}; border-radius: 8px; padding: 12px; width: 200px; display: flex; gap: 12px; flex-direction: row-reverse; opacity: ${e.hp <= 0 ? '0.4' : '1'};">
         <div style="font-size: 32px;">${e.avatar}</div>
         <div style="flex: 1;">
            <div style="font-weight: bold; font-size: 14px; text-align: right;">${e.name}</div>
            <div style="background: #0f172a; height: 8px; border-radius: 4px; margin-top: 4px; overflow: hidden;">
               <div style="background: #ef4444; width: ${(e.hp / e.maxHp) * 100}%; height: 100%;"></div>
            </div>
            <div style="font-size: 10px; color: #94a3b8; text-align: left; margin-top: 2px;">${e.hp}/${e.maxHp}</div>
         </div>
      </div>`;
    }).join('');

    // Render Panel
    const activeCombatant = this.initiativeQueue[this.currentTurnIndex];
    if (activeCombatant) {
      activeName.innerText = activeCombatant.name;
      activeHp.innerText = `${activeCombatant.hp}/${activeCombatant.maxHp}`;
      activeAp.innerText = activeCombatant.isHero ? this.currentAp : 'NPC';
      
      const disableBtns = !activeCombatant.isHero || activeCombatant.userId !== (window.obterUsuarioAtual?.()?.id || 'u1');
      btnAttack.disabled = disableBtns;
      btnMagic.disabled = disableBtns;
      btnItem.disabled = disableBtns;
      
      btnAttack.style.opacity = disableBtns ? '0.5' : '1';
      btnMagic.style.opacity = disableBtns ? '0.5' : '1';
      btnItem.style.opacity = disableBtns ? '0.5' : '1';
    }

    // Handlers
    btnAttack.onclick = () => this.handlePlayerAttack();
    btnMagic.onclick = () => this.handlePlayerMagic();
    btnItem.onclick = () => {
      this.useAction(1, () => alert("Você usou um item!"));
    };
  }

  destroy() {
    this.isBattleOver = true;
  }
}

window.CombateTurnosScene = CombateTurnosScene;
