import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { User } from '../models';

export interface AuthRequest extends NextApiRequest {
  user?: {
    id: string;
    username: string;
    email: string;
    role: string;
    tenantId?: string;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: NextApiResponse,
  next: () => void
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    const user = await User.findByPk(decoded.id);
    
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid token or user inactive' });
    }

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: NextApiResponse, next: () => void) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
};

export const tenantCheck = (req: AuthRequest, res: NextApiResponse, next: () => void) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (req.user.role !== 'super_admin' && !req.user.tenantId) {
    return res.status(403).json({ message: 'Tenant access required' });
  }

  next();
};

export const operationalOnly = (req: AuthRequest, res: NextApiResponse, next: () => void) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (req.user.role === 'super_admin') {
    return res.status(403).json({ message: 'Super admin cannot access operational endpoints. Please login as tenant admin.' });
  }

  if (!req.user.tenantId) {
    return res.status(403).json({ message: 'Tenant admin or operator access required' });
  }

  next();
};
