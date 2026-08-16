import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

const SENDER_ID = "6a81a609c446d5a0b503ba7d";
const RECEIVER_ID = "6a81766b45d461534f066a11";

function App() {
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  const loadMessages = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        console.log("No login token found");
        return;
      }

      const response = await fetch(
        `http://localhost:5000/api/messages/${RECEIVER_ID}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (response.ok) {
        setMessages(data.messages);
      } else {
        console.log("Failed to load messages:", data);
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const sendMessage = () => {
    if (!message.trim()) return;

    console.log("Sending message:", message);

    socket.emit("send_message", {
      sender: SENDER_ID,
      receiver: RECEIVER_ID,
      message: message
    });

    setMessage("");
  };

  useEffect(() => {
    loadMessages();

    socket.on("connect", () => {
      console.log("Connected to server:", socket.id);
      setConnected(true);
    });

    socket.on("receive_message", (data) => {
      console.log("Message received:", data);

      setMessages((previousMessages) => [
        ...previousMessages,
        data
      ]);
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from server");
      setConnected(false);
    });

    return () => {
      socket.off("connect");
      socket.off("receive_message");
      socket.off("disconnect");
    };
  }, []);

  return (
    <div>
      <h1>One-to-One Chat 💬</h1>

      <h2>
        Socket Status:{" "}
        {connected ? "🟢 Connected" : "🔴 Disconnected"}
      </h2>

      <input
        type="text"
        placeholder="Type a message..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />

      <button onClick={sendMessage}>
        Send
      </button>

      <h2>Messages</h2>

      {messages.length === 0 ? (
        <p>No messages yet.</p>
      ) : (
        messages.map((msg) => (
          <p key={msg._id}>
            {msg.message}
          </p>
        ))
      )}
    </div>
  );
}

export default App;