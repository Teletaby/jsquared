console.log('Server script started.');

// Disable Next.js telemetry/network telemetry during local dev to avoid blocking app.prepare()
process.env.NEXT_TELEMETRY_DISABLED = process.env.NEXT_TELEMETRY_DISABLED || '1';
process.env.__NEXT_TELEMETRY_DISABLED = process.env.__NEXT_TELEMETRY_DISABLED || '1';

process.on('uncaughtException', (err) => {
  console.error('Unhandled exception caught:', err);
  process.exit(1);
});

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

console.log('Attempting to prepare Next.js app...');
console.log('Calling app.prepare() now...');
// Enable Next debug logs for startup diagnostics
process.env.DEBUG = process.env.DEBUG || 'next:*';

// Instrument async resources to help find blocking async ops during app.prepare()
try {
  const async_hooks = require('async_hooks');
  const activeAsync = new Map();

  const asyncHook = async_hooks.createHook({
    init(asyncId, type, triggerAsyncId, resource) {
      // Capture a short stack to trace where the async resource was created
      const stack = (new Error()).stack?.split('\n').slice(3, 10).join('\n') || '';
      activeAsync.set(asyncId, { type, stack, ts: Date.now() });
    },
    destroy(asyncId) {
      activeAsync.delete(asyncId);
    }
  });
  asyncHook.enable();

  // Periodically print a summary of active async resources (first 30)
  setInterval(() => {
    try {
      const map = Array.from(activeAsync.values());
      const byType = map.reduce((acc, v) => {
        acc[v.type] = (acc[v.type] || 0) + 1;
        return acc;
      }, {});
      console.log('Diagnostic (async_hooks): activeAsyncCount=', map.length, 'byType=', byType);
      const sample = map.slice(0, 20).map((v, i) => ({ idx: i, type: v.type, ageMs: Date.now() - v.ts }));
      console.log('Diagnostic (async_hooks) sample=', sample);
      if (map.length > 0) {
        console.log('Diagnostic (async_hooks) sample stacks:\n', map.slice(0,3).map(v => `----- ${v.type} -----\n${v.stack}`).join('\n\n'));
      }
    } catch (e) {
      // ignore
    }
  }, 5000);
} catch (err) {
  console.log('Async hooks not available:', err);
}

let _prepareStart = Date.now();
const _prepareInterval = setInterval(() => {
  const s = Math.round((Date.now() - _prepareStart) / 1000);
  console.log(`Still waiting for app.prepare() after ${s}s`);

  // Diagnostic: list active handles and requests to see what's blocking
  try {
    const handles = (process._getActiveHandles && process._getActiveHandles()) || [];
    const requests = (process._getActiveRequests && process._getActiveRequests()) || [];
    console.log(`Diagnostic: activeHandles=${handles.length} activeRequests=${requests.length}`);
    const types = handles.map(h => (h && h.constructor && h.constructor.name) ? h.constructor.name : typeof h);
    console.log('Diagnostic: handleTypes=', types.slice(0, 30).join(', '));

    // Environment snapshot for debugging
    const envSnapshot = {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      TMDB_API_KEY: !!process.env.TMDB_API_KEY,
      MONGODB_URI: !!process.env.MONGODB_URI,
      YOUTUBE_API_KEY: !!process.env.YOUTUBE_API_KEY,
      NEXT_PUBLIC_YOUTUBE_API_KEY: !!process.env.NEXT_PUBLIC_YOUTUBE_API_KEY,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    };
    console.log('Diagnostic: envSnapshot=', envSnapshot);

    // List a few loaded modules to see what's been required so far
    try {
      const cacheKeys = Object.keys(require.cache || {});
      console.log(`Diagnostic: require.cache size=${cacheKeys.length}, sample keys=`, cacheKeys.slice(0, 30));
    } catch (e) {
      console.log('Diagnostic: error reading require.cache', e);
    }

    handles.slice(0, 20).forEach((h, idx) => {
      try {
        if (h && h.constructor && h.constructor.name === 'ChildProcess') {
          console.log(`ChildProcess[${idx}] pid=${h.pid} spawnargs=${JSON.stringify(h.spawnargs || h.args || [])}`);
        }
        if (h && h.constructor && h.constructor.name === 'Socket') {
          console.log(`Socket[${idx}] remote=${h.remoteAddress}:${h.remotePort}`);
        }
        if (h && h.constructor && h.constructor.name === 'Timeout') {
          console.log(`Timeout[${idx}] (likely setInterval/setTimeout) detected`);
        }
      } catch (e) {
        // ignore
      }
    });
  } catch (e) {
    console.log('Diagnostic error while inspecting handles:', e);
  }
}, 5000);

