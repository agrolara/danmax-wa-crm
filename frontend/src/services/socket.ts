import { io, Socket } from 'socket.io-client';

export const socket: Socket = io(window.location.origin, {
  autoConnect: true,
});

/**
 * Resolves the currently active tenant identifier from localStorage.
 */
export function getActiveTenantId(): string {
  try {
    const savedUser = localStorage.getItem('danmax_user');
    if (savedUser) {
      const userObj = JSON.parse(savedUser);
      return userObj.tenantId || userObj.businessName || 'tenant_demo_pizzeria';
    }
  } catch (e) {}
  return 'tenant_demo_pizzeria';
}

/**
 * Emits join_tenant event for the active or specified tenant.
 */
export function joinTenantRoom(tenantId?: string) {
  const target = tenantId || getActiveTenantId();
  socket.emit('join_tenant', target);
}

// Automatically subscribe and re-subscribe on connection/reconnection
socket.on('connect', () => {
  joinTenantRoom();
});

