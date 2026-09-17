
    let currentOtpEmail = '';
    let currentUser = null;

    // Pools pré-definidas de Avatares e Banners em alta resolução (Dark Fantasy)
    const CAMPAIGN_POOLS = {
      avatars: [
        { id: 'av_skull', url: 'https://images.unsplash.com/photo-1509281373149-e957c6296406?w=250', label: 'Crânio Arcano' },
        { id: 'av_dragon', url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=250', label: 'Dragão Sombrio' },
        { id: 'av_tome', url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=250', label: 'Grimório Ancestral' },
        { id: 'av_helmet', url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=250', label: 'Elmo Guerreiro' },
        { id: 'av_eye', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=250', label: 'Olho Cósmico' },
        { id: 'av_swords', url: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=250', label: 'Lâminas Rúnicas' }
      ],
      banners: [
        { id: 'bn_dungeon', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=900', label: 'Masmorra Sombria' },
        { id: 'bn_castle', url: 'https://images.unsplash.com/photo-1519817650390-64a93db51149?w=900', label: 'Castelo em Ruínas' },
        { id: 'bn_forest', url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=900', label: 'Floresta Amaldiçoada' },
        { id: 'bn_tavern', url: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=900', label: 'Taverna Noturna' },
        { id: 'bn_nebula', url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=900', label: 'Vórtice Místico' },
        { id: 'bn_mountains', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=900', label: 'Picos Gélidos' }
      ],
      systemsMap: {
        'dnd5e': { label: 'D&D 5ª Edição', badge: 'D&D 5e' },
        'tormenta20': { label: 'Tormenta 20', badge: 'Tormenta 20' },
        'cthulhu': { label: 'Chamado de Cthulhu 7e', badge: 'Cthulhu 7e' },
        'ordem': { label: 'Ordem Paranormal RPG', badge: 'Ordem Paranormal' },
        'custom': { label: 'Sistema Próprio / Livre', badge: 'Sistema Próprio' }
      },
      themesMap: {
        'dark-fantasy': { label: 'Fantasia Sombria', color: '#9b2c2c' },
        'high-fantasy': { label: 'Alta Fantasia Épica', color: '#b7791f' },
        'cosmic-horror': { label: 'Terror Cósmico & Mistério', color: '#553c9a' },
        'cyberpunk': { label: 'Cyberpunk & Sci-Fi', color: '#0987a0' },
        'investigation': { label: 'Investigação Sobrenatural', color: '#276749' }
      }
    };

    let selectedCampAvatar = CAMPAIGN_POOLS.avatars[0].url;
    let selectedCampBanner = CAMPAIGN_POOLS.banners[0].url;

    /**
     * Renderiza as opções visuais de Avatar e Banner dentro do Modal
     */
    function renderizarPoolsCampanha() {
      const avatarContainer = document.getElementById('pool-avatars-container');
      if (avatarContainer) {
        avatarContainer.innerHTML = CAMPAIGN_POOLS.avatars.map((av) => `
          <div class="pool-item-card ${av.url === selectedCampAvatar ? 'selected' : ''}" 
               onclick="selecionarAvatarPool('${av.url}', this)" 
               title="${av.label}">
            <img src="${av.url}" alt="${av.label}" loading="lazy">
          </div>
        `).join('');
      }

      const bannerContainer = document.getElementById('pool-banners-container');
      if (bannerContainer) {
        bannerContainer.innerHTML = CAMPAIGN_POOLS.banners.map((bn) => `
          <div class="pool-banner-card ${bn.url === selectedCampBanner ? 'selected' : ''}" 
               onclick="selecionarBannerPool('${bn.url}', this)" 
               title="${bn.label}">
            <img src="${bn.url}" alt="${bn.label}" loading="lazy">
          </div>
        `).join('');
      }
    }

    function selecionarAvatarPool(url, el) {
      selectedCampAvatar = url;
      document.querySelectorAll('.pool-item-card').forEach(c => c.classList.remove('selected'));
      if (el) el.classList.add('selected');
      atualizarPreviewCampanha();
    }

    function selecionarBannerPool(url, el) {
      selectedCampBanner = url;
      document.querySelectorAll('.pool-banner-card').forEach(c => c.classList.remove('selected'));
      if (el) el.classList.add('selected');
      atualizarPreviewCampanha();
    }

    function alterarVagasCampanha(delta) {
      const input = document.getElementById('camp-input-players');
      if (!input) return;
      let val = parseInt(input.value, 10) || 5;
      val = Math.min(Math.max(val + delta, 1), 12);
      input.value = val;
      atualizarPreviewCampanha();
    }

    function atualizarContadorLore(textarea) {
      const counter = document.getElementById('camp-lore-counter');
      if (!counter) return;
      const len = textarea.value.length;
      counter.textContent = `${len}/2000`;
      if (len >= 1950) counter.style.color = '#ef4444';
      else if (len >= 1700) counter.style.color = '#f59e0b';
      else counter.style.color = 'var(--gold-light)';
    }

    function atualizarPreviewCampanha() {
      const previewWrapper = document.getElementById('camp-card-preview-wrapper');
      if (!previewWrapper) return;

      const nameInput = document.getElementById('camp-input-name');
      const systemSelect = document.getElementById('camp-select-system');
      const themeSelect = document.getElementById('camp-select-theme');
      const playersInput = document.getElementById('camp-input-players');
      const loreInput = document.getElementById('camp-input-lore');

      const name = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : 'O Labirinto da Lua Negra';
      const systemKey = systemSelect ? systemSelect.value : 'custom';
      const themeKey = themeSelect ? themeSelect.value : 'dark-fantasy';
      const maxPlayers = playersInput ? playersInput.value : 5;
      const lore = (loreInput && loreInput.value.trim()) ? loreInput.value.trim() : 'Uma nova saga se inicia na Taverna...';

      const systemInfo = CAMPAIGN_POOLS.systemsMap[systemKey] || { label: 'Custom', badge: 'Custom' };
      const themeInfo = CAMPAIGN_POOLS.themesMap[themeKey] || { label: 'Dark Fantasy', color: '#9b2c2c' };

      previewWrapper.innerHTML = `
        <div class="campaign-horizontal-card">
          <div class="campaign-card-bg" style="background-image: url('${selectedCampBanner}');"></div>
          <div class="campaign-card-gradient"></div>
          <div class="campaign-card-inner">
            <img src="${selectedCampAvatar}" alt="Brasão" class="campaign-card-avatar">
            <div class="campaign-card-main">
              <div class="campaign-card-header-row">
                <h3 class="campaign-card-title">${name}</h3>
                <span class="badge-simple-id">#TAVERNA-XX</span>
              </div>
              <div class="campaign-badges-row">
                <span class="badge-system">${systemInfo.badge}</span>
                <span class="badge-theme" style="border-color: ${themeInfo.color};">${themeInfo.label}</span>
              </div>
              <p class="campaign-lore-snippet">${lore}</p>
            </div>
            <div class="campaign-card-meta">
              <span class="badge-players-count">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                </svg>
                0 / ${maxPlayers} Vagas
              </span>
              <span class="campaign-action-hint">Acessar Mesa &rarr;</span>
            </div>
          </div>
        </div>
      `;
    }

    function obterUsuarioAtual() {
      if (currentUser) return currentUser;
      try {
        const raw = localStorage.getItem('arcana_user_data');
        if (raw) currentUser = JSON.parse(raw);
      } catch (e) {}
      return currentUser;
    }

    function abrirModalCriarCampanha() {
      // 1. Verificação Estrita de Permissão no Frontend (Mestres, Admins e Superadmins)
      const user = obterUsuarioAtual();
      const role = String(user?.role || '').toLowerCase();
      if (role !== 'mestre' && role !== 'admin' && role !== 'superadmin') {
        mostrarToast('Apenas Mestres e Administradores possuem autorização para forjar novas campanhas.');
        return;
      }

      const modal = document.getElementById('modal-criar-campanha');
      if (modal) {
        modal.classList.add('active');
        renderizarPoolsCampanha();
        atualizarPreviewCampanha();
      }
    }

    function fecharModalCriarCampanha() {
      const modal = document.getElementById('modal-criar-campanha');
      if (modal) modal.classList.remove('active');
    }

    async function submeterCriacaoCampanha(event) {
      if (event) event.preventDefault();

      const nameInput = document.getElementById('camp-input-name');
      const systemSelect = document.getElementById('camp-select-system');
      const themeSelect = document.getElementById('camp-select-theme');
      const playersInput = document.getElementById('camp-input-players');
      const loreInput = document.getElementById('camp-input-lore');
      const btnSubmit = document.getElementById('btn-submit-criar-campanha');

      const name = nameInput ? nameInput.value.trim() : '';
      const systemId = systemSelect ? systemSelect.value : 'custom';
      const themeId = themeSelect ? themeSelect.value : 'dark-fantasy';
      const maxPlayers = playersInput ? parseInt(playersInput.value, 10) : 5;
      const loreDescription = loreInput ? loreInput.value.trim() : '';

      if (name.length < 3 || name.length > 60) {
        mostrarToast('O nome da campanha deve ter entre 3 e 60 caracteres.');
        return;
      }

      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Forjando mesa...';
      }

      try {
        if (window.apiClient) {
          const res = await window.apiClient.createCampaign({
            name,
            systemId,
            themeId,
            loreDescription,
            imageUrl: selectedCampAvatar,
            bannerUrl: selectedCampBanner,
            maxPlayers
          });

          if (res && res.sucesso) {
            mostrarToast(`Campanha "${name}" forjada com sucesso! ID: #${res.dados?.simple_id || ''}`);
            fecharModalCriarCampanha();
            if (nameInput) nameInput.value = '';
            if (loreInput) loreInput.value = '';
            carregarCampanhas();
          } else {
            mostrarToast(res?.erro || 'Falha ao forjar campanha.');
          }
        }
      } catch (err) {
        mostrarToast(`Erro: ${err.message}`);
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.textContent = 'Forjar Campanha';
        }
      }
    }

    async function carregarCampanhas() {
      const container = document.getElementById('campaigns-list-container');
      if (!container) return;

      const user = obterUsuarioAtual();
      const role = String(user?.role || '').toLowerCase();
      const canCreate = ['admin', 'superadmin', 'mestre'].includes(role);

      // Atualizar visibilidade do botão principal do cabeçalho
      const topBtnCreate = document.getElementById('btn-open-create-campaign');
      if (topBtnCreate) {
        topBtnCreate.style.display = canCreate ? 'flex' : 'none';
      }

      container.innerHTML = `
        <div class="loading-indicator">
          <div class="spinner"></div>
          <span>Consultando as crônicas da Taverna...</span>
        </div>
      `;

      try {
        if (!window.apiClient) return;
        const res = await window.apiClient.listCampaigns();

        if (res && res.sucesso && Array.isArray(res.dados)) {
          if (res.dados.length === 0) {
            container.innerHTML = `
              <div class="empty-state-box">
                <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
                  <line x1="9" y1="3" x2="9" y2="18"/>
                  <line x1="15" y1="6" x2="15" y2="21"/>
                </svg>
                <h3 class="empty-state-title">Ainda não existem campanhas criadas</h3>
                <p class="empty-state-text">Você ainda não faz parte de nenhuma mesa ou não forjou suas próprias campanhas.</p>
                ${canCreate ? `
                <button class="btn-create-campaign" onclick="abrirModalCriarCampanha()">
                  + Forjar Nova Campanha
                </button>
                ` : ''}
              </div>
            `;
            return;
          }

          container.innerHTML = res.dados.map(camp => {
            const systemInfo = CAMPAIGN_POOLS.systemsMap[camp.system_id] || { label: camp.system_id || 'Sistema Próprio', badge: camp.system_id || 'Custom' };
            const themeInfo = CAMPAIGN_POOLS.themesMap[camp.theme_id] || { label: 'Dark Fantasy', color: '#9b2c2c' };
            const avatar = camp.image_url || CAMPAIGN_POOLS.avatars[0].url;
            const banner = camp.banner_url || CAMPAIGN_POOLS.banners[0].url;
            const simpleId = camp.simple_id || 'CAMP-00';
            const currentPlayers = camp.current_players || 0;
            const maxPlayers = camp.max_players || 5;
            const isFull = currentPlayers >= maxPlayers;

            return `
              <div class="campaign-horizontal-card" onclick="abrirDetalhesCampanha('${camp.id}')">
                <div class="campaign-card-bg" style="background-image: url('${banner}');"></div>
                <div class="campaign-card-gradient"></div>
                <div class="campaign-card-inner">
                  <img src="${avatar}" alt="Brasão" class="campaign-card-avatar" onerror="this.src='${CAMPAIGN_POOLS.avatars[0].url}'">
                  <div class="campaign-card-main">
                    <div class="campaign-card-header-row">
                      <h3 class="campaign-card-title">${camp.name}</h3>
                      <span class="badge-simple-id" title="Código de compartilhamento da mesa">#${simpleId}</span>
                    </div>
                    <div class="campaign-badges-row">
                      <span class="badge-system">${systemInfo.badge}</span>
                      <span class="badge-theme" style="border-color: ${themeInfo.color};">${themeInfo.label}</span>
                      <span style="font-size: 11px; color: var(--text-dim);">• Cargo: <strong>${camp.user_role || 'Jogador'}</strong></span>
                    </div>
                    <p class="campaign-lore-snippet">${camp.lore_description || 'Sem lore ou sinopse informada para esta mesa.'}</p>
                  </div>
                  <div class="campaign-card-meta">
                    <span class="badge-players-count ${isFull ? 'full' : ''}">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                      </svg>
                      ${currentPlayers} / ${maxPlayers} Vagas
                    </span>
                    <span class="campaign-action-hint">Acessar Mesa &rarr;</span>
                  </div>
                </div>
              </div>
            `;
          }).join('');
        }
      } catch (err) {
        if (err.message && err.message.includes('Não autorizado') && currentUser) {
          const role = String(currentUser?.role || '').toLowerCase();
          const canCreate = ['admin', 'superadmin', 'mestre'].includes(role);
          
          container.innerHTML = `
            <div class="empty-state-box">
              <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
                <line x1="9" y1="3" x2="9" y2="18"/>
                <line x1="15" y1="6" x2="15" y2="21"/>
              </svg>
              <h3 class="empty-state-title">Ainda não existem campanhas criadas</h3>
              <p class="empty-state-text">Você ainda não faz parte de nenhuma mesa ou não forjou suas próprias campanhas.</p>
              ${canCreate ? `
              <button class="btn-create-campaign" onclick="abrirModalCriarCampanha()">
                + Forjar Nova Campanha
              </button>
              ` : ''}
            </div>
          `;
        } else {
          container.innerHTML = `
            <div class="empty-state-box">
              <p style="color: #ef4444;">Falha ao carregar campanhas: ${err.message}</p>
            </div>
          `;
        }
      }
    }

    async function abrirDetalhesCampanha(campId) {
      navegarPara('campanha-detalhes');
      const detailsBox = document.getElementById('campaign-details-content');
      if (!detailsBox) return;

      detailsBox.innerHTML = `
        <div class="loading-indicator">
          <div class="spinner"></div>
          <span>Consultando registros da mesa...</span>
        </div>
      `;

      try {
        if (!window.apiClient) return;
        const res = await window.apiClient.getCampaign({ campaignId: campId });

        if (res && res.sucesso && res.dados) {
          const camp = res.dados;
          const systemInfo = CAMPAIGN_POOLS.systemsMap[camp.system_id] || { label: camp.system_id, badge: 'Sistema' };
          const themeInfo = CAMPAIGN_POOLS.themesMap[camp.theme_id] || { label: camp.theme_id, color: '#9b2c2c' };
          const avatar = camp.image_url || CAMPAIGN_POOLS.avatars[0].url;
          const banner = camp.banner_url || CAMPAIGN_POOLS.banners[0].url;
          const players = Array.isArray(camp.players) ? camp.players : [];

          detailsBox.innerHTML = `
            <!-- Hero da Campanha -->
            <div class="campaign-details-hero" style="background-image: url('${banner}');">
              <div class="campaign-details-overlay"></div>
              <div class="campaign-details-hero-content">
                <img src="${avatar}" alt="Brasão" class="campaign-details-avatar" onerror="this.src='${CAMPAIGN_POOLS.avatars[0].url}'">
                <div style="flex: 1;">
                  <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <h1 style="font-family: var(--font-title); font-size: 1.8rem; margin: 0; color: var(--gold-light);">
                      ${camp.name}
                    </h1>
                    <button class="badge-simple-id" onclick="copiarCodigoConvite('${camp.simple_id}')" title="Clique para copiar código de convite" style="cursor: pointer; border: 1px solid var(--gold-primary);">
                      📋 #${camp.simple_id}
                    </button>
                  </div>
                  <div class="campaign-badges-row" style="margin-top: 8px;">
                    <span class="badge-system">${systemInfo.badge}</span>
                    <span class="badge-theme" style="border-color: ${themeInfo.color};">${themeInfo.label}</span>
                    <span style="font-size: 12px; color: var(--text-muted);">Mestre da Mesa: <strong>${camp.owner_name || 'Desconhecido'}</strong></span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Grade de Conteúdo da Mesa -->
            <div class="campaign-details-layout">
              <!-- Lore e Crônicas -->
              <div style="background: var(--bg-card); border: 1px solid var(--border-card); border-radius: var(--radius-lg); padding: 24px;">
                <h3 style="font-family: var(--font-title); color: var(--gold-light); margin-top: 0; margin-bottom: 14px; font-size: 1.2rem;">
                  📜 Crônicas & Lore da Aventura
                </h3>
                <div style="color: var(--text-main); font-size: 14px; line-height: 1.65; white-space: pre-line;">
                  ${camp.lore_description || 'Nenhum prelúdio narrativo registrado pelo Mestre desta mesa ainda.'}
                </div>
              </div>

              <!-- Vagas e Aventureiros Convocados -->
              <div style="display: flex; flex-direction: column; gap: 16px;">
                <div style="background: var(--bg-card); border: 1px solid var(--border-card); border-radius: var(--radius-lg); padding: 20px;">
                  <h4 style="font-family: var(--font-title); color: var(--gold-light); margin: 0 0 12px 0; font-size: 1.1rem; display: flex; justify-content: space-between; align-items: center;">
                    <span>Aventureiros</span>
                    <span class="badge-players-count" style="font-size: 11px;">
                      ${players.length} / ${camp.max_players} Vagas
                    </span>
                  </h4>
                  
                  <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${players.map(p => `
                      <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-surface); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                        <div style="display: flex; align-items: center; gap: 10px;">
                          <div style="width: 28px; height: 28px; border-radius: 50%; background: var(--gold-dark); border: 1px solid var(--gold-primary); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: var(--gold-light);">
                            ${(p.display_name || 'A')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style="font-size: 13px; font-weight: 600; color: var(--text-main);">${p.display_name}</div>
                            <div style="font-size: 11px; color: var(--text-dim);">${p.nickname ? '@' + p.nickname : ''}</div>
                          </div>
                        </div>
                        <span class="role-badge" style="font-size: 10px; padding: 2px 6px;">${p.role}</span>
                      </div>
                    `).join('')}
                  </div>
                </div>

                <!-- Botão de Ação: Adentrar o VTT -->
                <button class="btn-gold" style="width: 100%; padding: 14px; font-size: 14px;" onclick="mostrarToast('Conexão WebSocket da Sala VTT em tempo real conectará na próxima fase!')">
                  🎲 Adentrar Sessão no VTT
                </button>
              </div>
            </div>
          `;
        }
      } catch (err) {
        detailsBox.innerHTML = `<p style="color: #ef4444;">Erro ao carregar detalhes da campanha: ${err.message}</p>`;
      }
    }

    function copiarCodigoConvite(simpleId) {
      if (!simpleId) return;
      navigator.clipboard.writeText(simpleId).then(() => {
        mostrarToast(`Código #${simpleId} copiado para a área de transferência!`);
      }).catch(() => {
        mostrarToast(`Código: #${simpleId}`);
      });
    }

    /**
     * Alterna subviews dentro do painel de autenticação
     */
    function alternarAuthView(viewName) {
      const views = ['login', 'register', 'otp', 'blocked', 'profile-setup'];
      views.forEach(v => {
        const el = document.getElementById(`auth-subview-${v}`);
        if (el) el.style.display = (v === viewName) ? 'block' : 'none';
      });

      if (viewName === 'otp') {
        sessionStorage.setItem('arcana_auth_view', 'otp');
        if (currentOtpEmail) {
          sessionStorage.setItem('arcana_auth_otp_email', currentOtpEmail);
        }
      } else if (viewName === 'profile-setup') {
        sessionStorage.setItem('arcana_auth_view', 'profile-setup');
      } else {
        sessionStorage.removeItem('arcana_auth_view');
        sessionStorage.removeItem('arcana_auth_otp_email');
      }
    }

    /**
     * Dispara redirecionamento do Google OAuth 2.0
     */
    function iniciarLoginGoogle() {
      if (window.apiClient) {
        window.apiClient.loginWithGoogle();
      } else {
        mostrarToast('Erro: Cliente de API não inicializado.');
      }
    }

    /**
     * Alterna a visibilidade das seções da SPA e atualiza o estado visual do menu lateral
     */
    function navegarPara(telaId) {
      // 1. Atualizar visibilidade das seções
      const secoes = document.querySelectorAll('.view-section');
      secoes.forEach(secao => secao.classList.remove('active'));

      const secaoAlvo = document.getElementById(`view-${telaId}`);
      if (secaoAlvo) {
        secaoAlvo.classList.add('active');
      }

      // 2. Atualizar estado dos botões da sidebar
      const navBotoes = document.querySelectorAll('.nav-item-btn');
      navBotoes.forEach(btn => btn.classList.remove('active'));

      const botaoAlvo = document.getElementById(`nav-${telaId}`);
      if (botaoAlvo) {
        botaoAlvo.classList.add('active');
      }

      // Se for a tela de campanhas, carrega lista dinâmica
      if (telaId === 'campanhas') {
        carregarCampanhas();
      }

      // Se for a tela de administração, carrega lista de dispositivos bloqueados
      if (telaId === 'admin') {
        carregarDispositivosAdmin();
      }

      // 3. Salvar última tela no localStorage para persistência de navegação
      try {
        localStorage.setItem('arcana_active_view', telaId);
      } catch (e) {}
    }

    /**
     * Atualiza o contador regressivo da Biografia
     */
    function atualizarContadorBio(textarea) {
      const counter = document.getElementById('setup-bio-counter');
      if (!counter) return;
      const len = textarea.value.length;
      counter.textContent = `${len}/500`;
      if (len >= 480) {
        counter.style.color = '#ef4444';
      } else if (len >= 400) {
        counter.style.color = '#f59e0b';
      } else {
        counter.style.color = 'var(--gold-light)';
      }
    }

    /**
     * Submete a Criação de Perfil para o Gateway /api/sync
     */
    async function concluirCriacaoPerfil(event) {
      if (event) event.preventDefault();

      const nameInput = document.getElementById('setup-name');
      const nickInput = document.getElementById('setup-nickname');
      const ageSelect = document.getElementById('setup-age-group');
      const bioInput = document.getElementById('setup-bio');
      const wppInput = document.getElementById('setup-contact-whatsapp');
      const discInput = document.getElementById('setup-contact-discord');
      const instaInput = document.getElementById('setup-contact-instagram');
      const btnSubmit = document.getElementById('btn-submit-profile-setup');

      const name = nameInput ? nameInput.value.trim() : '';
      const nickname = nickInput ? nickInput.value.trim().replace(/^@+/, '') : '';
      const ageGroup = ageSelect ? ageSelect.value : '';
      const bio = bioInput ? bioInput.value.trim() : '';

      if (name.length < 2 || name.length > 60) {
        mostrarToast('O nome deve ter entre 2 e 60 caracteres.');
        return;
      }
      if (!/^[a-zA-Z0-9_]{3,25}$/.test(nickname)) {
        mostrarToast('O nickname deve ter entre 3 e 25 caracteres (apenas letras, números e underlines).');
        return;
      }
      if (!ageGroup) {
        mostrarToast('Selecione sua faixa etária.');
        return;
      }
      if (!bio) {
        mostrarToast('A biografia é obrigatória.');
        return;
      }
      if (bio.length > 500) {
        mostrarToast('A biografia não pode exceder 500 caracteres.');
        return;
      }

      const contacts = {
        whatsapp: wppInput ? wppInput.value.trim() : '',
        discord: discInput ? discInput.value.trim() : '',
        instagram: instaInput ? instaInput.value.trim() : ''
      };

      if (!window.apiClient) {
        mostrarToast('Erro: Cliente de API não inicializado.');
        return;
      }

      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Forjando Perfil...';
      }

      try {
        const res = await window.apiClient.setupProfile({
          name,
          nickname,
          ageGroup,
          bio,
          contacts,
          avatarUrl: '',
          bannerUrl: ''
        });

        // Carrega dados locais do usuário e atualiza sessão
        const rawUser = localStorage.getItem('arcana_user_data');
        let usuario = {};
        if (rawUser) {
          try { usuario = JSON.parse(rawUser); } catch (_) {}
        }
        usuario.displayName = name;
        usuario.name = name;
        usuario.nickname = nickname;
        usuario.profileCompleted = 1;
        if (res.perfil && res.perfil.role) {
          usuario.role = res.perfil.role;
        }

        sessionStorage.removeItem('arcana_auth_view');
        mostrarToast('Perfil forjado com sucesso! Bem-vindo à Taverna.');
        aplicarSessaoUsuario(usuario);
      } catch (err) {
        mostrarToast(err.message || 'Erro ao salvar perfil.');
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.textContent = 'Concluir e Adentrar a Taverna';
        }
      }
    }

    /**
     * Aplica sessão e dados do usuário na interface
     */
    function aplicarSessaoUsuario(usuario) {
      currentUser = usuario;
      if (!usuario.profileCompleted || usuario.profileCompleted === 0) {
        document.getElementById('auth-container').style.display = 'flex';
        document.getElementById('app-container').style.display = 'none';
        alternarAuthView('profile-setup');
        const setupName = document.getElementById('setup-name');
        if (setupName && !setupName.value && (usuario.displayName || usuario.name)) {
          setupName.value = usuario.displayName || usuario.name;
        }
        mostrarToast('Complete a criação do seu perfil de aventureiro para liberar a Taverna.');
        return;
      }

      document.getElementById('auth-container').style.display = 'none';
      document.getElementById('app-container').style.display = 'flex';

      const profileEmail = document.getElementById('profile-email');
      if (profileEmail) profileEmail.value = usuario.email || '';
      const profileName = document.getElementById('profile-name');
      if (profileName) profileName.value = usuario.displayName || usuario.name || '';
      const displayTitle = document.getElementById('profile-display-name');
      if (displayTitle) displayTitle.textContent = usuario.displayName || usuario.name || 'Aventureiro Arcano';
      const profileId = document.getElementById('profile-user-id');
      if (profileId) profileId.value = usuario.id || 'usr_arcana_vtt';

      const roleBadge = document.getElementById('badge-role-display');
      if (roleBadge) {
        const r = String(usuario.role || '').toLowerCase();
        let label = 'Jogador';
        if (r === 'superadmin') label = 'Superadmin';
        else if (r === 'admin') label = 'Administrador';
        else if (r === 'mestre') label = 'Mestre';
        else if (r === 'assistente de mestre') label = 'Assistente de Mestre';
        roleBadge.textContent = label;
      }

      const adminNav = document.getElementById('nav-item-admin');
      if (adminNav) {
        const r = String(usuario.role || '').toLowerCase();
        adminNav.style.display = (r === 'admin' || r === 'superadmin') ? 'block' : 'none';
      }

      try {
        localStorage.setItem('arcana_user_logged', 'true');
        localStorage.setItem('arcana_user_data', JSON.stringify(usuario));
        const ultimaTela = localStorage.getItem('arcana_active_view') || 'inicio';
        navegarPara(ultimaTela);
      } catch (e) {
        navegarPara('inicio');
      }
    }

    /**
     * Validação no Frontend de Formato de E-mail Real (RFC 5322 e domínios)
     */
    function validarFormatoEmailFrontend(email) {
      if (!email || typeof email !== 'string') {
        return { valid: false, reason: 'Por favor, informe um endereço de e-mail.' };
      }

      const clean = email.trim().toLowerCase();

      if (clean.length > 254 || clean.length < 5) {
        return { valid: false, reason: 'O e-mail deve ter entre 5 e 254 caracteres.' };
      }

      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
      if (!emailRegex.test(clean)) {
        return { valid: false, reason: 'Formato de e-mail inválido. Utilize a estrutura nome@dominio.com' };
      }

      const parts = clean.split('@');
      if (parts.length !== 2) {
        return { valid: false, reason: 'O e-mail deve conter exatamente um "@".' };
      }

      const [user, domain] = parts;
      if (!user || !domain) {
        return { valid: false, reason: 'Nome ou domínio do e-mail não podem estar vazios.' };
      }

      if (user.startsWith('.') || user.endsWith('.') || user.includes('..')) {
        return { valid: false, reason: 'O nome do e-mail não pode começar, terminar ou conter pontos consecutivos.' };
      }

      const domainParts = domain.split('.');
      if (domainParts.length < 2) {
        return { valid: false, reason: 'O domínio do e-mail precisa conter uma extensão válida (ex: .com, .com.br).' };
      }

      const tld = domainParts[domainParts.length - 1];
      if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) {
        return { valid: false, reason: 'A extensão final do domínio do e-mail é inválida.' };
      }

      const disposable = ['tempmail.com', 'mailinator.com', '10minutemail.com', 'guerrillamail.com', 'throwawaymail.com', 'fake.com', 'teste.com', 'trashmail.com', 'yopmail.com', 'dispostable.com'];
      if (disposable.includes(domain)) {
        return { valid: false, reason: 'Provedores de e-mail temporários ou descartáveis não são aceitos.' };
      }

      // 1. Detecção de caracteres excessivamente repetidos (ex: 2222, 1111, aaaa)
      if (/([a-zA-Z0-9])\1{3,}/.test(user)) {
        return { valid: false, reason: 'O e-mail contém caracteres repetidos em sequência (ex: 2222), indicando um endereço fictício.' };
      }

      // 2. Detecção de prefixos fictícios ou de teste óbvios
      if (/^(teste|test|fake|falso|ficticio|asdf|qwerty|temp|lixo|naoexiste|invalido|random|exemplo|example|anonimo)/i.test(user)) {
        return { valid: false, reason: 'Endereços fictícios ou de teste não são permitidos. Utilize seu e-mail real.' };
      }

      // 3. Regras para provedores populares
      if (domain === 'gmail.com' || domain === 'googlemail.com') {
        if (/^\d+$/.test(user)) {
          return { valid: false, reason: 'E-mails do Gmail não podem ser compostos apenas por números.' };
        }
        if (user.length < 6 || user.length > 30) {
          return { valid: false, reason: 'O nome de usuário do Gmail deve ter entre 6 e 30 caracteres.' };
        }
      }

      if (['outlook.com', 'hotmail.com', 'yahoo.com', 'yahoo.com.br', 'live.com'].includes(domain)) {
        if (/^\d{6,}$/.test(user)) {
          return { valid: false, reason: 'Endereços puramente numéricos não são aceitos neste provedor.' };
        }
      }

      return { valid: true, cleanEmail: clean };
    }

    /**
     * Realiza o login do usuário exclusivamente através do Backend Gateway
     */
    async function fazerLogin(event) {
      if (event) event.preventDefault();

      const emailInput = document.getElementById('login-email');
      const passInput = document.getElementById('login-password');
      const rawEmail = emailInput ? emailInput.value : '';
      const password = passInput ? passInput.value : '';

      const check = validarFormatoEmailFrontend(rawEmail);
      if (!check.valid) {
        mostrarToast(check.reason);
        return;
      }
      const email = check.cleanEmail;

      if (!password || password.length < 6) {
        mostrarToast('Informe sua senha cadastrada (mínimo 6 caracteres).');
        return;
      }

      if (!window.apiClient) {
        mostrarToast('Erro: Cliente de API não inicializado.');
        return;
      }

      try {
        const res = await window.apiClient.login(email, password);
        if (res.requerCriacaoPerfil || !res.usuario?.profileCompleted) {
          alternarAuthView('profile-setup');
          const setupName = document.getElementById('setup-name');
          if (setupName && res.usuario && res.usuario.displayName) {
            setupName.value = res.usuario.displayName;
          }
          mostrarToast('Conclua seu perfil de aventureiro para entrar na taverna.');
        } else {
          aplicarSessaoUsuario(res.usuario);
          mostrarToast(`Bem-vindo à taverna, ${res.usuario.displayName || 'aventureiro'}!`);
        }
      } catch (err) {
        if (err.codigo === 'EMAIL_NOT_VERIFIED' || (err.status === 403 && err.payload && err.payload.requerVerificacao)) {
          currentOtpEmail = email;
          alternarAuthView('otp');
          const sub = document.getElementById('otp-subtitle-text');
          if (sub) sub.textContent = `Esta conta ainda não foi confirmada. Digite o código de 6 dígitos enviado para ${email}.`;
          mostrarToast('Acesso bloqueado: confirme seu e-mail com o código de 6 dígitos.');
          return;
        }
        if (err.codigo === 'DEVICE_BLOCKED') {
          alternarAuthView('blocked');
          const hashEl = document.getElementById('blocked-device-fingerprint');
          if (hashEl && err.payload && err.payload.deviceHash) {
            hashEl.textContent = err.payload.deviceHash;
          }
          mostrarToast('Atenção: Dispositivo travado por segurança anti-Sybil.');
          return;
        }
        if (err.status === 401 || err.status === 400) {
          mostrarToast(err.message || 'Credenciais inválidas. Se ainda não possui conta, clique em "Criar conta".');
          return;
        }
        const msg = (err.message || '').toLowerCase();
        if (msg.includes('failed to fetch') || msg.includes('networkerror') || !err.status) {
          mostrarToast('Não foi possível conectar ao servidor backend (porta 8787). Inicie o servidor com "npm start".');
          return;
        }
        console.warn('Erro ao autenticar com a API:', err);
        mostrarToast(err.message || 'Erro ao efetuar login.');
      }
    }

    /**
     * Cadastra nova conta com e-mail e senha exclusivamente através do Backend Gateway
     */
    async function fazerRegistro(event) {
      if (event) event.preventDefault();

      const nameInput = document.getElementById('register-name');
      const emailInput = document.getElementById('register-email');
      const passInput = document.getElementById('register-password');
      const name = nameInput ? nameInput.value.trim() : '';
      const rawEmail = emailInput ? emailInput.value : '';
      const password = passInput ? passInput.value : '';

      const check = validarFormatoEmailFrontend(rawEmail);
      if (!check.valid) {
        mostrarToast(check.reason);
        return;
      }
      const email = check.cleanEmail;

      if (!name) {
        mostrarToast('Informe seu nome de aventureiro.');
        return;
      }
      if (!password || password.length < 6) {
        mostrarToast('A senha deve ter no mínimo 6 caracteres.');
        return;
      }

      if (!window.apiClient) {
        mostrarToast('Erro: Cliente de API não inicializado.');
        return;
      }

      try {
        const res = await window.apiClient.register(email, password, name);
        if (res.requerVerificacao) {
          currentOtpEmail = email;
          alternarAuthView('otp');
          const sub = document.getElementById('otp-subtitle-text');
          if (sub) sub.textContent = `Código de 6 dígitos enviado para ${email}. Digite-o para ativar sua conta.`;
          mostrarToast(res.mensagem || 'Conta criada! Digite o código de 6 dígitos enviado para seu e-mail.');
        }
      } catch (err) {
        if (err.codigo === 'DEVICE_BLOCKED') {
          alternarAuthView('blocked');
          const hashEl = document.getElementById('blocked-device-fingerprint');
          if (hashEl && err.payload && err.payload.deviceHash) {
            hashEl.textContent = err.payload.deviceHash;
          }
          mostrarToast('Atenção: Dispositivo travado por segurança.');
          return;
        }
        const msg = (err.message || '').toLowerCase();
        if (msg.includes('failed to fetch') || msg.includes('networkerror') || !err.status) {
          mostrarToast('Não foi possível conectar ao servidor backend (porta 8787). Inicie o servidor com "npm start".');
          return;
        }
        mostrarToast(err.message || 'Erro ao criar conta.');
      }
    }

    /**
     * Confirma o código OTP de 6 dígitos exclusivamente através do Backend Gateway
     */
    async function confirmarCodigoOTP(event) {
      if (event) event.preventDefault();
      const codeInput = document.getElementById('otp-code-input');
      const code = codeInput ? codeInput.value.trim() : '';

      if (!currentOtpEmail) {
        mostrarToast('E-mail não identificado. Retorne ao login ou registro.');
        alternarAuthView('login');
        return;
      }

      if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
        mostrarToast('Digite o código numérico com exatamente 6 dígitos.');
        return;
      }

      if (!window.apiClient) {
        mostrarToast('Erro: Cliente de API não inicializado.');
        return;
      }

      try {
        const res = await window.apiClient.verifyEmail(currentOtpEmail, code);
        sessionStorage.removeItem('arcana_auth_view');
        sessionStorage.removeItem('arcana_auth_otp_email');
        if (res.requerCriacaoPerfil || !res.usuario?.profileCompleted) {
          alternarAuthView('profile-setup');
          const setupName = document.getElementById('setup-name');
          if (setupName && res.usuario && res.usuario.displayName) {
            setupName.value = res.usuario.displayName;
          }
          mostrarToast('E-mail confirmado! Agora forje sua identidade de aventureiro.');
        } else {
          aplicarSessaoUsuario(res.usuario);
          mostrarToast('E-mail confirmado com sucesso! Acesso à taverna liberado.');
        }
      } catch (err) {
        const msg = (err.message || '').toLowerCase();
        if (msg.includes('failed to fetch') || msg.includes('networkerror') || !err.status) {
          mostrarToast('Não foi possível conectar ao servidor backend (porta 8787).');
          return;
        }
        mostrarToast(err.message || 'Código de 6 dígitos incorreto ou expirado.');
      }
    }

    /**
     * Reenvia o código OTP de 6 dígitos exclusivamente através do Backend Gateway
     */
    async function reenviarCodigoOTP() {
      if (!currentOtpEmail) {
        mostrarToast('Informe seu e-mail no login ou cadastro primeiro.');
        return;
      }

      if (!window.apiClient) {
        mostrarToast('Erro: Cliente de API não inicializado.');
        return;
      }

      try {
        const res = await window.apiClient.resendCode(currentOtpEmail);
        if (res._codigoTesteDev) {
          mostrarToast(`[DEV/TESTE] Novo código gerado: ${res._codigoTesteDev}`);
        } else {
          mostrarToast('Novo código de 6 dígitos enviado para seu e-mail!');
        }
      } catch (err) {
        const msg = (err.message || '').toLowerCase();
        if (msg.includes('failed to fetch') || msg.includes('networkerror') || !err.status) {
          mostrarToast('Não foi possível conectar ao servidor backend (porta 8787).');
          return;
        }
        mostrarToast(err.message || 'Erro ao reenviar código.');
      }
    }

    /**
     * Realiza o logout do usuário, retornando para a tela de autenticação
     */
    async function fazerLogout() {
      if (window.apiClient) {
        try {
          await window.apiClient.logout();
        } catch (e) {}
      }

      try {
        localStorage.removeItem('arcana_user_logged');
        localStorage.removeItem('arcana_user_data');
        localStorage.removeItem('arcana_token');
      } catch (e) {}

      document.getElementById('app-container').style.display = 'none';
      document.getElementById('auth-container').style.display = 'flex';
      alternarAuthView('login');
      mostrarToast('Você saiu da taverna.');
    }

    /**
     * Carrega a lista de dispositivos bloqueados no Painel de Administração
     */
    async function carregarDispositivosAdmin() {
      const tbody = document.getElementById('admin-devices-tbody');
      const badgeTotal = document.getElementById('badge-total-blocked');
      if (!tbody) return;

      if (!window.apiClient) {
        tbody.innerHTML = '<tr><td colspan="5" class="table-empty-msg">API Client não inicializado.</td></tr>';
        return;
      }

      try {
        const res = await window.apiClient.adminListDevices();
        const dispositivos = res.dados || res.dispositivos || [];
        if (badgeTotal) badgeTotal.textContent = `${dispositivos.length} bloqueados`;

        if (dispositivos.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" class="table-empty-msg">Nenhum dispositivo bloqueado no momento. A taverna está segura!</td></tr>';
          return;
        }

        tbody.innerHTML = dispositivos.map(d => `
          <tr>
            <td class="device-hash-cell" title="${d.device_hash}">${d.device_hash.substring(0, 16)}...</td>
            <td><span class="badge-blocked-pill">${d.blocked_reason || 'Limite Excedido'}</span></td>
            <td style="font-weight: 600;">${d.account_count}</td>
            <td style="color: var(--text-muted); font-size: 12.5px;">${new Date(d.blocked_at || d.updated_at).toLocaleString('pt-BR')}</td>
            <td style="text-align: right;">
              <button class="btn-unblock" onclick="liberarDispositivo('${d.device_hash}')">Liberar Dispositivo</button>
            </td>
          </tr>
        `).join('');
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="table-empty-msg" style="color: #f87171;">Erro ao carregar dispositivos: ${err.message}</td></tr>`;
      }
    }

    /**
     * Libera dispositivo com 1 clique direto pelo painel web
     */
    async function liberarDispositivo(deviceHash) {
      if (!confirm(`Deseja realmente liberar a trava do dispositivo ${deviceHash}?`)) return;

      if (window.apiClient) {
        try {
          await window.apiClient.adminUnblockDevice(deviceHash);
          mostrarToast('Dispositivo liberado com sucesso!');
          carregarDispositivosAdmin();
        } catch (err) {
          mostrarToast(`Erro ao liberar: ${err.message}`);
        }
      }
    }

    /**
     * Alterna abas de categoria na Biblioteca de Assets
     */
    function selecionarAbaBiblioteca(botao, categoria) {
      const abas = document.querySelectorAll('.filter-tab-btn');
      abas.forEach(aba => aba.classList.remove('active'));
      botao.classList.add('active');

      const box = document.getElementById('library-status-box');
      if (box) {
        box.innerHTML = `<p>Nenhum asset na categoria <strong>${categoria}</strong> por enquanto.</p>`;
      }
    }

    /**
     * Copia o ID do usuário para a área de transferência
     */
    function copiarIdUsuario() {
      const idInput = document.getElementById('profile-user-id');
      if (idInput) {
        navigator.clipboard.writeText(idInput.value).then(() => {
          mostrarToast('ID copiado com sucesso!');
        }).catch(() => {
          idInput.select();
          document.execCommand('copy');
          mostrarToast('ID copiado com sucesso!');
        });
      }
    }

    /**
     * Salva as alterações de perfil simuladas
     */
    function salvarPerfil(event) {
      if (event) event.preventDefault();
      const nomeInput = document.getElementById('profile-name');
      const displayTitle = document.getElementById('profile-display-name');

      if (nomeInput && displayTitle) {
        displayTitle.textContent = nomeInput.value;
      }

      mostrarToast('Alterações salvas com sucesso!');
    }

    /**
     * Abre ou fecha o modal de ajuda
     */
    function toggleModalAjuda() {
      const modal = document.getElementById('modal-ajuda');
      if (modal) {
        modal.classList.toggle('active');
      }
    }

    /**
     * Exibe notificação temporária no estilo Toast
     */
    let toastTimeout;
    function mostrarToast(mensagem) {
      const toast = document.getElementById('toast-message');
      const toastText = document.getElementById('toast-text');
      if (!toast || !toastText) return;

      toastText.textContent = mensagem;
      toast.classList.add('show');

      clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }

    // Inicialização ao carregar a página
    window.addEventListener('DOMContentLoaded', () => {
      try {
        // 1. Detecta retorno do Google com perfil pendente
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('login') === 'google_profile_setup') {
          window.history.replaceState({}, document.title, window.location.pathname);
          document.getElementById('auth-container').style.display = 'flex';
          document.getElementById('app-container').style.display = 'none';
          alternarAuthView('profile-setup');
          mostrarToast('Conta do Google conectada! Complete seu perfil de aventureiro.');
          return;
        }

        const estaLogado = localStorage.getItem('arcana_user_logged') === 'true';
        if (estaLogado) {
          const rawUser = localStorage.getItem('arcana_user_data');
          if (rawUser) {
            const usuario = JSON.parse(rawUser);
            aplicarSessaoUsuario(usuario);
          } else {
            document.getElementById('auth-container').style.display = 'none';
            document.getElementById('app-container').style.display = 'flex';
            const ultimaTela = localStorage.getItem('arcana_active_view') || 'inicio';
            navegarPara(ultimaTela);
          }
        } else {
          document.getElementById('auth-container').style.display = 'flex';
          document.getElementById('app-container').style.display = 'none';

          // Preserva a tela de confirmação de código OTP ou de perfil caso a página recarregue
          const savedAuthView = sessionStorage.getItem('arcana_auth_view');
          const savedOtpEmail = sessionStorage.getItem('arcana_auth_otp_email');
          if (savedAuthView === 'otp' && savedOtpEmail) {
            currentOtpEmail = savedOtpEmail;
            alternarAuthView('otp');
            const sub = document.getElementById('otp-subtitle-text');
            if (sub) sub.textContent = `Código de 6 dígitos enviado para ${savedOtpEmail}. Digite-o para ativar sua conta.`;
          } else if (savedAuthView === 'profile-setup') {
            alternarAuthView('profile-setup');
          } else {
            alternarAuthView('login');
          }
        }
      } catch (e) {
        document.getElementById('auth-container').style.display = 'flex';
        document.getElementById('app-container').style.display = 'none';
        alternarAuthView('login');
      }
    });
  