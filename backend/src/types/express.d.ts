declare namespace Express {
  interface Request {
    user?: {
      id: string;
      userId: string;
      email: string;
      role?: "admin" | "editor" | "viewer";
      name?: string;
    };
  }
}