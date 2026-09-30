import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import crypto from "crypto";
import { User, UserRole, UserStatus, Order, PrintJob } from "./src/types.ts";
import {
  initSqliteDb,
  getAllUsers,
  getRawUsers,
  getUserById,
  getStoredUserByUsername,
  getStoredUserByEmail,
  insertUser,
  updateUser,
  deleteUserById,
  getAllOrders,
  insertOrder,
  hashPassword,
  normalizeEmail,
  normalizeUsername,
  StoredUser,
  getAllPrintJobs,
  insertPrintJob,
  updatePrintJobStatus,
  clearPrintJobs,
  deletePrintJob,
} from "./src/db.ts";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// ==================== Shared Server Print Queue Models ====================
// PrintJob interface is imported from types.ts. Print queue is now persisted in the JSON database.

// Simple custom interface extending express Request for typing req.user
interface AuthenticatedRequest extends express.Request {
  user?: User;
}

// In-memory active sessions mapping: token -> User
const activeSessions = new Map<string, User>();

// Authentication middleware
const authMiddleware = async (
  req: AuthenticatedRequest,
  res: express.Response,
  next: express.NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: "未授权，请提供有效的登录凭证" });
    return;
  }

  const token = authHeader.substring(7);
  const user = activeSessions.get(token);
  
  if (!user) {
    res.status(401).json({ success: false, error: "登录凭证失效或已过期，请重新登录" });
    return;
  }

  try {
    // Refresh user state from database to ensure up-to-date role/status/metadata
    const freshUser = await getUserById(user.id);
    
    if (!freshUser) {
      res.status(401).json({ success: false, error: "用户账户不存在" });
      return;
    }

    if (freshUser.status === "suspended") {
      res.status(403).json({ success: false, error: "您的账户已被禁用，无法进行此操作" });
      return;
    }

    req.user = freshUser;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ success: false, error: "身份验证模块数据库查询失败" });
  }
};

// Admin middleware - runs after authMiddleware
const adminMiddleware = (
  req: AuthenticatedRequest,
  res: express.Response,
  next: express.NextFunction
): void => {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ success: false, error: "权限不足，此操作仅允许管理员执行" });
    return;
  }
  next();
};

// ==================== User Authentication Endpoints ====================

