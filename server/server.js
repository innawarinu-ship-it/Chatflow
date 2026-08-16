const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");

dotenv.config();

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const messageRoutes = require("./routes/message");

const User = require("./models/User");
const Message = require("./models/Message");
const authMiddleware = require("./middleware/authMiddleware");

const app = express();
const server = http.createServer(app);

// ======================================================
// ONLINE USERS
// ======================================================

const onlineUsers = new Map();

// ======================================================
// ALLOWED FRONTEND ORIGINS
// ======================================================

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://chatflow-frontend-8vu3.onrender.com",
];

// ======================================================
// CORS OPTIONS
// ======================================================

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests without an origin
    // (Postman, server-to-server, etc.)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log("Blocked CORS origin:", origin);

    return callback(
      new Error("Not allowed by CORS")
    );
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
  ],
};

// ======================================================
// SOCKET.IO
// ======================================================

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ======================================================
// MIDDLEWARE
// ======================================================

app.use(cors(corsOptions));

app.use(express.json());

// ======================================================
// HEALTH / TEST
// ======================================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "ChatFlow server is running",
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "ChatFlow server healthy",
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
          id: String(user._id),
          name: user.name,
          email: user.email,
        },
      });
    } catch (error) {
      console.error(
        "❌ Profile error:",
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
      try {
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
      } catch (error) {
        console.error(
          "❌ User online error:",
          error
        );
      }
    }
  );

  // ====================================================
  // USER OFFLINE
  // ====================================================

  socket.on(
    "user_offline",
    (userId) => {
      try {
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
      } catch (error) {
        console.error(
          "❌ User offline error:",
          error
        );
      }
    }
  );

  // ====================================================
  // SEND MESSAGE
  // ====================================================

  socket.on(
    "send_message",
    async (data) => {
      try {
        if (!data) return;

        const {
          sender,
          receiver,
          message,
        } = data;

        if (
          !sender ||
          !receiver ||
          !message ||
          !String(message).trim()
        ) {
          return;
        }

        // ----------------------------------------------
        // SAVE MESSAGE
        // ----------------------------------------------

        const newMessage =
          await Message.create({
            sender: String(sender),
            receiver: String(receiver),
            message: String(message).trim(),
            seen: false,
          });

        console.log(
          "💬 Message saved:",
          newMessage._id.toString()
        );

        // ----------------------------------------------
        // SEND TO CONNECTED CLIENTS
        // ----------------------------------------------

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
        if (!data) return;

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
              receiver: String(receiver),
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

        io.emit(
          "message_seen",
          {
            messageId: String(
              updatedMessage._id
            ),

            sender: String(
              updatedMessage.sender
            ),

            receiver: String(
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
        if (!data) return;

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
              sender: String(sender),
              receiver: String(receiver),
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

        io.emit(
          "all_messages_seen",
          {
            sender: String(sender),
            receiver: String(receiver),
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
      let disconnectedUser = null;

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

if (!process.env.MONGO_URI) {
  console.error(
    "❌ MONGO_URI is missing in environment variables"
  );

  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log(
      "✅ MongoDB connected successfully"
    );

    server.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log(
          `🚀 ChatFlow server running on port ${PORT}`
        );
      }
    );
  })
  .catch((error) => {
    console.error(
      "❌ MongoDB connection failed:",
      error
    );

    process.exit(1);
  });

// ======================================================
// GLOBAL ERROR HANDLER
// ======================================================

process.on(
  "unhandledRejection",
  (error) => {
    console.error(
      "❌ Unhandled rejection:",
      error
    );
  }
);

process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "❌ Uncaught exception:",
      error
    );
  }
);