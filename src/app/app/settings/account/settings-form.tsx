"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signOut } from "next-auth/react";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  changeEmailSchema,
  changePasswordSchema,
  type ChangeEmailInput,
  type ChangePasswordInput,
} from "@/lib/validators/account";

import { changeEmail, changePassword } from "./actions";

export function AccountSettingsForm({
  user,
}: {
  user: { email: string; name: string | null; role: string } | null;
}) {
  const [pending, startTransition] = useTransition();

  const emailForm = useForm<ChangeEmailInput>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: {
      newEmail: user?.email ?? "",
      currentPassword: "",
    },
  });

  const passwordForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  function afterSuccess() {
    toast.success("Saved. Signing out…");
    setTimeout(() => signOut({ callbackUrl: "/login" }), 500);
  }

  return (
    <div className="space-y-6">
      <Alert>
        <AlertTitle>Signed in as</AlertTitle>
        <AlertDescription>
          {user?.email ?? "Unknown"} {user?.role ? `(${user.role})` : ""}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>Changing email or password will sign you out.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="email" className="w-full">
            <TabsList>
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="password">Password</TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="mt-4">
              <Form {...emailForm}>
                <form
                  onSubmit={emailForm.handleSubmit((values) => {
                    startTransition(async () => {
                      try {
                        await changeEmail(values);
                        afterSuccess();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed to update email.");
                      }
                    });
                  })}
                  className="space-y-4"
                >
                  <FormField
                    control={emailForm.control}
                    name="newEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New email</FormLabel>
                        <FormControl>
                          <Input type="email" autoComplete="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator />

                  <FormField
                    control={emailForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current password</FormLabel>
                        <FormControl>
                          <Input type="password" autoComplete="current-password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={pending}>
                    {pending ? "Saving…" : "Update email"}
                  </Button>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="password" className="mt-4">
              <Form {...passwordForm}>
                <form
                  onSubmit={passwordForm.handleSubmit((values) => {
                    startTransition(async () => {
                      try {
                        await changePassword(values);
                        afterSuccess();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed to update password.");
                      }
                    });
                  })}
                  className="space-y-4"
                >
                  <FormField
                    control={passwordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current password</FormLabel>
                        <FormControl>
                          <Input type="password" autoComplete="current-password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New password</FormLabel>
                          <FormControl>
                            <Input type="password" autoComplete="new-password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={passwordForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm password</FormLabel>
                          <FormControl>
                            <Input type="password" autoComplete="new-password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button type="submit" disabled={pending}>
                    {pending ? "Saving…" : "Update password"}
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

