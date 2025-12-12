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

  io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('join-room', (roomId) => {
      socket.join(roomId);
      console.log(`Socket ${socket.id} joined room ${roomId}`);
    });

    socket.on('remote-control', (data) => {
      socket.to(data.roomId).emit('remote-control', data.action);
    });

    socket.on('disconnect', () => {
      console.log('user disconnected');
    });
  });
}).catch((ex) => {
  console.error('Next.js app preparation failed:', ex.stack);
  process.exit(1);
});
