
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const messageRoutes = require("./routes/message");

const User = require("./models/User");
const Message = require("./models/Message");
const authMiddleware = require("./middleware/authMiddleware");

dotenv.config();

const app = express();
const server = http.createServer(app);

// ======================================================
// ONLINE USERS
// ======================================================

const onlineUsers = new Map();

// userId -> socketId

// ======================================================
// SOCKET.IO
// ======================================================

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5174"],,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ======================================================
// MIDDLEWARE
// ======================================================

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
    credentials: true,
  })
);

app.use(express.json());

// ======================================================
// TEST
// ======================================================

app.get("/", (req, res) => {
  res.json({
    message: "ChatFlow server is running",
  });
});

// ======================================================
// AUTH
// ======================================================

app.use("/api/auth", authRoutes);

// ======================================================
// USERS
// ======================================================

app.use("/api/users", userRoutes);

// ======================================================
// MESSAGES
// ======================================================

app.use("/api/messages", messageRoutes);

// ======================================================
// PROFILE
// ======================================================

app.get(
  "/api/profile",
  authMiddleware,
  async (req, res) => {
    try {
      const user = await User.findById(
        req.user.id
      ).select("-password");

      if (!user) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      return res.status(200).json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
        },
      });
    } catch (error) {
      console.error(
        "Profile error:",
        error
      );

      return res.status(500).json({
        message: "Server error",
      });
    }
  }
);

// ======================================================
// SOCKET CONNECTION
// ======================================================

io.on("connection", (socket) => {
  console.log(
    "🟢 Socket connected:",
    socket.id
  );

  // ====================================================
  // USER ONLINE
  // ====================================================

  socket.on(
    "user_online",
    (userId) => {
      if (!userId) return;

      const id = String(userId);

      onlineUsers.set(
        id,
        socket.id
      );

      console.log(
        "🟢 User online:",
        id
      );

      io.emit(
        "online_users",
        Array.from(
          onlineUsers.keys()
        )
      );
    }
  );

  // ====================================================
  // USER OFFLINE
  // ====================================================

  socket.on(
    "user_offline",
    (userId) => {
      if (!userId) return;

      const id = String(userId);

      if (
        onlineUsers.get(id) ===
        socket.id
      ) {
        onlineUsers.delete(id);
      }

      io.emit(
        "online_users",
        Array.from(
          onlineUsers.keys()
        )
      );

      console.log(
        "🔴 User offline:",
        id
      );
    }
  );

  // ====================================================
  // SEND MESSAGE
  // ====================================================

  socket.on(
    "send_message",
    async (data) => {
      try {
        const {
          sender,
          receiver,
          message,
        } = data;

        if (
          !sender ||
          !receiver ||
          !message ||
          !message.trim()
        ) {
          return;
        }

        // Save new message
        // New messages start as unseen
        const newMessage =
          await Message.create({
            sender,
            receiver,
            message:
              message.trim(),
            seen: false,
          });

        console.log(
          "💬 Message saved:",
          newMessage._id.toString()
        );

        // Send message to all connected clients
        io.emit(
          "receive_message",
          newMessage
        );

      } catch (error) {
        console.error(
          "❌ Send message error:",
          error
        );
      }
    }
  );

  // ====================================================
  // MARK SINGLE MESSAGE AS SEEN
  // ====================================================

  socket.on(
    "mark_message_seen",
    async (data) => {
      try {
        const {
          messageId,
          receiver,
        } = data;

        if (
          !messageId ||
          !receiver
        ) {
          return;
        }

        const updatedMessage =
          await Message.findOneAndUpdate(
            {
              _id: messageId,
              receiver: receiver,
              seen: false,
            },
            {
              $set: {
                seen: true,
              },
            },
            {
              new: true,
            }
          );

        if (!updatedMessage) {
          return;
        }

        console.log(
          "👀 Message seen:",
          messageId
        );

        // Tell clients that this message is seen
        io.emit(
          "message_seen",
          {
            messageId:
              String(
                updatedMessage._id
              ),

            sender:
              String(
                updatedMessage.sender
              ),

            receiver:
              String(
                updatedMessage.receiver
              ),
          }
        );

      } catch (error) {
        console.error(
          "❌ Mark message seen error:",
          error
        );
      }
    }
  );

  // ====================================================
  // MARK ALL MESSAGES AS SEEN
  // ====================================================

  socket.on(
    "mark_all_messages_seen",
    async (data) => {
      try {
        const {
          sender,
          receiver,
        } = data;

        if (
          !sender ||
          !receiver
        ) {
          return;
        }

        const result =
          await Message.updateMany(
            {
              sender: sender,
              receiver: receiver,
              seen: false,
            },
            {
              $set: {
                seen: true,
              },
            }
          );

        console.log(
          "👀 Messages marked as seen:",
          result.modifiedCount
        );

        // Notify all clients
        io.emit(
          "all_messages_seen",
          {
            sender:
              String(sender),

            receiver:
              String(receiver),
          }
        );

      } catch (error) {
        console.error(
          "❌ Mark all messages seen error:",
          error
        );
      }
    }
  );

  // ====================================================
  // TYPING
  // ====================================================

  socket.on(
    "typing",
    (data) => {
      try {
        if (
          !data ||
          !data.sender ||
          !data.receiver
        ) {
          return;
        }

        socket.broadcast.emit(
          "user_typing",
          {
            sender: String(
              data.sender
            ),

            receiver: String(
              data.receiver
            ),
          }
        );

      } catch (error) {
        console.error(
          "❌ Typing error:",
          error
        );
      }
    }
  );

  // ====================================================
  // STOP TYPING
  // ====================================================

  socket.on(
    "stop_typing",
    (data) => {
      try {
        if (
          !data ||
          !data.sender ||
          !data.receiver
        ) {
          return;
        }

        socket.broadcast.emit(
          "user_stop_typing",
          {
            sender: String(
              data.sender
            ),

            receiver: String(
              data.receiver
            ),
          }
        );

      } catch (error) {
        console.error(
          "❌ Stop typing error:",
          error
        );
      }
    }
  );

  // ====================================================
  // DISCONNECT
  // ====================================================

  socket.on(
    "disconnect",
    () => {
      let disconnectedUser =
        null;

      for (
        const [
          userId,
          socketId,
        ] of onlineUsers.entries()
      ) {
        if (
          socketId === socket.id
        ) {
          disconnectedUser =
            userId;

          onlineUsers.delete(
            userId
          );

          break;
        }
      }

      io.emit(
        "online_users",
        Array.from(
          onlineUsers.keys()
        )
      );

      console.log(
        "🔴 Socket disconnected:",
        socket.id,
        disconnectedUser
          ? `User ${disconnectedUser} offline`
          : ""
      );
    }
  );
});

// ======================================================
// DATABASE + SERVER
// ======================================================

const PORT =
  process.env.PORT || 5000;

mongoose
  .connect(
    process.env.MONGO_URI
  )
  .then(() => {
    console.log(
      "MongoDB connected successfully"
    );

    server.listen(
      PORT,
      () => {
        console.log(
          `Server running on port ${PORT}`
        );
      }
    );
  })
  .catch((error) => {
    console.error(
      "MongoDB connection failed:",
      error
    );
  });

