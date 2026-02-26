"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const formSchema = z.object({
  email: z
    .string()
    .min(3)
    .regex(/^[^\s@]+@[^\s@]+$/, "Invalid email address"),
  password: z.string().min(1),
});

type FormValues = z.infer<typeof formSchema>;

export function LoginForm() {
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const googleEnabled = process.env.NEXT_PUBLIC_ENABLE_GOOGLE === "1";

  const callbackUrl = useMemo(
    () => searchParams.get("callbackUrl") ?? "/app",
    [searchParams],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
        callbackUrl,
      });

      if (result?.ok) {
        toast.success("Signed in. Redirecting…");
        window.location.assign(result.url ?? callbackUrl);
        return;
      } else {
        toast.error("Sign in failed. Check email/password.");
        form.setError("password", { message: "Invalid email or password." });
      }
    } catch {
      toast.error("Sign in failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Use your account to access Probuild ERP.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Form>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <div className="text-xs text-muted-foreground">or</div>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => signIn("google", { callbackUrl })}
          disabled={!googleEnabled}
        >
          Continue with Google
        </Button>
      </CardContent>
    </Card>
  );
}
