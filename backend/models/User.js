const { query } = require('../config/database');

/**
 * User Model
 * Handles all database operations for users
 */
class User {
  /**
   * Create a new user
   */
  static async create(userData) {
    const {
      studentId,
      email,
      passwordHash,
      firstName,
      lastName,
      phoneNumber,
      role = 'student',
    } = userData;

    const sql = `
      INSERT INTO users (
        student_id, email, password_hash, first_name, last_name, 
        phone_number, role
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, student_id, email, first_name, last_name, 
                phone_number, role, is_active, created_at;
    `;

    const values = [
      studentId,
      email,
      passwordHash,
      firstName,
      lastName,
      phoneNumber,
      role,
    ];

    const result = await query(sql, values);
    return result.rows[0];
  }

  /**
   * Find user by email
   */
  static async findByEmail(email) {
    const sql = `
      SELECT id, student_id, email, password_hash, first_name, last_name,
             phone_number, role, is_active, created_at, updated_at
      FROM users
      WHERE email = $1;
    `;

    const result = await query(sql, [email]);
    return result.rows[0] || null;
  }

  /**
   * Find user by ID
   */
  static async findById(id) {
    const sql = `
      SELECT id, student_id, email, first_name, last_name,
             phone_number, role, is_active, created_at, updated_at
      FROM users
      WHERE id = $1;
    `;

    const result = await query(sql, [id]);
    return result.rows[0] || null;
  }

  /**
   * Find user by student ID
   */
  static async findByStudentId(studentId) {
    const sql = `
      SELECT id, student_id, email, first_name, last_name,
             phone_number, role, is_active, created_at, updated_at
      FROM users
      WHERE student_id = $1;
    `;

    const result = await query(sql, [studentId]);
    return result.rows[0] || null;
  }

  /**
   * Update user
   */
  static async update(id, updateData) {
    const allowedFields = [
      'email',
      'first_name',
      'last_name',
      'phone_number',
      'password_hash',
      'is_active',
      'role',
    ];
    const updates = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updateData)) {
      const dbKey = key
        .split(/(?=[A-Z])/)
        .join('_')
        .toLowerCase();
      if (allowedFields.includes(dbKey) && value !== undefined) {
        updates.push(`${dbKey} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (updates.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(id);
    const sql = `
      UPDATE users
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING id, student_id, email, first_name, last_name,
                phone_number, role, is_active, created_at, updated_at;
    `;

    const result = await query(sql, values);
    return result.rows[0];
  }

  /**
   * Get user without password (safe for returning to client)
   */
  static toSafeUser(user) {
    if (!user) return null;

    const { password_hash, ...safeUser } = user;
    return safeUser;
  }
}

module.exports = User;