// Register
app.post("/api/auth/register", async (req, res) => {
  console.log("📥 [API] 收到注册请求");
  const { username, password, name, email, bio } = req.body;

  const normalizedUsername = typeof username === "string" ? normalizeUsername(username) : "";
  const normalizedEmail = typeof email === "string" ? normalizeEmail(email) : "";
  const normalizedName = typeof name === "string" ? name.trim() : "";

  if (!normalizedUsername || typeof password !== "string" || !normalizedName || !normalizedEmail) {
    console.log("⚠️ [API] 注册失败: 必填字段缺失");
    res.status(400).json({ success: false, error: "请填写用户名、密码、昵称和邮箱" });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ success: false, error: "密码长度应不少于6位" });
    return;
  }

  try {
    console.log("🔍 [API] 检查用户名是否已被注册:", normalizedUsername);
    const existingByUsername = await getStoredUserByUsername(normalizedUsername);
    if (existingByUsername) {
      console.log("⚠️ [API] 注册失败: 用户名已被注册:", username);
      res.status(400).json({ success: false, error: "此用户名已被注册" });
      return;
    }

    console.log("🔍 [API] 检查邮箱是否已被注册:", normalizedEmail);
    const existingByEmail = await getStoredUserByEmail(normalizedEmail);
    if (existingByEmail) {
      console.log("⚠️ [API] 注册失败: 邮箱已被注册:", email);
      res.status(400).json({ success: false, error: "此邮箱已被注册" });
      return;
    }

    console.log("🔑 [API] 生成密码哈希和 Salt...");
    const salt = crypto.randomBytes(16).toString("hex");
    const newUser: StoredUser = {
      id: "user-id-" + crypto.randomBytes(8).toString("hex"),
      username: normalizedUsername,
      name: normalizedName,
      email: normalizedEmail,
      role: "user",
      status: "active",
      bio: bio || "",
      createdAt: new Date().toISOString(),
      salt,
      passwordHash: hashPassword(password, salt)
    };

    console.log("💾 [API] 正在向数据库写入新用户:", newUser.id);
    await insertUser(newUser);
    console.log("🎉 [API] 数据库用户写入成功!");

    const { salt: s, passwordHash: ph, ...safeUser } = newUser;
    res.json({
      success: true,
      message: "注册成功！请使用您的凭据登录",
      data: safeUser
    });
  } catch (error) {
    console.error("❌ [API] 注册接口异常, 错误详情:", error);
    res.status(500).json({ success: false, error: "注册失败，数据库写入异常" });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  console.log("📥 [API] 收到登录请求");
  const { username, password } = req.body;

  const identifier = typeof username === "string" ? username.trim().normalize("NFKC") : "";

  if (!identifier || typeof password !== "string" || password.length === 0) {
    console.log("⚠️ [API] 登录失败: 用户名或密码缺失");
    res.status(400).json({ success: false, error: "请输入用户名和密码" });
    return;
  }

  try {
    console.log("🔍 [API] 查询用户记录");
    const user = await getStoredUserByUsername(identifier) || await getStoredUserByEmail(identifier);

    if (!user) {
      console.log("⚠️ [API] 登录失败: 用户不存在");
      res.status(400).json({ success: false, error: "用户名或密码错误" });
      return;
    }

    if (user.status === "suspended") {
      console.log("⚠️ [API] 登录失败: 账户已被禁用:", username);
      res.status(403).json({ success: false, error: "您的账户已被禁用，请联系管理员" });
      return;
    }

    console.log("🔑 [API] 校验密码哈希...");
    const hashedIn = Buffer.from(hashPassword(password, user.salt), "hex");
    const storedHash = Buffer.from(user.passwordHash, "hex");
    const passwordMatches = hashedIn.length === storedHash.length && crypto.timingSafeEqual(hashedIn, storedHash);
    if (!passwordMatches) {
      console.log("⚠️ [API] 登录失败: 密码不匹配");
      res.status(400).json({ success: false, error: "用户名或密码错误" });
      return;
    }

    // Create token
    const token = "auth-token-" + crypto.randomBytes(16).toString("hex");
    const { salt, passwordHash, ...formatted } = user;
    activeSessions.set(token, formatted);
    console.log("🎉 [API] 用户登录成功, Token已分发:", user.username);

    res.json({
      success: true,
      message: "登录成功",
      data: {
        token,
        user: formatted
      }
    });
  } catch (error) {
    console.error("❌ [API] 登录接口异常, 错误详情:", error);
    res.status(500).json({ success: false, error: "登录失败，数据库查询异常" });
  }
});

// Logout
app.post("/api/auth/logout", (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    activeSessions.delete(token);
  }
  res.json({ success: true, message: "注销登录成功" });
});

// Get current user info
app.get("/api/auth/me", authMiddleware, (req: AuthenticatedRequest, res) => {
  res.json({
    success: true,
    data: req.user
  });
});

// Update current user profile
app.put("/api/auth/profile", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { name, email, bio } = req.body;
  if (!name || !email) {
    res.status(400).json({ success: false, error: "名字/昵称与电子邮箱不可为空" });
    return;
  }

  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "当前用户身份未登录" });
      return;
    }

    // Check email redundancy against other accounts
    const existingUser = await getStoredUserByEmail(email);
    if (existingUser && existingUser.id !== req.user.id) {
      res.status(400).json({ success: false, error: "此电子邮箱已被其他账户占用" });
      return;
    }

    await updateUser(req.user.id, { name, email, bio: bio || "" });
    const freshUser = await getUserById(req.user.id);

    res.json({
      success: true,
      message: "个人资料更新成功！",
      data: freshUser
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ success: false, error: "资料更新失败，数据库操作异常" });
  }
});

// ==================== Administrator CRUD Operations ====================

// List users [Retrieve]
app.get("/api/admin/users", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userList = await getAllUsers();
    res.json({
      success: true,
      data: userList
    });
  } catch (error) {
    console.error("Admin user list retrieve error:", error);
    res.status(500).json({ success: false, error: "获取用户列表数据失败" });
  }
});

// Get single user details [Retrieve]
app.get("/api/admin/users/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const targetUser = await getUserById(req.params.id);
    if (!targetUser) {
      res.status(404).json({ success: false, error: "指定的用户条目不存在" });
      return;
    }
    res.json({
      success: true,
      data: targetUser
    });
  } catch (error) {
    console.error("Admin user details retrieve error:", error);
    res.status(500).json({ success: false, error: "获取用户详情数据失败" });
  }
});

