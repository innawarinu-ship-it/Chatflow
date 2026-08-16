import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

// =====================================================
// LIVE BACKEND
// =====================================================

const SERVER_URL = "https://chatflow-server-xpor.onrender.com";

const socket = io(SERVER_URL, {
  autoConnect: true,
  transports: ["websocket", "polling"],
});

function App() {
  // =====================================================
  // AUTH
  // =====================================================

  const [isLogin, setIsLogin] = useState(true);

  const [loggedIn, setLoggedIn] = useState(
    !!localStorage.getItem("token")
  );

  // =====================================================
  // USER
  // =====================================================

  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  // =====================================================
  // ONLINE
  // =====================================================

  const [onlineUsers, setOnlineUsers] = useState([]);

  // =====================================================
  // AUTH INPUTS
  // =====================================================

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // =====================================================
  // MESSAGE
  // =====================================================

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  // =====================================================
  // UI
  // =====================================================

  const [connected, setConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  // =====================================================
  // UNREAD
  // =====================================================

  const [unreadCounts, setUnreadCounts] = useState({});

  // =====================================================
  // REFS
  // =====================================================

  const currentUserRef = useRef(null);
  const selectedUserRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // =====================================================
  // LOAD CURRENT USER
  // =====================================================

  const loadCurrentUser = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) return;

      const response = await fetch(
        `${SERVER_URL}/api/profile`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        console.log(
          "Profile request failed:",
          response.status
        );
        return;
      }

      const data = await response.json();

      const rawUser = data.user || data;

      if (!rawUser) return;

      const user = {
        id: String(rawUser.id || rawUser._id),
        name: rawUser.name,
        email: rawUser.email,
      };

      setCurrentUser(user);
      currentUserRef.current = user;

      if (socket.connected) {
        socket.emit("user_online", user.id);
      }
    } catch (error) {
      console.error("Profile error:", error);
    }
  };

  // =====================================================
  // LOAD USERS
  // =====================================================

  const loadUsers = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) return;

      const response = await fetch(
        `${SERVER_URL}/api/users`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        console.error(
          "Users request failed:",
          response.status
        );
        return;
      }

      const data = await response.json();

      const formattedUsers = (
        data.users || []
      ).map((user) => ({
        id: String(user.id || user._id),
        name: user.name,
        email: user.email,
      }));

      setUsers(formattedUsers);
    } catch (error) {
      console.error("Users error:", error);
    }
  };

  // =====================================================
  // LOGIN / REGISTER
  // =====================================================

  const handleAuth = async (e) => {
    e.preventDefault();

    const url = isLogin
      ? `${SERVER_URL}/api/auth/login`
      : `${SERVER_URL}/api/auth/register`;

    const body = isLogin
      ? {
          email,
          password,
        }
      : {
          name,
          email,
          password,
        };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(
          data.message ||
            "Something went wrong"
        );
        return;
      }

      // =================================================
      // LOGIN SUCCESS
      // =================================================

      if (isLogin && data.token) {
        localStorage.setItem(
          "token",
          data.token
        );

        const rawUser = data.user;

        if (rawUser) {
          const user = {
            id: String(
              rawUser.id ||
                rawUser._id
            ),
            name: rawUser.name,
            email: rawUser.email,
          };

          setCurrentUser(user);
          currentUserRef.current = user;

          if (socket.connected) {
            socket.emit(
              "user_online",
              user.id
            );
          }
        }

        setLoggedIn(true);
        setPassword("");

        await loadUsers();
      } else {
        // =================================================
        // REGISTER SUCCESS
        // =================================================

        alert(
          data.message ||
            "Account created successfully"
        );

        setIsLogin(true);
        setPassword("");
      }
    } catch (error) {
      console.error(
        "Auth error:",
        error
      );

      alert(
        "Cannot connect to server"
      );
    }
  };

  // =====================================================
  // MARK ALL SEEN
  // =====================================================

  const markAllMessagesSeen = (
    senderId,
    receiverId
  ) => {
    if (!senderId || !receiverId) {
      return;
    }

    socket.emit(
      "mark_all_messages_seen",
      {
        sender: String(senderId),
        receiver: String(receiverId),
      }
    );
  };

  // =====================================================
  // MARK ONE SEEN
  // =====================================================

  const markMessageSeen = (messageId) => {
    const currentUser =
      currentUserRef.current;

    if (!messageId || !currentUser) {
      return;
    }

    socket.emit(
      "mark_message_seen",
      {
        messageId,
        receiver: String(
          currentUser.id
        ),
      }
    );
  };

  // =====================================================
  // LOAD MESSAGES
  // =====================================================

  const loadMessages = async (userId) => {
    try {
      const token =
        localStorage.getItem("token");

      const currentUser =
        currentUserRef.current;

      if (
        !token ||
        !userId ||
        !currentUser
      ) {
        return;
      }

      const response = await fetch(
        `${SERVER_URL}/api/messages/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        console.error(
          "Messages request failed:",
          response.status
        );
        return;
      }

      const data =
        await response.json();

      const loadedMessages =
        data.messages || [];

      setMessages(
        loadedMessages
      );

      markAllMessagesSeen(
        String(userId),
        String(currentUser.id)
      );

      setUnreadCounts(
        (previous) => ({
          ...previous,
          [String(userId)]: 0,
        })
      );
    } catch (error) {
      console.error(
        "Messages error:",
        error
      );
    }
  };

  // =====================================================
  // SELECT USER
  // =====================================================

  const selectUser = (user) => {
    const formattedUser = {
      id: String(
        user.id || user._id
      ),
      name: user.name,
      email: user.email,
    };

    setSelectedUser(
      formattedUser
    );

    selectedUserRef.current =
      formattedUser;

    setMessages([]);
    setIsTyping(false);

    setUnreadCounts(
      (previous) => ({
        ...previous,
        [formattedUser.id]: 0,
      })
    );

    loadMessages(
      formattedUser.id
    );
  };

  // =====================================================
  // SEND MESSAGE
  // =====================================================

  const sendMessage = () => {
    const currentUser =
      currentUserRef.current;

    const selectedUser =
      selectedUserRef.current;

    if (!message.trim()) return;

    if (
      !currentUser ||
      !selectedUser
    ) {
      alert(
        "Please select a user first"
      );
      return;
    }

    if (!socket.connected) {
      alert(
        "Socket is not connected. Please wait a moment and try again."
      );
      return;
    }

    const messageData = {
      sender: String(
        currentUser.id
      ),
      receiver: String(
        selectedUser.id
      ),
      message:
        message.trim(),
    };

    console.log(
      "Sending:",
      messageData
    );

    socket.emit(
      "send_message",
      messageData
    );

    socket.emit(
      "stop_typing",
      {
        sender: String(
          currentUser.id
        ),
        receiver: String(
          selectedUser.id
        ),
      }
    );

    setMessage("");
    setIsTyping(false);

    if (
      typingTimeoutRef.current
    ) {
      clearTimeout(
        typingTimeoutRef.current
      );
    }
  };

  // =====================================================
  // TYPING
  // =====================================================

  const handleTyping = (e) => {
    const value =
      e.target.value;

    setMessage(value);

    const currentUser =
      currentUserRef.current;

    const selectedUser =
      selectedUserRef.current;

    if (
      !currentUser ||
      !selectedUser ||
      !socket.connected
    ) {
      return;
    }

    const typingData = {
      sender: String(
        currentUser.id
      ),
      receiver: String(
        selectedUser.id
      ),
    };

    if (
      value.trim().length > 0
    ) {
      socket.emit(
        "typing",
        typingData
      );
    } else {
      socket.emit(
        "stop_typing",
        typingData
      );
    }

    if (
      typingTimeoutRef.current
    ) {
      clearTimeout(
        typingTimeoutRef.current
      );
    }

    typingTimeoutRef.current =
      setTimeout(() => {
        socket.emit(
          "stop_typing",
          typingData
        );
      }, 1200);
  };

  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    if (!loggedIn) return;

    loadCurrentUser();
    loadUsers();
  }, [loggedIn]);

  // =====================================================
  // SOCKET
  // =====================================================

  useEffect(() => {
    if (!loggedIn) return;

    const handleConnect = () => {
      setConnected(true);

      console.log(
        "🟢 Socket connected:",
        socket.id
      );

      if (
        currentUserRef.current
      ) {
        socket.emit(
          "user_online",
          currentUserRef.current.id
        );
      }
    };

    const handleDisconnect = () => {
      setConnected(false);

      console.log(
        "🔴 Socket disconnected"
      );
    };

    const handleOnlineUsers = (
      userIds
    ) => {
      setOnlineUsers(
        (userIds || []).map(
          (id) => String(id)
        )
      );
    };

    // ===================================================
    // RECEIVE MESSAGE
    // ===================================================

    const handleReceiveMessage = (
      data
    ) => {
      const currentUser =
        currentUserRef.current;

      const selectedUser =
        selectedUserRef.current;

      if (!currentUser) return;

      const senderId =
        String(data.sender);

      const receiverId =
        String(data.receiver);

      const currentUserId =
        String(
          currentUser.id
        );

      // Incoming message
      if (
        senderId !==
        currentUserId
      ) {
        const isSelectedChat =
          selectedUser &&
          String(
            selectedUser.id
          ) === senderId;

        if (isSelectedChat) {
          if (data._id) {
            markMessageSeen(
              data._id
            );
          }
        } else {
          setUnreadCounts(
            (previous) => ({
              ...previous,
              [senderId]:
                (previous[
                  senderId
                ] || 0) + 1,
            })
          );

          if (
            document.hidden &&
            "Notification" in
              window &&
            Notification.permission ===
              "granted"
          ) {
            new Notification(
              "New message",
              {
                body:
                  data.message,
              }
            );
          }
        }
      }

      if (!selectedUser) {
        return;
      }

      const selectedUserId =
        String(
          selectedUser.id
        );

      const isCurrentChat =
        (senderId ===
          currentUserId &&
          receiverId ===
            selectedUserId) ||
        (senderId ===
          selectedUserId &&
          receiverId ===
            currentUserId);

      if (isCurrentChat) {
        setMessages(
          (previous) => {
            const exists =
              previous.some(
                (msg) =>
                  msg._id &&
                  data._id &&
                  String(
                    msg._id
                  ) ===
                    String(
                      data._id
                    )
              );

            if (exists) {
              return previous;
            }

            return [
              ...previous,
              data,
            ];
          }
        );

        setIsTyping(false);
      }
    };

    // ===================================================
    // MESSAGE SEEN
    // ===================================================

    const handleMessageSeen = (
      data
    ) => {
      if (
        !data ||
        !data.messageId
      ) {
        return;
      }

      setMessages(
        (previous) =>
          previous.map(
            (msg) => {
              if (
                String(
                  msg._id
                ) ===
                String(
                  data.messageId
                )
              ) {
                return {
                  ...msg,
                  seen: true,
                };
              }

              return msg;
            }
          )
      );
    };

    // ===================================================
    // ALL MESSAGES SEEN
    // ===================================================

    const handleAllMessagesSeen = (
      data
    ) => {
      if (
        !data ||
        !data.sender ||
        !data.receiver
      ) {
        return;
      }

      const senderId =
        String(data.sender);

      const receiverId =
        String(data.receiver);

      setMessages(
        (previous) =>
          previous.map(
            (msg) => {
              const msgSender =
                String(
                  msg.sender
                );

              const msgReceiver =
                String(
                  msg.receiver
                );

              if (
                msgSender ===
                  senderId &&
                msgReceiver ===
                  receiverId
              ) {
                return {
                  ...msg,
                  seen: true,
                };
              }

              return msg;
            }
          )
      );

      if (
        currentUserRef.current &&
        receiverId ===
          String(
            currentUserRef.current.id
          )
      ) {
        setUnreadCounts(
          (previous) => ({
            ...previous,
            [senderId]: 0,
          })
        );
      }
    };

    // ===================================================
    // TYPING
    // ===================================================

    const handleUserTyping = (
      data
    ) => {
      const currentUser =
        currentUserRef.current;

      const selectedUser =
        selectedUserRef.current;

      if (
        !currentUser ||
        !selectedUser
      ) {
        return;
      }

      const senderId =
        String(data.sender);

      const receiverId =
        String(data.receiver);

      const currentUserId =
        String(
          currentUser.id
        );

      const selectedUserId =
        String(
          selectedUser.id
        );

      if (
        senderId ===
          selectedUserId &&
        receiverId ===
          currentUserId
      ) {
        setIsTyping(true);
      }
    };

    // ===================================================
    // STOP TYPING
    // ===================================================

    const handleUserStopTyping = (
      data
    ) => {
      const currentUser =
        currentUserRef.current;

      const selectedUser =
        selectedUserRef.current;

      if (
        !currentUser ||
        !selectedUser
      ) {
        return;
      }

      const senderId =
        String(data.sender);

      const receiverId =
        String(data.receiver);

      const currentUserId =
        String(
          currentUser.id
        );

      const selectedUserId =
        String(
          selectedUser.id
        );

      if (
        senderId ===
          selectedUserId &&
        receiverId ===
          currentUserId
      ) {
        setIsTyping(false);
      }
    };

    // ===================================================
    // LISTENERS
    // ===================================================

    socket.on(
      "connect",
      handleConnect
    );

    socket.on(
      "disconnect",
      handleDisconnect
    );

    socket.on(
      "online_users",
      handleOnlineUsers
    );

    socket.on(
      "receive_message",
      handleReceiveMessage
    );

    socket.on(
      "message_seen",
      handleMessageSeen
    );

    socket.on(
      "all_messages_seen",
      handleAllMessagesSeen
    );

    socket.on(
      "user_typing",
      handleUserTyping
    );

    socket.on(
      "user_stop_typing",
      handleUserStopTyping
    );

    if (socket.connected) {
      setConnected(true);
    }

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
        "online_users",
        handleOnlineUsers
      );

      socket.off(
        "receive_message",
        handleReceiveMessage
      );

      socket.off(
        "message_seen",
        handleMessageSeen
      );

      socket.off(
        "all_messages_seen",
        handleAllMessagesSeen
      );

      socket.off(
        "user_typing",
        handleUserTyping
      );

      socket.off(
        "user_stop_typing",
        handleUserStopTyping
      );
    };
  }, [loggedIn]);

  // =====================================================
  // NOTIFICATIONS
  // =====================================================

  useEffect(() => {
    if (
      loggedIn &&
      "Notification" in
        window &&
      Notification.permission ===
        "default"
    ) {
      Notification.requestPermission();
    }
  }, [loggedIn]);

  // =====================================================
  // AUTO SCROLL
  // =====================================================

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, isTyping]);

  // =====================================================
  // LOGOUT
  // =====================================================

  const logout = () => {
    const currentUser =
      currentUserRef.current;

    const selectedUser =
      selectedUserRef.current;

    if (
      currentUser &&
      selectedUser &&
      socket.connected
    ) {
      socket.emit(
        "stop_typing",
        {
          sender: String(
            currentUser.id
          ),
          receiver: String(
            selectedUser.id
          ),
        }
      );
    }

    if (
      currentUser &&
      socket.connected
    ) {
      socket.emit(
        "user_offline",
        currentUser.id
      );
    }

    localStorage.removeItem(
      "token"
    );

    setLoggedIn(false);
    setCurrentUser(null);
    setUsers([]);
    setSelectedUser(null);
    setMessages([]);
    setMessage("");
    setIsTyping(false);
    setUnreadCounts({});
    setOnlineUsers([]);
    setConnected(false);

    currentUserRef.current =
      null;

    selectedUserRef.current =
      null;
  };

  // =====================================================
  // LOGIN SCREEN
  // =====================================================

  if (!loggedIn) {
    return (
      <div className="login-screen">

        <div className="login-glow glow-one"></div>

        <div className="login-glow glow-two"></div>

        <div className="login-card">

          <div className="brand-icon">
            💬
          </div>

          <h1>
            ChatFlow
          </h1>

          <p className="tagline">
            Private conversations.
            Simple connection.
          </p>

          <h2 className="login-heading">
            {isLogin
              ? "Welcome Back"
              : "Create Account"}
          </h2>

          <form
            onSubmit={handleAuth}
          >

            {!isLogin && (
              <input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) =>
                  setName(
                    e.target.value
                  )
                }
                required
              />
            )}

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) =>
                setEmail(
                  e.target.value
                )
              }
              required
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) =>
                setPassword(
                  e.target.value
                )
              }
              required
            />

            <button
              type="submit"
              className="login-button"
            >
              {isLogin
                ? "Login"
                : "Create Account"}
            </button>

          </form>

          <button
            className="change-auth"
            onClick={() =>
              setIsLogin(
                !isLogin
              )
            }
          >
            {isLogin
              ? "New here? Create an account"
              : "Already have an account? Login"}
          </button>

        </div>
      </div>
    );
  }

  // =====================================================
  // OTHER USERS
  // =====================================================

  const otherUsers =
    users.filter(
      (user) =>
        String(user.id) !==
        String(
          currentUser?.id
        )
    );

  // =====================================================
  // CHAT PAGE
  // =====================================================

  return (
    <div className="app-shell">

      {/* =================================================
          SIDEBAR
      ================================================= */}

      <aside className="side-panel">

        <div className="brand">

          <div className="brand-mark">
            💬
          </div>

          <div>
            <h2>
              ChatFlow
            </h2>

            <span>
              ONE-TO-ONE MESSAGING
            </span>
          </div>

        </div>

        <div className="profile-box">

          <div className="profile-avatar">
            {currentUser?.name
              ?.charAt(0)
              ?.toUpperCase() ||
              "U"}
          </div>

          <div className="profile-details">

            <strong>
              {currentUser?.name ||
                "Loading..."}
            </strong>

            <span>
              {currentUser?.email ||
                ""}
            </span>

          </div>

        </div>

        <div className="people-title">

          <span>
            PEOPLE
          </span>

          <b>
            {otherUsers.length}
          </b>

        </div>

        <div className="people-list">

          {otherUsers.length ===
          0 ? (

            <p className="no-people">
              No other users found
            </p>

          ) : (

            otherUsers.map(
              (user) => {

                const unread =
                  unreadCounts[
                    user.id
                  ] || 0;

                const isOnline =
                  onlineUsers.includes(
                    String(
                      user.id
                    )
                  );

                return (
                  <button
                    key={user.id}
                    className={
                      selectedUser?.id ===
                      user.id
                        ? "person active"
                        : "person"
                    }
                    onClick={() =>
                      selectUser(
                        user
                      )
                    }
                  >

                    <div className="person-avatar">

                      {user.name
                        ?.charAt(0)
                        ?.toUpperCase()}

                      <div
                        className={
                          isOnline
                            ? "online-dot"
                            : "offline-dot"
                        }
                      ></div>

                    </div>

                    <div className="person-text">

                      <strong>
                        {user.name}
                      </strong>

                      <span>
                        {isOnline
                          ? "Online"
                          : user.email}
                      </span>

                    </div>

                    <div className="person-right">

                      {unread > 0 && (
                        <div className="unread-badge">
                          {unread >
                          99
                            ? "99+"
                            : unread}
                        </div>
                      )}

                      {selectedUser?.id ===
                        user.id && (
                        <div className="selected-dot"></div>
                      )}

                    </div>

                  </button>
                );
              }
            )

          )}

        </div>

        <div className="side-bottom">

          <div className="connection">

            <div
              className={
                connected
                  ? "connection-dot online"
                  : "connection-dot"
              }
            ></div>

            {connected
              ? "Connected"
              : "Disconnected"}

          </div>

          <button
            className="logout"
            onClick={logout}
          >
            Logout
          </button>

        </div>

      </aside>

      {/* =================================================
          CONVERSATION
      ================================================= */}

      <main className="conversation">

        {!selectedUser ? (

          <div className="welcome">

            <div className="welcome-symbol">
              💬
            </div>

            <h1>
              Welcome to ChatFlow
            </h1>

            <p>
              Select someone from
              the sidebar
              <br />
              and start a private
              conversation.
            </p>

            <div className="welcome-line"></div>

          </div>

        ) : (

          <>

            <header className="conversation-header">

              <div className="header-avatar">

                {selectedUser.name
                  ?.charAt(0)
                  ?.toUpperCase()}

                {onlineUsers.includes(
                  String(
                    selectedUser.id
                  )
                ) && (
                  <div className="header-online-dot"></div>
                )}

              </div>

              <div>

                <h2>
                  {selectedUser.name}
                </h2>

                <span>

                  {isTyping
                    ? "typing..."
                    : onlineUsers.includes(
                        String(
                          selectedUser.id
                        )
                      )
                    ? "Online"
                    : selectedUser.email}

                </span>

              </div>

              <div className="header-status">

                <span></span>

                ACTIVE CHAT

              </div>

            </header>

            <div className="messages">

              {messages.length ===
                0 &&
              !isTyping ? (

                <div className="empty-messages">

                  <div>
                    👋
                  </div>

                  <h3>
                    Start the conversation
                  </h3>

                  <p>
                    Say hello to{" "}
                    {selectedUser.name}.
                  </p>

                </div>

              ) : (

                <>

                  {messages.map(
                    (msg, index) => {

                      const isMine =
                        String(
                          msg.sender
                        ) ===
                        String(
                          currentUser?.id
                        );

                      return (
                        <div
                          key={
                            msg._id ||
                            `${msg.sender}-${index}`
                          }
                          className={
                            isMine
                              ? "message-line mine"
                              : "message-line"
                          }
                        >

                          <div
                            className={
                              isMine
                                ? "bubble mine"
                                : "bubble"
                            }
                          >

                            <p>
                              {msg.message}
                            </p>

                            <small>

                              {msg.createdAt
                                ? new Date(
                                    msg.createdAt
                                  ).toLocaleTimeString(
                                    [],
                                    {
                                      hour: "2-digit",
                                      minute:
                                        "2-digit",
                                    }
                                  )
                                : ""}

                              {isMine && (
                                <span
                                  style={{
                                    marginLeft:
                                      "8px",
                                    fontWeight:
                                      "600",
                                  }}
                                >
                                  {msg.seen
                                    ? "✓✓ Seen"
                                    : "✓ Sent"}
                                </span>
                              )}

                            </small>

                          </div>

                        </div>
                      );
                    }
                  )}

                  {isTyping && (

                    <div className="typing-indicator">

                      <div className="typing-dots">

                        <span></span>
                        <span></span>
                        <span></span>

                      </div>

                      <p>
                        {selectedUser.name}{" "}
                        is typing...
                      </p>

                    </div>

                  )}

                </>

              )}

              <div
                ref={
                  messagesEndRef
                }
              ></div>

            </div>

            <div className="composer">

              <div className="composer-box">

                <input
                  type="text"
                  placeholder={`Message ${selectedUser.name}...`}
                  value={message}
                  onChange={
                    handleTyping
                  }
                  onKeyDown={(e) => {

                    if (
                      e.key ===
                        "Enter" &&
                      !e.shiftKey
                    ) {
                      e.preventDefault();

                      sendMessage();
                    }

                  }}
                />

                <button
                  onClick={
                    sendMessage
                  }
                  disabled={
                    !message.trim()
                  }
                >
                  ➤
                </button>

              </div>

              <small>
                Press Enter to send
              </small>

            </div>

          </>

        )}

      </main>

    </div>
  );
}

export default App;