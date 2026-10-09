import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { cropRepository, negotiationRepository } from '../repositories/index.js';
import { marketEventBus } from '../events/MarketEventBus.js';
import { SocketBroadcastObserver } from '../events/SocketBroadcastObserver.js';
import { CropBenchmarkObserver } from '../events/CropBenchmarkObserver.js';

export function initializeSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: true,
      methods: ['GET', 'POST', 'PATCH'],
      credentials: true,
    },
  });

  // Optional JWT authentication for Socket.io connections
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');

    if (!token) {
      socket.user = null;
      return next();
    }

    try {
      const decoded = jwt.verify(token, env.jwt.secret);
      socket.user = {
        id: Number(decoded.sub),
        role: decoded.role,
        region: decoded.region,
      };
      next();
    } catch {
      socket.user = null;
      next();
    }
  });

  io.on('connection', (socket) => {
    if (socket.user) {
      socket.join(`user:${socket.user.id}`);
      if (socket.user.region) {
        socket.join(`region:${socket.user.region}`);
      }
    }

    socket.on('region:subscribe', (region) => {
      if (typeof region === 'string' && region.trim()) {
        socket.join(`region:${region.trim()}`);
      }
    });

    socket.on('region:unsubscribe', (region) => {
      if (typeof region === 'string' && region.trim()) {
        socket.leave(`region:${region.trim()}`);
      }
    });

    socket.on('negotiation:join', async (negotiationId) => {
      try {
        const negId = Number(negotiationId);
        if (!negId || !socket.user) return;
        const neg = await negotiationRepository.findById(negId);
        if (
          neg &&
          (Number(neg.buyer_id) === socket.user.id ||
            Number(neg.farmer_id) === socket.user.id)
        ) {
          socket.join(`negotiation:${negId}`);
          socket.emit('negotiation:joined', { negotiationId: negId });
        }
      } catch (err) {
        console.error('[Socket] negotiation:join error:', err.message);
      }
    });

    socket.on('negotiation:leave', (negotiationId) => {
      if (negotiationId) {
        socket.leave(`negotiation:${Number(negotiationId)}`);
      }
    });
  });

  // Wire Observer Pattern subscribers to MarketEventBus
  new SocketBroadcastObserver(io, marketEventBus);
  new CropBenchmarkObserver(marketEventBus, cropRepository);

  return io;
}