// Add new user [Create]
app.post("/api/admin/users", authMiddleware, adminMiddleware, async (req, res) => {
  const { username, password, name, email, role, status, bio } = req.body;

  if (!username || !password || !name || !email || !role || !status) {
    res.status(400).json({ success: false, error: "请完整填写用户名、密码、昵称、邮箱、身份和状态" });
    return;
  }

  try {
    const existingByUsername = await getStoredUserByUsername(username);
    if (existingByUsername) {
      res.status(400).json({ success: false, error: "此用户名已被注册" });
      return;
    }

    const existingByEmail = await getStoredUserByEmail(email);
    if (existingByEmail) {
      res.status(400).json({ success: false, error: "此电子邮箱已经被注册" });
      return;
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const newUser: StoredUser = {
      id: "user-id-" + crypto.randomBytes(8).toString("hex"),
      username,
      name,
      email,
      role: role as UserRole,
      status: status as UserStatus,
      bio: bio || "",
      createdAt: new Date().toISOString(),
      salt,
      passwordHash: hashPassword(password, salt)
    };

    await insertUser(newUser);

    const { salt: s, passwordHash: ph, ...safeUser } = newUser;
    res.json({
      success: true,
      message: "管理员成功添加新用户！",
      data: safeUser
    });
  } catch (error) {
    console.error("Admin user create error:", error);
    res.status(500).json({ success: false, error: "创建新用户记录失败" });
  }
});

// Edit user [Update]
app.put("/api/admin/users/:id", authMiddleware, adminMiddleware, async (req, res) => {
  const { name, email, role, status, bio, password } = req.body;
  if (!name || !email || !role || !status) {
    res.status(400).json({ success: false, error: "请完整填写昵称、邮箱、身份和状态" });
    return;
  }

  try {
    const rawUsers = await getRawUsers();
    const userIdx = rawUsers.findIndex(u => u.id === req.params.id);

    if (userIdx === -1) {
      res.status(404).json({ success: false, error: "欲编辑的用户未找到" });
      return;
    }

    // Prevent email duplicates
    const emailTaken = rawUsers.some(u => u.id !== req.params.id && u.email.toLowerCase() === email.toLowerCase());
    if (emailTaken) {
      res.status(400).json({ success: false, error: "此电子邮箱已经被其他账户占用" });
      return;
    }

    // If status is set to suspend, verify they are not suspending their own current admin profile
    if (status === "suspended" && req.params.id === (req as any).user?.id) {
      res.status(400).json({ success: false, error: "管理员无法禁用自己当前的登录账户" });
      return;
    }

    // If role is changing, prevent current logged-in user from striping their own admin privilege
    if (role !== "admin" && req.params.id === (req as any).user?.id) {
      res.status(400).json({ success: false, error: "管理员无法取消自己最高管理员的系统权限" });
      return;
    }

    const updates: Partial<StoredUser> = {
      name,
      email,
      role: role as UserRole,
      status: status as UserStatus,
      bio: bio || ""
    };

    // Optional password update
    if (password && password.trim() !== "") {
      const salt = crypto.randomBytes(16).toString("hex");
      updates.salt = salt;
      updates.passwordHash = hashPassword(password, salt);
    }

    await updateUser(req.params.id, updates);
    const freshUser = await getUserById(req.params.id);

    res.json({
      success: true,
      message: "账户数据成功修改！",
      data: freshUser
    });
  } catch (error) {
    console.error("Admin user update error:", error);
    res.status(500).json({ success: false, error: "更新账户数据数据库异常" });
  }
});

// Delete user [Delete]
app.delete("/api/admin/users/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const targetUser = await getUserById(req.params.id);

    if (!targetUser) {
      res.status(404).json({ success: false, error: "欲删除的用户未找到" });
      return;
    }

    // Prevent admin from deleting themselves
    if (req.params.id === (req as any).user?.id) {
      res.status(400).json({ success: false, error: "您无法删除自己当前的登录管理员账户" });
      return;
    }

    await deleteUserById(req.params.id);

    res.json({
      success: true,
      message: `成功删除用户：${targetUser.username}`
    });
  } catch (error) {
    console.error("Admin user delete error:", error);
    res.status(500).json({ success: false, error: "删除用户数据库操作失败" });
  }
});

