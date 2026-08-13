import { io, Socket } from 'socket.io-client';

export const socket: Socket = io(window.location.origin, {
  autoConnect: true,
});
