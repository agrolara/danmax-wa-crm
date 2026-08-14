import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { normalizeTenantId } from './storage.service';

class SocketService {
  private io: SocketIOServer | null = null;

  public init(server: HttpServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    this.io.on('connection', (socket: Socket) => {
      console.log(`⚡ Client connected to Socket.io: ${socket.id}`);

      // Client joins a tenant-specific room (universally normalized)
      socket.on('join_tenant', (rawTenantId?: string | null) => {
        const normalized = normalizeTenantId(rawTenantId);
        const roomName = `tenant_${normalized}`;
        socket.join(roomName);
        console.log(`🔑 Socket ${socket.id} joined room ${roomName} (raw: ${rawTenantId})`);
      });

      socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Broadcasts an event to all sockets subscribed to the normalized tenant room.
   */
  public emitToTenant(rawTenantId: string | null | undefined, event: string, payload: any) {
    if (this.io) {
      const normalized = normalizeTenantId(rawTenantId);
      const roomName = `tenant_${normalized}`;
      this.io.to(roomName).emit(event, payload);
    }
  }

  public emitGlobal(event: string, payload: any) {
    if (this.io) {
      this.io.emit(event, payload);
    }
  }
}

export const socketService = new SocketService();

