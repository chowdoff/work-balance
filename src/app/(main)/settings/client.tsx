"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { changeName, changePassword } from "./actions";

export function SettingsClient({ userName }: { userName: string }) {
  const [nameMessage, setNameMessage] = useState("");
  const [nameError, setNameError] = useState("");
  const [pwdMessage, setPwdMessage] = useState("");
  const [pwdError, setPwdError] = useState("");

  async function handleNameSubmit(formData: FormData) {
    setNameMessage("");
    setNameError("");
    try {
      await changeName(formData);
      setNameMessage("姓名修改成功");
    } catch (e: unknown) {
      setNameError(e instanceof Error ? e.message : "修改失败");
    }
  }

  async function handlePasswordSubmit(formData: FormData) {
    setPwdMessage("");
    setPwdError("");
    try {
      await changePassword(formData);
      setPwdMessage("密码修改成功");
    } catch (e: unknown) {
      setPwdError(e instanceof Error ? e.message : "修改失败");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">个人设置</h1>

      <div className="space-y-6 max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">修改姓名</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={handleNameSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>姓名</Label>
                <Input name="name" required defaultValue={userName} maxLength={50} />
              </div>
              {nameError && <p className="text-sm text-red-500">{nameError}</p>}
              {nameMessage && <p className="text-sm text-green-600">{nameMessage}</p>}
              <Button type="submit">保存</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">修改密码</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={handlePasswordSubmit} className="space-y-4">
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
              {pwdError && <p className="text-sm text-red-500">{pwdError}</p>}
              {pwdMessage && <p className="text-sm text-green-600">{pwdMessage}</p>}
              <Button type="submit">修改密码</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
