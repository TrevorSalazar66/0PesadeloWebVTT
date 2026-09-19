/**
 * Serviço de Governança e Administração — Arcana / RetroForge VTT
 * Exclusivo para usuários com papel 'admin' ou 'superadmin'
 */
import { dbQueries } from '../db/queries.js';
import { generateSalt, hashPassword } from './cryptoService.js';

const VALID_ROLES = new Set(['jogador', 'mestre', 'admin', 'superadmin']);

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
   * Se for Superadmin, expõe credenciais/hash de segurança
   */
  async listUsers(db, user, { search = '', role = null, limit = 100, offset = 0 } = {}) {
    const userRole = String(user.role || '').toLowerCase();
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      return { status: 403, error: 'Acesso restrito a Administradores e Superadmins' };
    }
    const isSuper = userRole === 'superadmin';
    const users = await dbQueries.listUsersAdmin(db, { search, role, limit, offset });

    // Mascara hashes caso o operador não seja Superadmin
    const sanitized = users.map(u => {
      if (!isSuper) {
        const { password_hash, salt, ...rest } = u;
        return rest;
      }
      return u;
    });

    return { status: 200, data: sanitized };
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
   * Bloqueia a conta de um usuário (não poderá logar nem acessar)
   */
  async blockUser(db, user, targetUserId, reason = 'Suspensão aplicada pela administração') {
    const userRole = String(user.role || '').toLowerCase();
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      return { status: 403, error: 'Acesso restrito a Administradores e Superadmins' };
    }

    const targetUser = await dbQueries.getUserById(db, targetUserId);
    if (!targetUser) {
      return { status: 404, error: 'Usuário não encontrado' };
    }

    // Admin comum não pode bloquear Superadmin
    if (targetUser.role === 'superadmin' && userRole !== 'superadmin') {
      return { status: 403, error: 'Apenas outro Superadmin pode aplicar suspensão a um Superadmin' };
    }

    await dbQueries.blockUser(db, targetUserId, 1);

    // Registra log de auditoria
    try {
      await dbQueries.logAdminAudit(db, {
        adminId: user.userId || user.id || 'admin',
        adminName: user.displayName || user.email || 'Admin',
        action: 'USER_BLOCK',
        targetType: 'user',
        targetId: targetUserId,
        details: {
          targetName: targetUser.display_name,
          targetEmail: targetUser.email,
          reason
        }
      });
    } catch (e) {
      console.warn('Erro ao gravar log de auditoria (blockUser):', e.message);
    }

    return {
      status: 200,
      message: `A conta do usuário "${targetUser.display_name}" (${targetUser.email}) foi bloqueada permanentemente.`
    };
  },

  /**
   * Desbloqueia a conta de um usuário
   */
  async unblockUser(db, user, targetUserId) {
    const userRole = String(user.role || '').toLowerCase();
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      return { status: 403, error: 'Acesso restrito a Administradores e Superadmins' };
    }

    const targetUser = await dbQueries.getUserById(db, targetUserId);
    if (!targetUser) {
      return { status: 404, error: 'Usuário não encontrado' };
    }

    await dbQueries.blockUser(db, targetUserId, 0);

    // Registra log de auditoria
    try {
      await dbQueries.logAdminAudit(db, {
        adminId: user.userId || user.id || 'admin',
        adminName: user.displayName || user.email || 'Admin',
        action: 'USER_UNBLOCK',
        targetType: 'user',
        targetId: targetUserId,
        details: {
          targetName: targetUser.display_name,
          targetEmail: targetUser.email
        }
      });
    } catch (e) {
      console.warn('Erro ao gravar log de auditoria (unblockUser):', e.message);
    }

    return {
      status: 200,
      message: `A conta do usuário "${targetUser.display_name}" foi desbloqueada com sucesso.`
    };
  },

  /**
   * Deleta permanentemente a conta de um usuário (Exclusivo para Superadmin)
   */
  async deleteUser(db, user, targetUserId) {
    const userRole = String(user.role || '').toLowerCase();
    if (userRole !== 'superadmin') {
      return { status: 403, error: 'Apenas usuários da categoria Superadmin podem excluir contas permanentemente' };
    }

    if (targetUserId === user.userId || targetUserId === user.id) {
      return { status: 400, error: 'Você não pode excluir sua própria conta de Superadmin' };
    }

    const targetUser = await dbQueries.getUserById(db, targetUserId);
    if (!targetUser) {
      return { status: 404, error: 'Usuário não encontrado' };
    }

    await dbQueries.deleteUser(db, targetUserId);

    // Registra log de auditoria
    try {
      await dbQueries.logAdminAudit(db, {
        adminId: user.userId || user.id || 'superadmin',
        adminName: user.displayName || user.email || 'Superadmin',
        action: 'USER_DELETE',
        targetType: 'user',
        targetId: targetUserId,
        details: {
          deletedName: targetUser.display_name,
          deletedEmail: targetUser.email,
          deletedRole: targetUser.role
        }
      });
    } catch (e) {
      console.warn('Erro ao gravar log de auditoria (deleteUser):', e.message);
    }

    return {
      status: 200,
      message: `A conta do usuário "${targetUser.display_name}" (${targetUser.email}) foi removida permanentemente do reino.`
    };
  },

  /**
   * Redefine a senha de um usuário diretamente (Exclusivo para Superadmin)
   */
  async resetUserPassword(db, user, targetUserId, newPassword) {
    const userRole = String(user.role || '').toLowerCase();
    if (userRole !== 'superadmin') {
      return { status: 403, error: 'Apenas usuários da categoria Superadmin podem redefinir senhas' };
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 6) {
      return { status: 400, error: 'A nova senha deve possuir no mínimo 6 caracteres' };
    }

    const targetUser = await dbQueries.getUserById(db, targetUserId);
    if (!targetUser) {
      return { status: 404, error: 'Usuário não encontrado' };
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(newPassword.trim(), salt);
    await dbQueries.updateUserPassword(db, targetUserId, passwordHash, salt);

    // Registra log de auditoria
    try {
      await dbQueries.logAdminAudit(db, {
        adminId: user.userId || user.id || 'superadmin',
        adminName: user.displayName || user.email || 'Superadmin',
        action: 'PASSWORD_RESET',
        targetType: 'user',
        targetId: targetUserId,
        details: {
          targetName: targetUser.display_name,
          targetEmail: targetUser.email
        }
      });
    } catch (e) {
      console.warn('Erro ao gravar log de auditoria (resetUserPassword):', e.message);
    }

    return {
      status: 200,
      message: `Senha do usuário "${targetUser.display_name}" redefinida com sucesso.`
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
