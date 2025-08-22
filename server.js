const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(bodyParser.json());

let users = {}; // simple wallet storage
let rooms = {}; // active ludo matches

// API to create account
app.post("/register", (req, res) => {
  const { userId } = req.body;
  if (!users[userId]) {
    users[userId] = { balance: 100 }; // new user with ₹100 test balance
  }
  res.json({ success: true, balance: users[userId].balance });
});

// API to deposit (for now manual)
app.post("/deposit", (req, res) => {
  const { userId, amount, txnId } = req.body;
  if (!users[userId]) return res.json({ success: false, message: "User not found" });
  users[userId].balance += amount;
  // Here you can forward details to Telegram bot
  res.json({ success: true, balance: users[userId].balance });
});

// API to withdraw (manual)
app.post("/withdraw", (req, res) => {
  const { userId, amount, upi } = req.body;
  if (!users[userId] || users[userId].balance < amount) {
    return res.json({ success: false, message: "Insufficient balance" });
  }
  users[userId].balance -= amount;
  // Here you can forward withdrawal request to Telegram bot
  res.json({ success: true, balance: users[userId].balance });
});

// WebSocket for game match
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("joinGame", ({ roomId, userId }) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = { players: [], bets: {} };
    }

    rooms[roomId].players.push(userId);
    io.to(roomId).emit("playerJoined", rooms[roomId].players);

    if (rooms[roomId].players.length === 2) {
      io.to(roomId).emit("startGame", { message: "Game Started!" });
    }
  });

  socket.on("gameOver", ({ roomId, winnerId, loserId, bet }) => {
    if (users[winnerId] && users[loserId]) {
      users[winnerId].balance += bet;
      users[loserId].balance -= bet;
    }
    io.to(roomId).emit("matchResult", {
      winner: winnerId,
      loser: loserId,
      balances: {
        [winnerId]: users[winnerId].balance,
        [loserId]: users[loserId].balance,
      }
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
