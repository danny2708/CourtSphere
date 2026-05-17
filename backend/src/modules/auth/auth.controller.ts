import type { Request, Response } from "express";

import type { LoginInput, RegisterInput } from "./auth.types";
import { authService, type AuthService } from "./services/auth.service";

export class AuthController {
  constructor(private readonly service: AuthService = authService) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const response = await this.service.register(req.body as RegisterInput);
    res.status(201).json(response);
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const response = await this.service.login(req.body as LoginInput);
    res.status(200).json(response);
  };

  me = async (req: Request, res: Response): Promise<void> => {
    const user = await this.service.getCurrentUser(req.user!.id);
    res.status(200).json({ user });
  };

  logout = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      success: true,
      message: "Logged out. JWT blacklist is not enabled in the MVP."
    });
  };
}

export const authController = new AuthController();
