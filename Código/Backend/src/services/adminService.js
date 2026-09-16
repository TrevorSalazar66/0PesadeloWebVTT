/**
 * Serviço de Governança e Administração — Arcana VTT
 * Exclusivo para usuários com papel 'admin' ou 'superadmin'
 */
import { dbQueries } from '../db/queries.js';

const VALID_ROLES = new Set(['jogador', 'assistente de mestre', 'mestre', 'admin', 'superadmin']);

export const adminService = {
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

    await dbQueries.unblockDevice(db, deviceHash.trim(), user.userId);
    return {
      status: 200,
      message: `Dispositivo ${deviceHash} liberado com sucesso por ${user.displayName || user.email}`
    };
  },

  /**
   * Altera a categoria de um usuário (exclusivo para 'superadmin')
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

    await dbQueries.updateUserRole(db, targetUserId, cleanRole);
    return {
      status: 200,
      message: `Categoria do usuário ${targetUser.display_name} alterada para '${cleanRole}' com sucesso.`
    };
  }
};
