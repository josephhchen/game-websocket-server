const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Store connected players and their positions
const players = new Map();
const positions = new Map();

// Add a basic health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

wss.on('connection', (ws) => {
  let playerUsername = '';

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'playerJoin':
          playerUsername = message.username;
          players.set(playerUsername, ws);
          positions.set(playerUsername, message.position);
          
          // Broadcast new player to everyone else
          broadcast({
            type: 'playerJoin',
            username: playerUsername,
            position: message.position
          }, ws);
          
          // Send existing players to new player
          players.forEach((_, username) => {
            if (username !== playerUsername) {
              ws.send(JSON.stringify({
                type: 'playerJoin',
                username,
                position: positions.get(username) || [0, 0, 0]
              }));
            }
          });
          break;

        case 'playerMove':
          positions.set(message.username, message.position);
          broadcast(message, ws);
          break;
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    if (playerUsername) {
      players.delete(playerUsername);
      positions.delete(playerUsername);
      broadcast({
        type: 'playerLeave',
        username: playerUsername
      });
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    if (playerUsername) {
      players.delete(playerUsername);
      positions.delete(playerUsername);
    }
  });
});

function broadcast(message, excludeWs) {
  players.forEach((ws) => {
    if (ws !== excludeWs && ws.readyState === 1) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error broadcasting to client:', error);
      }
    }
  });
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});