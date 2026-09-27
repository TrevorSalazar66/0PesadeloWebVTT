/**
 * Módulo Global de Visualização de Perfil de Usuários (Modal de Aventureiro)
 * RetroForge VTT - Arcana
 * Permite visualizar o perfil completo de qualquer aventureiro ao clicar em seu @nickname ou avatar.
 */

(function () {
  // Estilos CSS do Modal injetados dinamicamente
  const styleEl = document.createElement('style');
  styleEl.id = 'arcana-perfil-modal-styles';
  styleEl.textContent = `
    .clickable-nickname {
      cursor: pointer;
      color: var(--gold-light, #e5b758) !important;
      font-weight: 600;
      transition: color 0.18s ease, text-shadow 0.18s ease;
      display: inline-flex;
      align-items: center;
      gap: 2px;
    }
    .clickable-nickname:hover {
      color: #fff !important;
      text-shadow: 0 0 8px rgba(229, 183, 88, 0.6);
      text-decoration: underline;
    }

    .perfil-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(4, 4, 8, 0.78);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.25s;
    }

    .perfil-modal-overlay.active {
      opacity: 1;
      visibility: visible;
    }

    .perfil-modal-card {
      background: #10101d;
      border: 1px solid rgba(212, 163, 75, 0.35);
      border-radius: 16px;
      width: 100%;
      max-width: 580px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.85), 0 0 30px rgba(212, 163, 75, 0.12);
      transform: scale(0.95) translateY(12px);
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
      display: flex;
      flex-direction: column;
    }

    .perfil-modal-overlay.active .perfil-modal-card {
      transform: scale(1) translateY(0);
    }

    /* HERO BANNER */
    .perfil-modal-banner {
      width: 100%;
      height: 180px;
      background: linear-gradient(135deg, rgba(20, 20, 36, 0.95) 0%, rgba(30, 25, 45, 0.9) 100%);
      background-size: cover;
      background-position: center;
      position: relative;
      border-radius: 15px 15px 0 0;
      border-bottom: 1px solid rgba(212, 163, 75, 0.25);
      overflow: hidden;
    }

    .perfil-modal-banner::after {
      content: '';
      position: absolute;
      inset: 0;
      z-index: 2;
      background: linear-gradient(to top, rgba(16, 16, 29, 0.92) 0%, rgba(16, 16, 29, 0.25) 50%, rgba(0, 0, 0, 0.45) 100%);
      pointer-events: none;
    }

    .perfil-modal-btn-close {
      position: absolute;
      top: 14px;
      right: 14px;
      z-index: 10;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: rgba(16, 16, 29, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #f5f5f7;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.18s ease;
      backdrop-filter: blur(4px);
    }

    .perfil-modal-btn-close:hover {
      background: rgba(239, 68, 68, 0.8);
      border-color: #ef4444;
      transform: scale(1.08);
    }

    /* CORPO DO PERFIL */
    .perfil-modal-body {
      padding: 0 24px 24px 24px;
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    /* AVATAR HERO */
    .perfil-modal-avatar-wrapper {
      margin-top: -50px;
      position: relative;
      z-index: 5;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .perfil-modal-avatar {
      width: 96px;
      height: 96px;
      border-radius: 50%;
      border: 3px solid #d4a34b;
      box-shadow: 0 0 20px rgba(212, 163, 75, 0.35), 0 8px 16px rgba(0, 0, 0, 0.6);
      background: #141424;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 38px;
      font-family: 'Cinzel', serif, Georgia;
      font-weight: 700;
      color: #e5b758;
      overflow: hidden;
      flex-shrink: 0;
    }

    .perfil-modal-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .perfil-modal-role-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border: 1px solid rgba(212, 163, 75, 0.4);
      background: rgba(212, 163, 75, 0.15);
      color: #e5b758;
    }

    .perfil-modal-role-badge.superadmin {
      background: rgba(239, 68, 68, 0.2);
      border-color: rgba(239, 68, 68, 0.5);
      color: #f87171;
    }

    .perfil-modal-role-badge.mestre {
      background: rgba(168, 85, 247, 0.2);
      border-color: rgba(168, 85, 247, 0.5);
      color: #c084fc;
    }

    /* CABEÇALHO DE NOMES */
    .perfil-modal-title-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .perfil-modal-name {
      font-family: 'Cinzel', serif, Georgia;
      font-size: 1.45rem;
      font-weight: 700;
      color: #f5f5f7;
      margin: 0;
      line-height: 1.2;
    }

    .perfil-modal-nick-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .perfil-modal-nickname {
      font-size: 0.95rem;
      font-weight: 600;
      color: #e5b758;
      background: rgba(212, 163, 75, 0.1);
      border: 1px solid rgba(212, 163, 75, 0.25);
      padding: 2px 8px;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
    }

    .perfil-modal-nickname:hover {
      background: rgba(212, 163, 75, 0.2);
      border-color: #d4a34b;
    }

    .perfil-modal-meta-text {
      font-size: 0.8rem;
      color: #8e8ea6;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    /* BIOGRAFIA & CRÔNICAS */
    .perfil-modal-bio-card {
      background: rgba(11, 11, 20, 0.6);
      border: 1px solid #1e1e32;
      border-radius: 10px;
      padding: 14px 16px;
      position: relative;
    }

    .perfil-modal-section-title {
      font-size: 0.78rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #e5b758;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .perfil-modal-bio-content {
      font-size: 0.88rem;
      color: #d1d1e0;
      line-height: 1.55;
      white-space: pre-wrap;
      word-break: break-word;
      font-style: italic;
    }

    /* GRID DE ESTATÍSTICAS */
    .perfil-modal-stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }

    .perfil-modal-stat-box {
      background: rgba(20, 20, 36, 0.6);
      border: 1px solid #25253e;
      border-radius: 10px;
      padding: 10px;
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .perfil-modal-stat-num {
      font-family: 'Cinzel', serif, Georgia;
      font-size: 1.35rem;
      font-weight: 700;
      color: #e5b758;
    }

    .perfil-modal-stat-label {
      font-size: 0.72rem;
      color: #8e8ea6;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    /* CONTATOS & REDES */
    .perfil-modal-contacts-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .perfil-modal-contact-chip {
      background: rgba(20, 20, 36, 0.8);
      border: 1px solid #25253e;
      border-radius: 8px;
      padding: 6px 12px;
      font-size: 0.82rem;
      color: #f5f5f7;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.18s ease;
    }

    .perfil-modal-contact-chip:hover {
      border-color: #d4a34b;
      background: rgba(212, 163, 75, 0.12);
      color: #e5b758;
      transform: translateY(-1px);
    }

    /* FOOTER DO MODAL */
    .perfil-modal-footer {
      border-top: 1px solid #1e1e32;
      padding-top: 14px;
      margin-top: 4px;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    .perfil-modal-btn {
      padding: 8px 18px;
      border-radius: 8px;
      font-size: 0.88rem;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid #25253e;
      background: #141424;
      color: #f5f5f7;
      transition: all 0.18s ease;
    }

    .perfil-modal-btn:hover {
      border-color: #d4a34b;
      color: #e5b758;
    }

    /* LOADING & SPINNER */
    .perfil-modal-loading {
      padding: 60px 20px;
      text-align: center;
      color: #8e8ea6;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
    }

    .perfil-modal-spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(212, 163, 75, 0.2);
      border-top-color: #d4a34b;
      border-radius: 50%;
      animation: arcanaSpin 0.8s linear infinite;
    }

    @keyframes arcanaSpin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(styleEl);

  // Cria a estrutura HTML do modal se não existir
  function garantirModalDOM() {
    let overlay = document.getElementById('modal-perfil-aventureiro-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'modal-perfil-aventureiro-overlay';
      overlay.className = 'perfil-modal-overlay';
      overlay.innerHTML = `
        <div class="perfil-modal-card" id="perfil-modal-card-element" role="dialog" aria-modal="true">
          <button type="button" class="perfil-modal-btn-close" onclick="window.fecharModalPerfilUsuario()" title="Fechar">✕</button>
          
          <div id="perfil-modal-container-content">
            <!-- Conteúdo dinâmico será injetado aqui -->
          </div>
        </div>
      `;

      // Fechar ao clicar fora do card
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          window.fecharModalPerfilUsuario();
        }
      });

      document.body.appendChild(overlay);
    }
    return overlay;
  }

  // Fecha o modal
  window.fecharModalPerfilUsuario = function () {
    const overlay = document.getElementById('modal-perfil-aventureiro-overlay');
    if (overlay) {
      overlay.classList.remove('active');
    }
  };

  // Fecha com a tecla ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.fecharModalPerfilUsuario();
    }
  });

  /**
   * Abre o modal com os dados do perfil especificado
   * @param {string|object} target - Nickname com/sem @ ou userId (usr_...)
   */
  window.abrirModalPerfilUsuario = async function (target) {
    if (!target) return;
    const overlay = garantirModalDOM();
    const container = document.getElementById('perfil-modal-container-content');
    if (!container) return;

    // Extrai o identificador limpo
    let rawIdentifier = typeof target === 'string' ? target.trim() : (target.nickname || target.userId || target.user_id || '');
    if (typeof rawIdentifier === 'string') {
      rawIdentifier = rawIdentifier.replace(/^@+/, '');
    }

    if (!rawIdentifier) return;

    // Estado inicial de carregamento
    overlay.classList.add('active');
    container.innerHTML = `
      <div class="perfil-modal-loading">
        <div class="perfil-modal-spinner"></div>
        <div style="font-family: 'Cinzel', serif; font-size: 15px; color: var(--gold-light, #e5b758);">
          Consultando os Arquivos da Taverna...
        </div>
        <div style="font-size: 12px; color: #8e8ea6;">Buscando crônicas de @${escapeHtml(rawIdentifier)}</div>
      </div>
    `;

    try {
      const client = window.apiClient;
      if (!client) {
        throw new Error('Cliente da API não inicializado.');
      }

      const res = await client.getUserProfile(rawIdentifier);

      if (!res || !res.sucesso || !res.dados) {
        throw new Error(res?.erro || 'Aventureiro não encontrado ou perfil indisponível.');
      }

      const dados = res.dados;
      const user = dados.user || dados || {};
      const profile = dados.profile || dados.perfil || {};
      const stats = dados.stats || {};

      const displayName = profile.displayName || profile.name || user.displayName || user.name || user.display_name || 'Aventureiro Arcano';
      const nickname = profile.nickname || user.nickname || rawIdentifier;
      const bio = profile.bio || 'Este aventureiro prefere deixar seus atos falarem mais alto do que palavras. Nenhuma crônica cadastrada.';
      const avatarUrl = profile.avatarUrl || profile.avatar_url || user.avatarUrl || user.avatar_url || dados.avatar_url || '';
      const bannerUrl = profile.bannerUrl || profile.banner_url || dados.banner_url || '';
      const role = String(user.role || dados.role || 'jogador').toLowerCase();
      const initial = (displayName[0] || 'A').toUpperCase();

      // Formatação de data
      let dataFormatada = 'Membro Honorário';
      if (user.created_at || dados.created_at) {
        try {
          const dt = new Date(user.created_at || dados.created_at);
          dataFormatada = `Membro desde ${dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
        } catch (_) {}
      }

      // Role Badge
      let roleLabel = 'Jogador';
      let roleClass = 'jogador';
      if (role === 'superadmin') {
        roleLabel = '👑 Superadmin';
        roleClass = 'superadmin';
      } else if (role === 'admin') {
        roleLabel = '🛡️ Administrador';
        roleClass = 'superadmin';
      } else if (role === 'mestre') {
        roleLabel = '⚔️ Mestre de RPG';
        roleClass = 'mestre';
      }

      // Estilo e Imagem do Banner
      const bannerHTML = bannerUrl
        ? `<img src="${escapeHtml(bannerUrl)}" alt="Banner de ${escapeHtml(displayName)}" referrerpolicy="no-referrer" style="width: 100%; height: 100%; object-fit: cover; position: absolute; inset: 0; z-index: 1;" onerror="this.style.display='none';">`
        : '';
      const bannerStyle = bannerUrl
        ? `background-image: url('${escapeHtml(bannerUrl)}');`
        : `background: linear-gradient(135deg, #18182c 0%, #281a38 100%);`;

      // Avatar HTML
      const avatarHTML = avatarUrl
        ? `<img src="${escapeHtml(avatarUrl)}" alt="Avatar" referrerpolicy="no-referrer" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" onerror="this.onerror=null; this.parentElement.textContent='${initial}';">`
        : initial;

      // Contatos Sociais
      const contacts = profile.contacts || {};
      const chipsContatos = [];
      if (profile.contactDiscord || contacts.discord) {
        const disc = escapeHtml(profile.contactDiscord || contacts.discord);
        chipsContatos.push(`
          <div class="perfil-modal-contact-chip" title="Clique para copiar Discord" onclick="navigator.clipboard.writeText('${disc}'); alert('Discord copiado: ${disc}');" style="cursor: pointer;">
            <span>💬</span> <strong>Discord:</strong> ${disc}
          </div>
        `);
      }
      if (profile.contactInstagram || contacts.instagram) {
        const insta = escapeHtml((profile.contactInstagram || contacts.instagram).replace(/^@+/, ''));
        chipsContatos.push(`
          <a href="https://instagram.com/${insta}" target="_blank" rel="noopener noreferrer" class="perfil-modal-contact-chip">
            <span>📷</span> <strong>Instagram:</strong> @${insta}
          </a>
        `);
      }
      if (profile.contactWhatsapp || contacts.whatsapp) {
        const zap = escapeHtml(profile.contactWhatsapp || contacts.whatsapp).replace(/[^0-9+]/g, '');
        chipsContatos.push(`
          <a href="https://wa.me/${zap}" target="_blank" rel="noopener noreferrer" class="perfil-modal-contact-chip">
            <span>📱</span> <strong>WhatsApp</strong>
          </a>
        `);
      }

      container.innerHTML = `
        <div class="perfil-modal-banner" style="${bannerStyle}">
          ${bannerHTML}
        </div>
        
        <div class="perfil-modal-body">
          <div class="perfil-modal-avatar-wrapper">
            <div class="perfil-modal-avatar">
              ${avatarHTML}
            </div>
            <span class="perfil-modal-role-badge ${roleClass}">${roleLabel}</span>
          </div>

          <div class="perfil-modal-title-row">
            <h2 class="perfil-modal-name">${escapeHtml(displayName)}</h2>
            <div class="perfil-modal-nick-row">
              <span class="perfil-modal-nickname" title="Clique para copiar nickname" onclick="navigator.clipboard.writeText('@${escapeHtml(nickname)}'); alert('Nickname @${escapeHtml(nickname)} copiado!');">
                @${escapeHtml(nickname)} 📋
              </span>
              <span class="perfil-modal-meta-text">
                <span>📅 ${dataFormatada}</span>
                <span>•</span>
                <span>Faixa: ${escapeHtml(profile.ageGroup || profile.ageRange || '18-24')}</span>
              </span>
            </div>
          </div>

          <!-- BIOGRAFIA -->
          <div class="perfil-modal-bio-card">
            <div class="perfil-modal-section-title">📜 Crônicas & Biografia</div>
            <div class="perfil-modal-bio-content">${escapeHtml(bio)}</div>
          </div>

          <!-- ESTATÍSTICAS -->
          <div class="perfil-modal-stats-grid">
            <div class="perfil-modal-stat-box">
              <div class="perfil-modal-stat-num">${stats.participatingCampaigns ?? stats.totalCampaigns ?? 0}</div>
              <div class="perfil-modal-stat-label">Mesas Ativas</div>
            </div>
            <div class="perfil-modal-stat-box">
              <div class="perfil-modal-stat-num">${stats.masterCampaigns ?? stats.totalCreatedCampaigns ?? 0}</div>
              <div class="perfil-modal-stat-label">Campanhas Mestradas</div>
            </div>
            <div class="perfil-modal-stat-box">
              <div class="perfil-modal-stat-num">${stats.charactersCreated ?? stats.totalCharacters ?? 0}</div>
              <div class="perfil-modal-stat-label">Heróis Criados</div>
            </div>
          </div>

          <!-- CONTATOS -->
          ${chipsContatos.length > 0 ? `
            <div>
              <div class="perfil-modal-section-title" style="margin-bottom: 8px;">🌐 Meios de Contato & Social</div>
              <div class="perfil-modal-contacts-list">
                ${chipsContatos.join('')}
              </div>
            </div>
          ` : ''}

          <!-- FOOTER -->
          <div class="perfil-modal-footer">
            <button type="button" class="perfil-modal-btn" onclick="window.fecharModalPerfilUsuario()">
              Fechar
            </button>
          </div>
        </div>
      `;

    } catch (err) {
      container.innerHTML = `
        <div class="perfil-modal-loading" style="padding: 40px 20px;">
          <div style="font-size: 32px;">⚠️</div>
          <div style="font-family: 'Cinzel', serif; font-size: 16px; color: #ef4444;">
            Registro Não Encontrado
          </div>
          <p style="font-size: 13px; color: #8e8ea6; max-width: 380px;">
            ${escapeHtml(err.message || 'Não foi possível carregar as informações deste aventureiro.')}
          </p>
          <button type="button" class="perfil-modal-btn" style="margin-top: 10px;" onclick="window.fecharModalPerfilUsuario()">
            Voltar
          </button>
        </div>
      `;
    }
  };

  // Event Delegation Global para cliques em qualquer nickname (@)
  document.addEventListener('click', (e) => {
    // 1. Elemento com classe ou atributo explícito
    const el = e.target.closest('.clickable-nickname, [data-user-nickname], [data-user-id]');
    if (el) {
      const uid = el.getAttribute('data-user-id');
      const nick = el.getAttribute('data-user-nickname') || el.textContent.trim().replace(/^@+/, '');
      if (uid || nick) {
        e.preventDefault();
        e.stopPropagation();
        window.abrirModalPerfilUsuario(uid || nick);
        return;
      }
    }

    // 2. Se clicou em qualquer elemento cujo texto seja um @nickname (ex: @trevorrot)
    const target = e.target;
    if (target && target.textContent) {
      const txt = target.textContent.trim();
      const match = txt.match(/^@([a-zA-Z0-9_]{3,25})$/);
      if (match && match[1]) {
        e.preventDefault();
        e.stopPropagation();
        window.abrirModalPerfilUsuario(match[1]);
      }
    }
  });

  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
