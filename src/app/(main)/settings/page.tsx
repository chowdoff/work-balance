"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { changePassword } from "./actions";

export default function SettingsPage() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    setMessage("");
    setError("");
    try {
      await changePassword(formData);
      setMessage("密码修改成功");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "修改失败");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">个人设置</h1>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-base">修改密码</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>当前密码</Label>
              <Input name="currentPassword" type="password" required />
            </div>
            <div className="space-y-2">
              <Label>新密码</Label>
              <Input name="newPassword" type="password" required minLength={6} />
            </div>
            <div className="space-y-2">
              <Label>确认新密码</Label>
              <Input name="confirmPassword" type="password" required minLength={6} />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            {message && <p className="text-sm text-green-600">{message}</p>}
            <Button type="submit">修改密码</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
