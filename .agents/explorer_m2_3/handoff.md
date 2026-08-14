# Handoff Report — Explorer 3 (Milestone 2)

**Topic**: Socket.io Room Subscription / Broadcasting Normalization & Frontend API Tenant Routing / Admin Aliasing  
**Date**: 2026-08-14  
**Author**: Explorer 3 (`.agents/explorer_m2_3`)  

---

## 1. Observation

### 1.1 Backend Socket Service (`backend/src/services/socket.service.ts`)
Lines 18-35 in `backend/src/services/socket.service.ts`:
```typescript
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
```
- **Direct Observation**:
  1. `socket.on('join_tenant', (tenantId: string) => ...)` uses raw `tenantId` without normalization.
  2. `emitToTenant(tenantId: string, event: string, payload: any)` uses raw `tenantId` without normalization.
  3. If a client connects and sends `join_tenant` with `'danmax_wa_owner'` (or `'super_admin'` / `'global_whatsapp_line'`), it joins room `tenant_danmax_wa_owner`.
  4. If a backend route (e.g. `kanban.routes.ts`, `tenant.routes.ts`, or `webhook.routes.ts`) calls `emitToTenant('tenant_demo_pizzeria', ...)` or with a normalized tenant ID, the room is `tenant_tenant_demo_pizzeria`.
  5. The socket listener never receives the event because room names do not match (`tenant_danmax_wa_owner` vs `tenant_tenant_demo_pizzeria`).

### 1.2 Backend Socket Emission Sites
- `backend/src/routes/kanban.routes.ts`: Lines 91, 129, 164, 185, 210, 234 call `socketService.emitToTenant(tenantId, 'kanban_updated', columns)`.
- `backend/src/routes/tenant.routes.ts`: Lines 313, 338, 373 call `socketService.emitToTenant(targetTenantId, 'whatsapp_status' | 'whatsapp_qr', ...)`.
- `backend/src/routes/webhook.routes.ts`: Lines 19, 28, 58, 62 call `socketService.emitToTenant(targetTenantId, 'whatsapp_qr' | 'whatsapp_status' | 'new_message' | 'webhook_event', ...)`.

### 1.3 Frontend API Interceptor (`frontend/src/services/api.ts`)
Lines 8-22 in `frontend/src/services/api.ts`:
```typescript
API.interceptors.request.use((config) => {
  try {
    const savedUser = localStorage.getItem('danmax_user');
    if (savedUser) {
      const userObj = JSON.parse(savedUser);
      const tenantId = userObj.tenantId || userObj.businessName || 'tenant_demo_pizzeria';
      config.headers['x-tenant-id'] = tenantId;
    } else {
      config.headers['x-tenant-id'] = 'tenant_demo_pizzeria';
    }
  } catch (e) {
    config.headers['x-tenant-id'] = 'tenant_demo_pizzeria';
  }
  return config;
});
```
- **Direct Observation**:
  1. Default unauthenticated or default admin user (`danmax_user`) has `userObj.businessName = 'DanMax WA Owner'` and `userObj.tenantId = null`.
  2. `config.headers['x-tenant-id']` is set to `'DanMax WA Owner'`.
  3. When received on backend, `getTenantIdFromReq(req)` extracts `x-tenant-id`, runs `normalizeTenantId('DanMax WA Owner')`, and correctly maps it to `CANONICAL_ADMIN_TENANT` (`tenant_demo_pizzeria`).
  4. Regular tenant users have `userObj.tenantId = 'tenant_1723610000'`, which is sent in `x-tenant-id` and preserved on the backend as `'tenant_1723610000'`.

### 1.4 Frontend Socket Service & View Listeners
- `frontend/src/services/socket.ts`:
  ```typescript
  import { io, Socket } from 'socket.io-client';

  export const socket: Socket = io(window.location.origin, {
    autoConnect: true,
  });
  ```
- `frontend/src/views/WhatsAppQRView.tsx`: Line 56 calls `socket.emit('join_tenant', 'tenant_demo_pizzeria')`.
- `frontend/src/App.tsx`: Listens on `socket.on('new_message')` for sound notifications, but did not invoke `join_tenant` globally on connection/reconnection.
- `frontend/src/views/ChatInboxView.tsx`: Listens on `socket.on('new_message')`.
- `frontend/src/views/KanbanPipelineView.tsx`: Listens on `socket.on('kanban_updated')`.

---

## 2. Logic Chain

1. **Root Cause of Real-time Desynchronization**:
   Because `socket.service.ts` did not normalize the tenant parameter on `join_tenant` and `emitToTenant`:
   - Admin alias variation (`danmax_wa_owner`, `super_admin`, `global_whatsapp_line`, `tenant_demo_pizzeria`, `null`, `undefined`) generated disjoint room names (`tenant_danmax_wa_owner`, `tenant_super_admin`, `tenant_tenant_demo_pizzeria`).
   - Sockets in one room alias never received broadcasts dispatched to another alias of the same tenant.

