require('dotenv').config(); // Load environment variables
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const User = require('../models/User'); // Ensure you have a User model defined
const router = express.Router();

EMAIL_USER="vamshimamidala2521@gmail.com"
EMAIL_PASS="tkdh ouql tbww rbro"
JWT_SECRET="024bd2518f5a241a27a38b6ad4b81f8b6281c62b6acd5387f64c482b53c9f28a"


// Configure Nodemailer
const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
    },
});

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads'); // Make sure the 'uploads' folder exists
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    },
});
const upload = multer({ storage });
// File upload route
router.post('/upload', upload.single('image'), (req, res) => {
  try {
      res.status(200).json({ message: 'File uploaded successfully', filename: req.file.filename });
  } catch (error) {
      res.status(500).json({ message: 'File upload failed', error });
  }
});

// Middleware to verify JWT and allow authenticated users only
const authMiddleware = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer')) {
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    const token = authHeader.replace('Bearer ', '');
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token is not valid' });
    }
};

// Registration route
router.post('/register', upload.single('file'), async (req, res) => {
    const { businessName, email, contactNumber, address, city, postalCode, password } = req.body;

    try {
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ msg: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        user = new User({
            businessName,
            email,
            contactNumber,
            address,
            city,
            postalCode,
            password: hashedPassword,
            file: req.file ? req.file.path : null,
        });

        await user.save();
        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1h' });
        res.status(201).json({ token, msg: 'Registration successful' });
    } catch (err) {
        res.status(500).json({ msg: 'Server error', error: err.message });
    }
});

// Login route
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        let user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, msg: 'Login successful' });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// Route to request a password reset
 // Route to request a password reset
router.post('/forgot', async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ msg: 'User with this email does not exist' });
        }

        // Create a JWT token that expires in 2 minutes
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '10m' });
        const resetLink = `http://yourapp.com/reset-password/${token}`;

        // Send email with the reset link
        await transporter.sendMail({
            to: email,
            subject: 'Password Reset',
            html: `<p>You requested a password reset. Click <a href="${resetLink}">here</a> to reset your password.</p><p>This link will expire in 10 minutes.</p>`,
        });

        res.status(200).json({ msg: 'Reset link sent to your email' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
});

// Route to reset the password
router.post('/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    const { newPassword, confirmPassword } = req.body;

    try {
        // Verify the token and handle expiration
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(400).json({ msg: 'Invalid or expired token' });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ msg: 'Passwords do not match' });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedNewPassword;

        await user.save();

        res.status(200).json({ msg: 'Password reset successfully' });
    } catch (err) {
        console.error(err);

        // Handle token expiration and invalid token cases
        if (err.name === 'TokenExpiredError') {
            return res.status(400).json({ msg: 'Token has expired. Please request a new reset link.' });
        } else if (err.name === 'JsonWebTokenError') {
            return res.status(400).json({ msg: 'Invalid token' });
        }

        res.status(500).json({ msg: 'Server error' });
    }
});


// Change password route

router.post('/change-password', authMiddleware, async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Current password is incorrect' });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ msg: 'New password and confirm password do not match' });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedNewPassword;
        await user.save();

        res.status(200).json({ msg: 'Password changed successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});
module.exports = router;
