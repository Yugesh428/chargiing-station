import type { NextApiRequest, NextApiResponse } from 'next';
import { generateToken } from '../../../utils/jwt';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;

    console.log('Login attempt with email:', email);

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    // Import User model here to avoid module loading issues
    const { User } = await import('../../../models');

    const user = await User.findOne({ where: { email } });

    console.log('User found:', user ? 'Yes' : 'No');

    if (!user || !user.isActive) {
      console.log('User not found or inactive');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isPasswordValid = await user.comparePassword(password);

    console.log('Password valid:', isPasswordValid);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Update last login
    await user.update({ lastLogin: new Date() });

    const token = generateToken({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    });

    console.log('Login successful for:', email);

    res.status(200).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        tenantId: user.tenantId,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
