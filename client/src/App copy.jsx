import { useEffect, useState } from "react";
import { io } from "socket.io-client";

// ======================================================
// LIVE BACKEND
// ======================================================

const BACKEND_URL =
  "https://chatflow-server-xpor.onrender.com";

// ======================================================
// SOCKET.IO
// ======================================================

const socket = io(BACKEND_URL, {
  transports: ["websocket", "polling"],
  autoConnect: true,
});

// ======================================================
// TEST USER IDS
// ======================================================
// These are kept from your original copy.jsx.
// This file is only a test chat screen.

const SENDER_ID =
  "6a81a609c446d5a0b503ba7d";

const RECEIVER_ID =
  "6a81766b45d461534f066a11";

// ======================================================
// APP
// ======================================================

function App() {
  const [connected, setConnected] =
    useState(socket.connected);

  const [message, setMessage] =
    useState("");

  const [messages, setMessages] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  // ====================================================
  // LOAD MESSAGES
  // ====================================================

  const loadMessages = async () => {
    try {
      const token =
        localStorage.getItem("token");

      if (!token) {
        console.log(
          "No login token found"
        );
        return;
      }

      setLoading(true);

      const response = await fetch(
        `${BACKEND_URL}/api/messages/${RECEIVER_ID}`,
        {
          method: "GET",

          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      const data =
        await response.json();

      if (response.ok) {
        setMessages(
          data.messages || []
        );

        console.log(
          "Messages loaded:",
          data.messages
        );
      } else {
        console.log(
          "Failed to load messages:",
          data
        );
      }
    } catch (error) {
      console.error(
        "Error loading messages:",
        error
      );
    } finally {
      setLoading(false);
    }
  };

  // ====================================================
  // SEND MESSAGE
  // ====================================================

  const sendMessage = () => {
    if (!message.trim()) {
      return;
    }

    if (!socket.connected) {
      alert(
        "Server is not connected. Please wait a moment and try again."
      );
      return;
    }

    const messageData = {
      sender: SENDER_ID,

      receiver: RECEIVER_ID,

      message: message.trim(),
    };

    console.log(
      "Sending message:",
      messageData
    );

    socket.emit(
      "send_message",
      messageData
    );

    setMessage("");
  };

  // ====================================================
  // SOCKET CONNECTION
  // ====================================================

  useEffect(() => {
    const handleConnect = () => {
      console.log(
        "🟢 Connected to live server:",
        socket.id
      );

      setConnected(true);
    };

    const handleDisconnect = () => {
      console.log(
        "🔴 Disconnected from live server"
      );

      setConnected(false);
    };

    const handleReceiveMessage = (
      data
    ) => {
      console.log(
        "💬 Message received:",
        data
      );

      // Only show messages between
      // these two users

      const sender =
        String(data.sender);

      const receiver =
        String(data.receiver);

      const isThisConversation =
        (sender === SENDER_ID &&
          receiver === RECEIVER_ID) ||
        (sender === RECEIVER_ID &&
          receiver === SENDER_ID);

      if (!isThisConversation) {
        return;
      }

      setMessages(
        (previousMessages) => {
          // Prevent duplicate messages

          const alreadyExists =
            previousMessages.some(
              (msg) =>
                msg._id &&
                data._id &&
                String(msg._id) ===
                  String(data._id)
            );

          if (alreadyExists) {
            return previousMessages;
          }

          return [
            ...previousMessages,
            data,
          ];
        }
      );
    };

    // ==================================================
    // SOCKET LISTENERS
    // ==================================================

    socket.on(
      "connect",
      handleConnect
    );

    socket.on(
      "disconnect",
      handleDisconnect
    );

    socket.on(
      "receive_message",
      handleReceiveMessage
    );

    // ==================================================
    // ALREADY CONNECTED
    // ==================================================

    if (socket.connected) {
      setConnected(true);
    }

    // ==================================================
    // LOAD OLD MESSAGES
    // ==================================================

    loadMessages();

    // ==================================================
    // CLEANUP
    // ==================================================

    return () => {
      socket.off(
        "connect",
        handleConnect
      );

      socket.off(
        "disconnect",
        handleDisconnect
      );

      socket.off(
        "receive_message",
        handleReceiveMessage
      );
    };
  }, []);

  // ====================================================
  // ENTER KEY
  // ====================================================

  const handleKeyDown = (e) => {
    if (
      e.key === "Enter" &&
      !e.shiftKey
    ) {
      e.preventDefault();

      sendMessage();
    }
  };

  // ====================================================
  // UI
  // ====================================================

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "30px",
        fontFamily:
          "Arial, sans-serif",
        background: "#f5f7fb",
        boxSizing: "border-box",
      }}
    >
      {/* ================================================
          TITLE
      ================================================= */}

      <h1>
        One-to-One Chat 💬
      </h1>

      {/* ================================================
          SOCKET STATUS
      ================================================= */}

      <h2>
        Socket Status:{" "}
        {connected
          ? "🟢 Connected"
          : "🔴 Disconnected"}
      </h2>

      <p>
        Backend:{" "}
        <strong>
          Live Render Server
        </strong>
      </p>

      {/* ================================================
          MESSAGE BOX
      ================================================= */}

      <div
        style={{
          marginTop: "20px",
          marginBottom: "20px",
          padding: "20px",
          background: "white",
          borderRadius: "12px",
          minHeight: "300px",
          border:
            "1px solid #ddd",
        }}
      >
        <h2>
          Messages
        </h2>

        {loading && (
          <p>
            Loading messages...
          </p>
        )}

        {!loading &&
          messages.length === 0 && (
            <p>
              No messages yet.
            </p>
          )}

        {messages.map(
          (msg, index) => {
            const isMine =
              String(
                msg.sender
              ) === SENDER_ID;

            return (
              <div
                key={
                  msg._id ||
                  index
                }
                style={{
                  marginBottom:
                    "12px",

                  padding: "10px 14px",

                  borderRadius:
                    "10px",

                  background: isMine
                    ? "#dbeafe"
                    : "#f1f5f9",

                  maxWidth:
                    "70%",
                }}
              >
                <p
                  style={{
                    margin: 0,
                  }}
                >
                  {msg.message}
                </p>

                {msg.createdAt && (
                  <small
                    style={{
                      display:
                        "block",
                      marginTop:
                        "5px",
                      opacity:
                        0.6,
                    }}
                  >
                    {new Date(
                      msg.createdAt
                    ).toLocaleTimeString(
                      [],
                      {
                        hour:
                          "2-digit",
                        minute:
                          "2-digit",
                      }
                    )}
                  </small>
                )}
              </div>
            );
          }
        )}
      </div>

      {/* ================================================
          SEND MESSAGE
      ================================================= */}

      <div
        style={{
          display: "flex",
          gap: "10px",
          maxWidth: "700px",
        }}
      >
        <input
          type="text"
          placeholder="Type a message..."
          value={message}
          onChange={(e) =>
            setMessage(
              e.target.value
            )
          }
          onKeyDown={
            handleKeyDown
          }
          style={{
            flex: 1,
            padding: "14px",
            borderRadius:
              "8px",
            border:
              "1px solid #ccc",
            fontSize:
              "16px",
          }}
        />

        <button
          onClick={
            sendMessage
          }
          disabled={
            !message.trim() ||
            !connected
          }
          style={{
            padding:
              "14px 22px",
            borderRadius:
              "8px",
            border: "none",
            cursor:
              "pointer",
            fontSize:
              "16px",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default App;