// ==================== Order Transaction Endpoints ====================

// Submit and Pay Checkout
app.post("/api/orders/checkout", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { items, totalPrice, type, jobId } = req.body;

  if (!Array.isArray(items) || items.length === 0 || !totalPrice || !type || !req.user) {
    res.status(400).json({ success: false, error: "提单失败：遗漏了必要的产品信息、总价或配送形式" });
    return;
  }

  try {
    const newOrder: Order = {
      id: "ord-new-" + crypto.randomBytes(8).toString("hex"),
      items: items.map((itm: any, idx: number) => ({
        id: `itm-new-${idx}-${crypto.randomBytes(8).toString("hex")}`,
        name: itm.name,
        price: Number(itm.price),
        size: itm.size || "例份",
        sugar: itm.sugar || "正常糖",
        milk: itm.milk || "纯牛奶",
        temp: itm.temp || "常规温",
        notes: itm.notes || "",
        img: itm.img || ""
      })),
      totalPrice: Number(totalPrice),
      orderTime: new Date().toISOString(),
      buyerName: req.user.name,
      buyerUsername: req.user.username,
      type: type as 'dine-in' | 'take-away'
    };

    await insertOrder(newOrder);

    const printJobId = jobId || "PRT-" + Math.floor(1000 + Math.random() * 9000) + "-" + crypto.randomBytes(3).toString("hex").toUpperCase();

    res.json({
      success: true,
      message: "🎉 订单支付成功！已为您生成提单凭证。",
      data: newOrder,
      printJobId: printJobId
    });
  } catch (error) {
    console.error("Order checkout error:", error);
    res.status(500).json({ success: false, error: "提单支付流程遇到数据库写入错误" });
  }
});

// Admin view sales
app.get("/api/admin/sales", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const orders = await getAllOrders();
    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    console.error("Admin sales retrieval error:", error);
    res.status(500).json({ success: false, error: "获取订单销售记录异常" });
  }
});

// ==================== Shared Server-Side Printer Endpoints ====================

// Submit direct print job via /api/print-jobs
app.post("/api/print-jobs", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { jobId, orderId, items, totalPrice } = req.body;
  if (!Array.isArray(items) || items.length === 0 || !req.user) {
    res.status(400).json({ success: false, error: "打印投递失败：缺少必要品项数据" });
    return;
  }

  const finalJobId = jobId || "PRT-" + Math.floor(1000 + Math.random() * 9000) + "-" + crypto.randomBytes(3).toString("hex").toUpperCase();

  try {
    const existingJobs = await getAllPrintJobs();
    const existing = existingJobs.find(j => j.id === finalJobId);
    if (existing) {
      if (existing.ownerUserId !== req.user.id) {
        res.status(409).json({ success: false, error: "该出单编号已被占用，请重新提交" });
        return;
      }
      res.json({
        success: true,
        message: "🖨️ 打印任务已存在于队列中。",
        data: existing,
        printJobId: finalJobId
      });
      return;
    }

    const newJob: PrintJob = {
      id: finalJobId,
      orderId: orderId || undefined,
      ownerUserId: req.user.id,
      buyerName: req.user.name,
      buyerUsername: req.user.username,
      totalPrice: Number(totalPrice),
      items: items.map((itm: any) => ({
        name: itm.name,
        price: Number(itm.price),
        size: itm.size || "例份",
        sugar: itm.sugar || "正常糖",
        milk: itm.milk || "纯牛奶",
        temp: itm.temp || "常规温",
        notes: itm.notes || ""
      })),
      timestamp: new Date().toISOString(),
      status: 'pending'
    };

    await insertPrintJob(newJob);
    console.log(`🖨️ [Server Printer] Direct print-jobs task submitted: ${newJob.id}`);
    res.json({
      success: true,
      message: "出单任务已提交到吧台，等待店员处理。",
      data: newJob,
      printJobId: finalJobId
    });
  } catch (error) {
    console.error("Direct print-jobs submit error:", error);
    res.status(500).json({ success: false, error: "服务器保存打印任务失败" });
  }
});

