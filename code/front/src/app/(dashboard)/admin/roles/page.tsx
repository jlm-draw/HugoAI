"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Shield,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Permission {
  id: string;
  name: string;
  code: string;
  module: string;
  description: string | null;
}

interface RolePerm {
  permission: Permission;
}

interface RoleItem {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isSystem: boolean;
  rolePerms: RolePerm[];
  _count: { userRoles: number };
}

const emptyForm = {
  name: "",
  code: "",
  description: "",
  permissionIds: [] as string[],
};

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [rolesRes, permsRes] = await Promise.all([
      fetch("/api/admin/roles"),
      fetch("/api/admin/permissions"),
    ]);
    const rolesData = await rolesRes.json();
    const permsData = await permsRes.json();
    setRoles(rolesData.roles || []);
    setPermissions(permsData.permissions || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const groupedPerms = permissions.reduce(
    (acc, p) => {
      if (!acc[p.module]) acc[p.module] = [];
      acc[p.module].push(p);
      return acc;
    },
    {} as Record<string, Permission[]>
  );

  const openCreate = () => {
    setEditingRole(null);
    setForm(emptyForm);
    setError("");
    setDialogOpen(true);
  };

  const openEdit = (role: RoleItem) => {
    setEditingRole(role);
    setForm({
      name: role.name,
      code: role.code,
      description: role.description || "",
      permissionIds: role.rolePerms.map((rp) => rp.permission.id),
    });
    setError("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const url = editingRole
        ? `/api/admin/roles/${editingRole.id}`
        : "/api/admin/roles";
      const method = editingRole ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "保存失败");
        return;
      }

      setDialogOpen(false);
      loadData();
    } catch {
      setError("网络错误");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const res = await fetch(`/api/admin/roles/${deleteId}`, { method: "DELETE" });
    if (res.ok) {
      setDeleteId(null);
      setDeleteDialogOpen(false);
      loadData();
    }
  };

  const togglePerm = (id: string) => {
    setForm((prev) => ({
      ...prev,
      permissionIds: prev.permissionIds.includes(id)
        ? prev.permissionIds.filter((p) => p !== id)
        : [...prev.permissionIds, id],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">角色权限管理</h1>
          <p className="text-sm text-gray-500 mt-1">管理角色及其权限分配</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4 mr-1" />
          新增角色
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingRole ? "编辑角色" : "新增角色"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>角色名称</Label>
                  <Input
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    placeholder="如：管理员"
                    disabled={editingRole?.isSystem}
                  />
                </div>
                <div className="space-y-2">
                  <Label>角色编码</Label>
                  <Input
                    value={form.code}
                    onChange={(e) =>
                      setForm({ ...form, code: e.target.value })
                    }
                    placeholder="如：admin"
                    disabled={!!editingRole}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>描述</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="角色描述"
                  rows={2}
                />
              </div>
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Lock className="size-4" />
                  权限分配
                </Label>
                <div className="border rounded-lg p-4 space-y-4 max-h-80 overflow-y-auto">
                  {Object.entries(groupedPerms).map(([module, perms]) => (
                    <div key={module}>
                      <h4 className="text-sm font-medium text-gray-700 mb-2 capitalize">
                        {module}
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {perms.map((perm) => (
                          <label
                            key={perm.id}
                            className="flex items-start gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded"
                          >
                            <Checkbox
                              checked={form.permissionIds.includes(perm.id)}
                              onCheckedChange={() => togglePerm(perm.id)}
                            />
                            <div>
                              <div className="text-gray-900">{perm.name}</div>
                              <div className="text-xs text-gray-400">
                                {perm.code}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin mr-1" />}
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>角色名称</TableHead>
              <TableHead>编码</TableHead>
              <TableHead>描述</TableHead>
              <TableHead>权限数量</TableHead>
              <TableHead>用户数</TableHead>
              <TableHead>类型</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="size-6 animate-spin mx-auto text-gray-400" />
                </TableCell>
              </TableRow>
            ) : roles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                  暂无角色数据
                </TableCell>
              </TableRow>
            ) : (
              roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Shield className="size-4 text-blue-500" />
                      {role.name}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{role.code}</TableCell>
                  <TableCell className="text-sm text-gray-500 max-w-xs truncate">
                    {role.description || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{role.rolePerms.length}</Badge>
                  </TableCell>
                  <TableCell>{role._count.userRoles}</TableCell>
                  <TableCell>
                    {role.isSystem ? (
                      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                        系统角色
                      </Badge>
                    ) : (
                      <Badge variant="outline">自定义</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(role)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      {!role.isSystem && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => {
                            setDeleteId(role.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">确定要删除该角色吗？</p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
