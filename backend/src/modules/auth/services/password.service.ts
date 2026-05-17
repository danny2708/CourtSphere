import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export class PasswordService {
  hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }
}

export const passwordService = new PasswordService();
