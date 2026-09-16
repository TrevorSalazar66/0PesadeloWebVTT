/**
 * Serviço de Governança e Administração — Arcana VTT
 * Exclusivo para usuários com papel 'Admin'
 */
import { dbQueries } from '../db/queries.js';

export const adminService = {
  /**
   * Lista todos os dispositivos que receberam trava permanente
   */
  async listBlockedDevices(db, user) {
    if (user.role !== 'Admin') {
      return { status: 403, error: 'Acesso restrito a Administradores' };
    }
    const devices = await dbQueries.listBlockedDevices(db);
    return { status: 200, data: devices };
  },

  /**
   * Libera a trava permanente de um dispositivo diretamente pela web
   */
  async unblockDevice(db, user, deviceHash) {
    if (user.role !== 'Admin') {
      return { status: 403, error: 'Acesso restrito a Administradores' };
    }
    if (!deviceHash || !deviceHash.trim()) {
      return { status: 400, error: 'Identificador de dispositivo é obrigatório' };
    }

    await dbQueries.unblockDevice(db, deviceHash.trim(), user.userId);
    return {
      status: 200,
      message: `Dispositivo ${deviceHash} liberado com sucesso por ${user.displayName || user.email}`
    };
  }
};
