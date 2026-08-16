
const express = require("express");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();


// ======================================================
// GET CURRENT USER PROFILE
// ======================================================

router.get("/profile", authMiddleware, async (req, res) => {
    try {

        const user = await User.findById(req.user.id)
            .select("-password")
            .lean();

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        return res.status(200).json({
            user
        });

    } catch (error) {

        console.error(
            "Profile error:",
            error
        );

        return res.status(500).json({
            message: "Server error"
        });

    }
});


// ======================================================
// GET ALL USERS
// ======================================================

router.get("/", authMiddleware, async (req, res) => {
    try {

        const users = await User.find({
            _id: {
                $ne: req.user.id
            }
        })
        .select("-password")
        .lean();

        return res.status(200).json({
            users
        });

    } catch (error) {

        console.error(
            "Users error:",
            error
        );

        return res.status(500).json({
            message: "Server error"
        });

    }
});


module.exports = router;
