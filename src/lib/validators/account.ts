import { z } from "zod";

export const changeEmailSchema = z.object({
  newEmail: z.string().email(),
  currentPassword: z.string().min(1),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ChangeEmailInput = z.input<typeof changeEmailSchema>;
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;

