/**
 * Serviço de Governança e Administração — Arcana / RetroForge VTT
 * Exclusivo para usuários com papel 'admin' ou 'superadmin'
 */
import { dbQueries } from '../db/queries.js';

const VALID_ROLES = new Set(['jogador', 'assistente de mestre', 'mestre', 'admin', 'superadmin']);

export const adminService = {
  /**
   * Obtém métricas e estatísticas globais da plataforma
   */
  async getPlatformStats(db, user) {
    const userRole = String(user.role || '').toLowerCase();
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      return { status: 403, error: 'Acesso restrito a Administradores e Superadmins' };
    }
    const stats = await dbQueries.getAdminPlatformStats(db);
    return { status: 200, data: stats };
  },

  /**
   * Lista usuários cadastrados com busca e filtro por cargo
   */
  async listUsers(db, user, { search = '', role = null, limit = 50, offset = 0 } = {}) {
    const userRole = String(user.role || '').toLowerCase();
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      return { status: 403, error: 'Acesso restrito a Administradores e Superadmins' };
    }
    const users = await dbQueries.listUsersAdmin(db, { search, role, limit, offset });
    return { status: 200, data: users };
  },

  /**
   * Lista todos os dispositivos que receberam trava permanente
   */
  async listBlockedDevices(db, user) {
    const userRole = String(user.role || '').toLowerCase();
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      return { status: 403, error: 'Acesso restrito a Administradores e Superadmins' };
    }
    const devices = await dbQueries.listBlockedDevices(db);
    return { status: 200, data: devices };
  },

  /**
   * Libera a trava permanente de um dispositivo diretamente pela web
   */
  async unblockDevice(db, user, deviceHash) {
    const userRole = String(user.role || '').toLowerCase();
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      return { status: 403, error: 'Acesso restrito a Administradores e Superadmins' };
    }
    if (!deviceHash || !deviceHash.trim()) {
      return { status: 400, error: 'Identificador de dispositivo é obrigatório' };
    }

    const cleanHash = deviceHash.trim();
    await dbQueries.unblockDevice(db, cleanHash, user.userId || user.id);

    // Registra log de auditoria
    try {
      await dbQueries.logAdminAudit(db, {
        adminId: user.userId || user.id || 'admin',
        adminName: user.displayName || user.email || 'Admin',
        action: 'DEVICE_UNBLOCK',
        targetType: 'device',
        targetId: cleanHash,
        details: { reason: 'Desbloqueio manual via Painel de Administração' }
      });
    } catch (e) {
      console.warn('Erro ao gravar log de auditoria (unblockDevice):', e.message);
    }

    return {
      status: 200,
      message: `Dispositivo ${cleanHash} liberado com sucesso por ${user.displayName || user.email}`
    };
  },

  /**
   * Altera a categoria/cargo de um usuário (exclusivo para 'superadmin')
   */
  async changeUserRole(db, user, targetUserId, newRole) {
    const userRole = String(user.role || '').toLowerCase();
    if (userRole !== 'superadmin') {
      return { status: 403, error: 'Apenas usuários da categoria Superadmin podem alterar cargos no sistema' };
    }

    const cleanRole = String(newRole || '').toLowerCase().trim();
    if (!VALID_ROLES.has(cleanRole)) {
      return { status: 400, error: `Categoria '${newRole}' inválida. Opções permitidas: ${Array.from(VALID_ROLES).join(', ')}` };
    }

    const targetUser = await dbQueries.getUserById(db, targetUserId);
    if (!targetUser) {
      return { status: 404, error: 'Usuário não encontrado' };
    }

    const previousRole = targetUser.role;
    await dbQueries.updateUserRole(db, targetUserId, cleanRole);

    // Registra log de auditoria
    try {
      await dbQueries.logAdminAudit(db, {
        adminId: user.userId || user.id || 'superadmin',
        adminName: user.displayName || user.email || 'Superadmin',
        action: 'ROLE_CHANGE',
        targetType: 'user',
        targetId: targetUserId,
        details: {
          targetName: targetUser.display_name,
          targetEmail: targetUser.email,
          previousRole,
          newRole: cleanRole
        }
      });
    } catch (e) {
      console.warn('Erro ao gravar log de auditoria (changeUserRole):', e.message);
    }

    return {
      status: 200,
      message: `Categoria do usuário "${targetUser.display_name}" alterada de '${previousRole}' para '${cleanRole}' com sucesso.`
    };
  },

  /**
   * Lista todas as campanhas globais para fins de moderação
   */
  async listAllCampaigns(db, user, { search = '', limit = 50, offset = 0 } = {}) {
    const userRole = String(user.role || '').toLowerCase();
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      return { status: 403, error: 'Acesso restrito a Administradores e Superadmins' };
    }
    const campaigns = await dbQueries.listAllCampaignsAdmin(db, { search, limit, offset });
    return { status: 200, data: campaigns };
  },

  /**
   * Lista o histórico de auditoria administrativa
   */
  async listAuditLogs(db, user, { limit = 50 } = {}) {
    const userRole = String(user.role || '').toLowerCase();
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      return { status: 403, error: 'Acesso restrito a Administradores e Superadmins' };
    }
    const logs = await dbQueries.listAdminAuditLogs(db, { limit });
    return { status: 200, data: logs };
  }
};
