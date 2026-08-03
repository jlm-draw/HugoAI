"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Menu as MenuIcon,
  ChevronRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MenuNode {
  id: string;
  name: string;
  path: string | null;
  icon: string | null;
  sort: number;
  isVisible: boolean;
  permissionCode: string | null;
  children: MenuNode[];
}

const emptyForm = {
  name: "",
  path: "",
  icon: "",
  sort: 0,
  parentId: "",
  isVisible: true,
  permissionCode: "",
};

export default function MenusPage() {
  const [menus, setMenus] = useState<MenuNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<MenuNode | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // 注意：首屏 loading 初值为 true，此处不在 await 前同步 setLoading，
  // 以满足 react-hooks/set-state-in-effect 规则
  const loadMenus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/menus");
      const data = await res.json();
      setMenus(data.menus || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMenus();
  }, [loadMenus]);

  const openCreate = (parentId?: string) => {
    setEditingMenu(null);
    setForm({ ...emptyForm, parentId: parentId || "" });
    setError("");
    setDialogOpen(true);
  };

  const openEdit = (menu: MenuNode) => {
    setEditingMenu(menu);
    setForm({
      name: menu.name,
      path: menu.path || "",
      icon: menu.icon || "",
      sort: menu.sort,
      parentId: "",
      isVisible: menu.isVisible,
      permissionCode: menu.permissionCode || "",
    });
    setError("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const url = editingMenu
        ? `/api/admin/menus/${editingMenu.id}`
        : "/api/admin/menus";
      const method = editingMenu ? "PATCH" : "POST";

      const body: Record<string, unknown> = {
        name: form.name,
        path: form.path,
        icon: form.icon,
        sort: Number(form.sort) || 0,
        parentId: form.parentId || null,
        isVisible: form.isVisible,
        permissionCode: form.permissionCode || null,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "保存失败");
        return;
      }

      setDialogOpen(false);
      loadMenus();
    } catch {
      setError("网络错误");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const res = await fetch(`/api/admin/menus/${deleteId}`, { method: "DELETE" });
    if (res.ok) {
      setDeleteId(null);
      setDeleteDialogOpen(false);
      loadMenus();
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const flattenTree = (nodes: MenuNode[], depth = 0): (MenuNode & { depth: number })[] => {
    const result: (MenuNode & { depth: number })[] = [];
    for (const node of nodes) {
      result.push({ ...node, depth });
      if (node.children.length > 0) {
        result.push(...flattenTree(node.children, depth + 1));
      }
    }
    return result;
  };

  const flatTree = flattenTree(menus);

  const getMenuOptions = (
    nodes: MenuNode[],
    depth = 0,
    excludeId?: string
  ): { id: string; label: string; depth: number }[] => {
    const options: { id: string; label: string; depth: number }[] = [];
    for (const node of nodes) {
      if (node.id === excludeId) continue;
      options.push({ id: node.id, label: node.name, depth });
      if (node.children.length > 0) {
        options.push(...getMenuOptions(node.children, depth + 1, excludeId));
      }
    }
    return options;
  };

  const parentOptions = editingMenu
    ? getMenuOptions(menus, 0, editingMenu.id)
    : getMenuOptions(menus);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">菜单管理</h1>
          <p className="text-sm text-gray-500 mt-1">管理系统导航菜单</p>
        </div>
        <Button onClick={() => openCreate()}>
          <Plus className="size-4 mr-1" />
          新增菜单
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingMenu ? "编辑菜单" : "新增菜单"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label>菜单名称</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="如：首页"
                />
              </div>
              <div className="space-y-2">
                <Label>路径</Label>
                <Input
                  value={form.path}
                  onChange={(e) => setForm({ ...form, path: e.target.value })}
                  placeholder="如：/dashboard"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>图标 (lucide)</Label>
                  <Input
                    value={form.icon}
                    onChange={(e) =>
                      setForm({ ...form, icon: e.target.value })
                    }
                    placeholder="如：Home"
                  />
                </div>
                <div className="space-y-2">
                  <Label>排序</Label>
                  <Input
                    type="number"
                    value={form.sort}
                    onChange={(e) =>
                      setForm({ ...form, sort: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>父级菜单</Label>
                <Select
                  value={form.parentId}
                  onValueChange={(v: string | null) => setForm({ ...form, parentId: v || "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="顶级菜单" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">顶级菜单</SelectItem>
                    {parentOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {"　".repeat(opt.depth)}
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>权限编码</Label>
                <Input
                  value={form.permissionCode}
                  onChange={(e) =>
                    setForm({ ...form, permissionCode: e.target.value })
                  }
                  placeholder="如：menu:users:view"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>显示菜单</Label>
                <Switch
                  checked={form.isVisible}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, isVisible: checked })
                  }
                />
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
        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="size-6 animate-spin mx-auto text-gray-400" />
          </div>
        ) : flatTree.length === 0 ? (
          <div className="p-8 text-center text-gray-400">暂无菜单数据</div>
        ) : (
          <table className="w-full">
            <thead className="border-b bg-gray-50/50">
              <tr>
                <th className="text-left text-sm font-medium text-gray-500 px-4 py-3">
                  菜单名称
                </th>
                <th className="text-left text-sm font-medium text-gray-500 px-4 py-3">
                  路径
                </th>
                <th className="text-left text-sm font-medium text-gray-500 px-4 py-3">
                  排序
                </th>
                <th className="text-left text-sm font-medium text-gray-500 px-4 py-3">
                  可见性
                </th>
                <th className="text-right text-sm font-medium text-gray-500 px-4 py-3">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {flatTree.map((menu) => (
                <tr key={menu.id} className="border-b hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div
                      className="flex items-center gap-1"
                      style={{ paddingLeft: `${menu.depth * 24}px` }}
                    >
                      {menu.children.length > 0 && (
                        <button
                          onClick={() => toggleExpand(menu.id)}
                          className="p-0.5 hover:bg-gray-200 rounded"
                        >
                          <ChevronRight
                            className={`size-4 text-gray-400 transition-transform ${
                              expanded.has(menu.id) ? "rotate-90" : ""
                            }`}
                          />
                        </button>
                      )}
                      {menu.children.length === 0 && (
                        <span className="w-5" />
                      )}
                      <MenuIcon className="size-4 text-gray-400" />
                      <span className="text-sm font-medium">{menu.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-500">
                    {menu.path || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {menu.sort}
                  </td>
                  <td className="px-4 py-3">
                    {menu.isVisible ? (
                      <Badge variant="default" className="bg-green-500">
                        <Eye className="size-3 mr-0.5" />
                        显示
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <EyeOff className="size-3 mr-0.5" />
                        隐藏
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openCreate(menu.id)}
                        title="添加子菜单"
                      >
                        <Plus className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(menu)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => {
                          setDeleteId(menu.id);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            确定要删除该菜单吗？子菜单也将被删除。
          </p>
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
