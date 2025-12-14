console.log('Server script started.');

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
app.prepare().then(() => {
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
      origin: '*',
      methods: ['GET', 'POST'],
    },
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
