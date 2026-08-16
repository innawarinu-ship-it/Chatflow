
const express = require("express");
const mongoose = require("mongoose");
const Message = require("../models/Message");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// ======================================================
// SEND MESSAGE - REST API
// ======================================================

router.post("/send", authMiddleware, async (req, res) => {
    try {
        const { receiver, message } = req.body;

        if (!receiver || !message || !message.trim()) {
            return res.status(400).json({
                message: "Receiver and message are required"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(receiver)) {
            return res.status(400).json({
                message: "Invalid receiver ID"
            });
        }

        const newMessage = await Message.create({
            sender: req.user.id,
            receiver: receiver,
            message: message.trim()
        });

        return res.status(201).json({
            message: "Message sent successfully",
            data: newMessage
        });

    } catch (error) {
        console.error("Send message error:", error);

        return res.status(500).json({
            message: "Server error"
        });
    }
});


// ======================================================
// GET CONVERSATION BETWEEN TWO USERS
// ======================================================

router.get("/:userId", authMiddleware, async (req, res) => {
    try {
        const currentUser = req.user.id;
        const otherUser = req.params.userId;

        if (!mongoose.Types.ObjectId.isValid(otherUser)) {
            return res.status(400).json({
                message: "Invalid user ID"
            });
        }

        const messages = await Message.find({
            $or: [
                {
                    sender: currentUser,
                    receiver: otherUser
                },
                {
                    sender: otherUser,
                    receiver: currentUser
                }
            ]
        })
        .sort({ createdAt: 1 })
        .lean();

        return res.status(200).json({
            messages
        });

    } catch (error) {
        console.error("Get messages error:", error);

        return res.status(500).json({
            message: "Server error"
        });
    }
});


// ======================================================
// EXPORT
// ======================================================

module.exports = router;

