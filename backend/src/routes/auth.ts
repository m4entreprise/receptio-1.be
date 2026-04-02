import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../config/database';
import { generateToken } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  companyName: z.string().min(2),
  companyPhone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

router.post('/register', async (req: Request, res: Response, next) => {
  try {
    const data = registerSchema.parse(req.body);

    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [data.email]
    );

    if (existingUser.rows.length > 0) {
      throw new AppError('Email already registered', 400);
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const companyResult = await query(
      `INSERT INTO companies (name, email, phone_number, settings) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      [data.companyName, data.email, data.companyPhone || null, {}]
    );

    const companyId = companyResult.rows[0].id;

    const userResult = await query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, email, company_id, role`,
      [companyId, data.email, passwordHash, data.firstName || null, data.lastName || null, 'admin']
    );

    const user = userResult.rows[0];
    const token = generateToken({
      id: user.id,
      email: user.email,
      companyId: user.company_id,
      role: user.role,
    });

    logger.info('User registered', { userId: user.id, email: user.email });

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        companyId: user.company_id,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req: Request, res: Response, next) => {
  try {
    const data = loginSchema.parse(req.body);

    const result = await query(
      `SELECT u.id, u.email, u.password_hash, u.company_id, u.role, u.first_name, u.last_name
       FROM users u
       WHERE u.email = $1`,
      [data.email]
    );

    if (result.rows.length === 0) {
      throw new AppError('Invalid credentials', 401);
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(data.password, user.password_hash);

    if (!isValidPassword) {
      throw new AppError('Invalid credentials', 401);
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      companyId: user.company_id,
      role: user.role,
    });

    logger.info('User logged in', { userId: user.id, email: user.email });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        companyId: user.company_id,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
