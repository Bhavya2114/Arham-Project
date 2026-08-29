import { User } from '../models/User';
import { comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import { LoginInput } from '../validators/auth.validator';
import { AuthenticatedUser } from '../types/auth.types';

export interface LoginResult {
  token: string;
  user: AuthenticatedUser;
}

export const login = async (input: LoginInput): Promise<LoginResult> => {
  const user = await User.findOne({ email: input.email.toLowerCase() });

  if (!user) {
    const error = new Error('Invalid email or password');
    (error as any).statusCode = 401;
    throw error;
  }

  const isPasswordValid = await comparePassword(input.password, user.password);
  if (!isPasswordValid) {
    const error = new Error('Invalid email or password');
    (error as any).statusCode = 401;
    throw error;
  }

  const userIdStr = user._id.toString();

  const token = generateToken({
    userId: userIdStr,
    email: user.email,
    role: user.role,
  });

  return {
    token,
    user: {
      id: userIdStr,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
};

export const getProfile = async (userId: string): Promise<AuthenticatedUser> => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    (error as any).statusCode = 404;
    throw error;
  }

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
  };
};