app.prepare().then(() => {
  clearInterval(_prepareInterval);
  console.log('Next.js app prepared successfully. Starting HTTP server...');
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(process.env.PORT || 3000, (err) => {
    if (err) {
      console.error('Error starting server:', err);
      throw err;
    }
    console.log('> Ready on http://localhost:3000');
  });

  const io = new Server(server, {
    cors: {
      origin: function(origin, callback) {
        // Allow requests with no origin (like mobile apps or Postman)
        if(!origin) return callback(null, true);
        
        // In production, allow from any origin since this is self-hosted
        // Socket.IO will only relay to connected clients anyway
        callback(null, true);
      },
      methods: ['GET', 'POST'],
      credentials: true,
      allowEIO3: true,
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  // Track room connections
  const roomConnections = {};

  io.on('connection', (socket) => {
    console.log('a user connected:', socket.id);

    socket.on('join-room', (roomId) => {
      socket.join(roomId);
      console.log(`Socket ${socket.id} joined room ${roomId}`);
      
      // Track connections for this room
      if (!roomConnections[roomId]) {
        roomConnections[roomId] = [];
      }
      roomConnections[roomId].push(socket.id);
      
      console.log(`Room ${roomId} connections:`, roomConnections[roomId]);
      
      // Notify all clients in the room about the connection status
      const status = {
        clientCount: roomConnections[roomId].length,
        clients: roomConnections[roomId],
        roomId: roomId,
      };
      console.log(`Broadcasting room-status to room ${roomId}:`, status);
      io.to(roomId).emit('room-status', status);
    });

    socket.on('remote-control', (data) => {
      console.log('remote-control data received:', data);
      console.log('Emitting to room:', data.roomId);
      socket.to(data.roomId).emit('remote-control', data);
    });

    socket.on('video-state-update', (data) => {
      console.log('video-state-update:', data);
      socket.to(data.roomId).emit('video-state-update', data.state);
    });

    socket.on('video-type-update', (data) => {
      console.log('video-type-update received:', data);
      console.log('Broadcasting to room:', data.roomId);
      socket.to(data.roomId).emit('video-type-update', data.videoType);
    });

    socket.on('check-room-status', (roomId) => {
      console.log(`\n>>> CHECK ROOM STATUS for room: ${roomId}`);
      // Use Socket.IO's built-in room tracking
      const room = io.sockets.adapter.rooms.get(roomId);
      const clientCount = room ? room.size : 0;
      console.log(`Room ${roomId} has ${clientCount} sockets`);
      
      const status = {
        clientCount: clientCount,
        roomId: roomId,
      };
      console.log(`Broadcasting room-status:`, status);
      io.to(roomId).emit('room-status', status);
      console.log(`<<< END CHECK ROOM STATUS >>>\n`);
    });

    socket.on('remote-disconnect', (data) => {
      console.log(`\n>>> REMOTE DISCONNECT EVENT <<<`);
      console.log(`Remote disconnect for room: ${data.roomId}`);
      console.log(`Socket ID: ${socket.id}`);
      const roomId = data.roomId;
      
      // CRITICAL: Actually leave the Socket.IO room
      socket.leave(roomId);
      console.log(`Socket ${socket.id} left room ${roomId}`);
      
      // First, remove from manual tracking
      if (roomConnections[roomId]) {
        const index = roomConnections[roomId].indexOf(socket.id);
        if (index > -1) {
          roomConnections[roomId].splice(index, 1);
        }
      }
      
      // Use Socket.IO's actual room tracking
      const room = io.sockets.adapter.rooms.get(roomId);
      const actualClientCount = room ? room.size : 0;
      
      console.log(`Actual socket count in room ${roomId}: ${actualClientCount}`);
      console.log(`Emitting user-left to room ${roomId}`);
      io.to(roomId).emit('user-left');
      
      // Broadcast actual room status
      const status = {
        clientCount: actualClientCount,
        roomId: roomId,
      };
      console.log(`Emitting room-status with actual clientCount: ${actualClientCount}`);
      io.to(roomId).emit('room-status', status);
      console.log(`<<< END REMOTE DISCONNECT >>>\n`);
    });

    socket.on('disconnect', () => {
      console.log('user disconnected:', socket.id);
      
      // Remove from all rooms
      Object.keys(roomConnections).forEach((roomId) => {
        const index = roomConnections[roomId].indexOf(socket.id);
        if (index > -1) {
          roomConnections[roomId].splice(index, 1);
          console.log(`Socket ${socket.id} removed from room ${roomId}. Room now has ${roomConnections[roomId].length} clients`);
          
          // Notify remaining clients in the room
          const status = {
            clientCount: roomConnections[roomId].length,
            clients: roomConnections[roomId],
            roomId: roomId,
          };
          io.to(roomId).emit('room-status', status);
          
          // Clean up empty rooms
          if (roomConnections[roomId].length === 0) {
            delete roomConnections[roomId];
            console.log(`Room ${roomId} deleted (empty)`);
          }
        }
      });
    });
  });
}).catch((ex) => {
  console.error('Next.js app preparation failed:', ex.stack);
  process.exit(1);
});