// Submit any custom print task manually (e.g., printed directly from Wishlist draft card)
app.post("/api/print/submit", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { items, totalPrice } = req.body;
  if (!Array.isArray(items) || items.length === 0 || !req.user) {
    res.status(400).json({ success: false, error: "打印投递失败：缺少必要品项数据" });
    return;
  }

  const newJob: PrintJob = {
    id: "PRT-" + Math.floor(1000 + Math.random() * 9000) + "-" + crypto.randomBytes(3).toString("hex").toUpperCase(),
    ownerUserId: req.user.id,
    buyerName: req.user.name,
    buyerUsername: req.user.username,
    totalPrice: Number(totalPrice),
    items: items.map((itm: any) => ({
      name: itm.name,
      price: itm.price,
      size: itm.size || "大杯 (Large)",
      sugar: itm.sugar || "三分糖",
      milk: itm.milk || "香浓冰鲜牛奶",
      temp: itm.temp || "少冰",
      notes: itm.notes || ""
    })),
    timestamp: new Date().toISOString(),
    status: 'pending'
  };

  try {
    await insertPrintJob(newJob);
    console.log(`🖨️ [Server Printer] Manual print task submitted: ${newJob.id}`);
    res.json({
      success: true,
      message: "风味配方已提交到吧台出单队列。",
      data: newJob
    });
  } catch (error) {
    console.error("Manual print submit error:", error);
    res.status(500).json({ success: false, error: "服务器保存打印投递失败" });
  }
});

// Get current central print queue
app.get("/api/print/queue", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const queue = await getAllPrintJobs();
    const visibleQueue = req.user?.role === "admin"
      ? queue
      : queue.filter((job) => job.ownerUserId === req.user?.id);
    res.json({
      success: true,
      data: visibleQueue
    });
  } catch (error) {
    console.error("Fetch print queue error:", error);
    res.status(500).json({ success: false, error: "获取服务器打印队列失败" });
  }
});

// Execute physical-like print rolling sequence with authentication checks
app.post("/api/print/:id/execute", authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  
  try {
    const jobs = await getAllPrintJobs();
    const job = jobs.find(j => j.id === id);
    if (!job) {
      res.status(404).json({ success: false, error: "未找到指定的服务器打印任务" });
      return;
    }

    await updatePrintJobStatus(id, 'completed');
    console.log(`🧾 [Counter Queue] Job ${id} marked completed by administrator.`);
    job.status = 'completed';

    res.json({
      success: true,
      message: "该订单已由吧台确认完成。",
      data: job
    });
  } catch (error) {
    console.error("Print execution error:", error);
    res.status(500).json({ success: false, error: "服务器执行打单指令失败" });
  }
});

// Delete/Remove a print job from the central queue (e.g. after customer printed and confirmed)
app.post("/api/print/:id/delete", authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const jobs = await getAllPrintJobs();
    const job = jobs.find(j => j.id === id);
    if (!job) {
      res.status(404).json({ success: false, error: "未找到指定的服务器打印任务" });
      return;
    }

    await deletePrintJob(id);
    console.log(`🧾 [Counter Queue] Job ${id} deleted by administrator.`);
    res.json({
      success: true,
      message: "🖨️ 服务器打单任务已确认归档并移出队列。"
    });
  } catch (error) {
    console.error("Print delete error:", error);
    res.status(500).json({ success: false, error: "服务器删除打单任务失败" });
  }
});

// Clear printer queue - Admin only
app.post("/api/print/clear", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await clearPrintJobs();
    console.log(`🖨️ [Server Printer] Print queue cleared by administrator.`);
    res.json({
      success: true,
      message: "吧台出单记录已清空。"
    });
  } catch (error) {
    console.error("Clear print jobs error:", error);
    res.status(500).json({ success: false, error: "清空吧台出单记录失败" });
  }
});

// ==================== Dev Setup & Asset Hosting ====================

async function startServer() {
  // Initialize relational tables or local JSON database
  try {
    await initSqliteDb();
  } catch (error) {
    console.error("❌ Failed to initialize Database:", error);
  }

  // Vite dev server mounting in non-production mode
  const isProd = process.env.NODE_ENV === "production" || (typeof __filename !== "undefined" && (__filename.endsWith(".cjs") || __filename.includes("dist")));
  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static outputs
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[USER DB ADMIN SYSTEM] Server running on http://localhost:${PORT}`);
  });
}

startServer();
