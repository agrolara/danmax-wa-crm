import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

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

      // Client joins a tenant-specific room
      socket.on('join_tenant', (tenantId: string) => {
        socket.join(`tenant_${tenantId}`);
        console.log(`🔑 Socket ${socket.id} joined room tenant_${tenantId}`);
      });

      socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
      });
    });
  }

  public emitToTenant(tenantId: string, event: string, payload: any) {
    if (this.io) {
      this.io.to(`tenant_${tenantId}`).emit(event, payload);
    }
  }

  public emitGlobal(event: string, payload: any) {
    if (this.io) {
      this.io.emit(event, payload);
    }
  }
}

export const socketService = new SocketService();