2. **Resolution via Universal Normalization in Socket Service**:
   By importing `normalizeTenantId` from `./storage.service` into `backend/src/services/socket.service.ts`:
   - `join_tenant` handler: `const roomName = \`tenant_${normalizeTenantId(rawTenantId)}\`; socket.join(roomName);`
   - `emitToTenant` method: `const roomName = \`tenant_${normalizeTenantId(rawTenantId)}\`; this.io.to(roomName).emit(event, payload);`
   - Result: All admin aliases map to `tenant_tenant_demo_pizzeria`. All client tenants map to `tenant_tenant_<id>`. 100% room alignment guaranteed regardless of which alias caller passes.

3. **Frontend Global Room Subscription & Reconnect Resilience**:
   By adding `getActiveTenantId()` and `joinTenantRoom()` in `frontend/src/services/socket.ts` and attaching `socket.on('connect', () => joinTenantRoom())`:
   - As soon as the browser connects (or reconnects after a network interruption), it automatically subscribes to the active tenant room.
   - When switching users or accounts in `App.tsx`, invoking `joinTenantRoom(newUser?.tenantId || newUser?.businessName)` ensures seamless transition without manual page reload.

4. **Frontend API Interceptor Alignment**:
   - `frontend/src/services/api.ts` attaches `x-tenant-id` header on every request.
   - All admin views (`WhatsAppQRView`, `TemplatesView`, `GroupsView`, `KanbanPipelineView`, `BroadcastCalendarView`, `TeamView`, `MediaCatalogView`, `AnalyticsView`, `SuperAdminView`) send requests with either explicit query/body params or the interceptor header.
   - Because `getTenantIdFromReq(req)` on backend inspects `Header -> Query -> Body` and runs `normalizeTenantId`, all admin requests resolve to `tenant_demo_pizzeria` consistently.

---

## 3. Caveats

- **Room Naming Convention**: The room naming convention is `tenant_${normalizeTenantId(tenantId)}`. Since `CANONICAL_ADMIN_TENANT` is `'tenant_demo_pizzeria'`, the canonical admin room string is `tenant_tenant_demo_pizzeria`. This prefixing is uniform across both `join_tenant` and `emitToTenant`.
- **Client Tenant Isolation**: Client accounts (e.g. `tenant_1723610000` or custom client IDs not in `ADMIN_TENANT_ALIASES`) produce `tenant_tenant_1723610000`, keeping them completely segregated from the admin room.
- **WebSocket Reconnection**: When a socket disconnects and reconnects in Socket.io, room memberships are reset on the server. The proposed `socket.on('connect', ...)` listener on the frontend guarantees re-subscription upon reconnection.

---

## 4. Conclusion & Proposed Code Changes

### Proposed Refactoring for `backend/src/services/socket.service.ts`

```typescript
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
```

### Proposed Refactoring for `frontend/src/services/socket.ts`

```typescript
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
```

### Proposed Enhancement for `frontend/src/App.tsx` (Session Context Sync)

In `frontend/src/App.tsx`:
```typescript
import { socket, joinTenantRoom } from './services/socket';

// Inside App component:
useEffect(() => {
  joinTenantRoom(currentUser?.tenantId || currentUser?.businessName);
}, [currentUser]);
```

---

## 5. Verification Method

### 5.1 Static Verification (TypeScript Compilation)
Run TypeScript checks in both backend and frontend directories:
```powershell
cmd.exe /c npx tsc --noEmit (in backend/)
cmd.exe /c npx tsc --noEmit (in frontend/)
```
Expected output: Exited with code 0 (0 errors).

### 5.2 Unit / Integration Test Scenarios
1. **Admin Aliasing Room Match Test**:
   - Socket client A emits `join_tenant('danmax_wa_owner')`.
   - Socket client B emits `join_tenant('super_admin')`.
   - Socket client C emits `join_tenant('tenant_demo_pizzeria')`.
   - Server calls `socketService.emitToTenant('global_whatsapp_line', 'test_event', { data: 123 })`.
   - **Verification**: All 3 clients receive `test_event` because all aliases normalized to `tenant_tenant_demo_pizzeria`.

2. **Client Isolation Room Segregation Test**:
   - Socket client X emits `join_tenant('tenant_client_999')`.
   - Server calls `socketService.emitToTenant('tenant_demo_pizzeria', 'admin_event', { secret: 'xyz' })`.
   - **Verification**: Client X does NOT receive `admin_event`.
   - Server calls `socketService.emitToTenant('tenant_client_999', 'client_event', { ok: true })`.
   - **Verification**: Client X receives `client_event`.
