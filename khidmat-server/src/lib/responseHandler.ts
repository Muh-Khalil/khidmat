import { Response } from 'express';

/** Envelope every endpoint returns, so clients can branch on `success` uniformly. */
export type ApiResponse<T = unknown> = {
  success: boolean;
  message: string;
  data: T | null;
};

export const handleError = <T = unknown>(res: Response, statusCode: number, message: string, data: T | null = null) => {
  const body: ApiResponse<T> = { success: false, message, data };
  return res.status(statusCode).json(body);
};

export const handleSuccess = <T = unknown>(res: Response, statusCode: number, message: string, data: T | null = null) => {
  const body: ApiResponse<T> = { success: true, message, data };
  return res.status(statusCode).json(body);
};
