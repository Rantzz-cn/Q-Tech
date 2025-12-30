const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Generate JWT Token
 */
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE || '7d',
    }
  );
};

/**
 * Register a new user
 * POST /api/auth/register
 */
exports.register = async (req, res) => {
  try {
    const {
      studentId,
      email,
      password,
      firstName,
      lastName,
      phoneNumber,
      role = 'student',
    } = req.body;

    // Validation
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Please provide email, password, first name, and last name',
        },
      });
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'User with this email already exists',
        },
      });
    }

    // Check if student ID already exists (if provided)
    if (studentId) {
      const existingStudentId = await User.findByStudentId(studentId);
      if (existingStudentId) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Student ID already registered',
          },
        });
      }
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const userData = {
      studentId,
      email: email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      phoneNumber,
      role,
    };

    const user = await User.create(userData);
    const safeUser = User.toSafeUser(user);

    // Generate token
    const token = generateToken(user.id, user.role);

    res.status(201).json({
      success: true,
      data: {
        user: safeUser,
        token,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error creating user',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message }),
      },
    });
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Please provide email and password',
        },
      });
    }

    // Find user
    const user = await User.findByEmail(email.toLowerCase());
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid credentials',
        },
      });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Account is deactivated',
        },
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid credentials',
        },
      });
    }

    // Generate token
    const token = generateToken(user.id, user.role);
    const safeUser = User.toSafeUser(user);

    res.json({
      success: true,
      data: {
        user: safeUser,
        token,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error during login',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message }),
      },
    });
  }
};

/**
 * Get current user
 * GET /api/auth/me
 */
exports.getMe = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'User not found',
        },
      });
    }

    const safeUser = User.toSafeUser(user);

    res.json({
      success: true,
      data: safeUser,
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching user',
        ...(process.env.NODE_ENV === 'development' && { detail: error.message }),
      },
    });
  }
};

