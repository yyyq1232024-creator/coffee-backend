import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import crypto from "crypto";
import fs from "fs/promises";
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
  StoredUser,
  getAllPrintJobs,
  insertPrintJob,
  updatePrintJobStatus,
  clearPrintJobs,
  deletePrintJob,
  cleanupExpiredPrintJobs
} from "./src/db.ts";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// ==================== Shared Server Print Queue Models ====================
// PrintJob interface is imported from types.ts. Print queue is now persisted in the JSON database.

// ==================== Pseudo-Static User Page Generator ====================
async function generatePseudoStaticUser(
  username: string,
  name: string,
  email: string,
  bio: string | undefined,
  role: string,
  createdAt: string
) {
  try {
    // Generate physical static-like files inside public/users and public/static-users
    const staticDir = path.join(process.cwd(), "public", "users");
    const jsonDir = path.join(process.cwd(), "public", "static-users");
    
    await fs.mkdir(staticDir, { recursive: true });
    await fs.mkdir(jsonDir, { recursive: true });
    
    const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>悠然咖啡馆 - 会员尊享风味静态凭证 (@${username})</title>
    <style>
        body {
            font-family: 'SF Pro Display', -apple-system, 'Helvetica Neue', 'PingFang SC', sans-serif;
            background: #F5EFEB;
            color: #3C2F2F;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
        }
        .card {
            background: white;
            border-radius: 24px;
            box-shadow: 0 10px 30px rgba(92, 58, 33, 0.08);
            border: 1px solid rgba(168, 140, 116, 0.2);
            width: 100%;
            max-width: 420px;
            overflow: hidden;
            text-align: center;
        }
        .header {
            background: linear-gradient(135deg, #5C3A21, #2D1A12);
            color: #FAF9F5;
            padding: 30px 20px;
        }
        .logo {
            font-size: 28px;
            margin-bottom: 5px;
        }
        .title {
            font-size: 18px;
            font-weight: 700;
            letter-spacing: 0.1em;
            margin: 0;
        }
        .subtitle {
            font-size: 10px;
            opacity: 0.7;
            text-transform: uppercase;
            letter-spacing: 0.15em;
            margin-top: 5px;
        }
        .avatar-container {
            margin-top: -35px;
            display: flex;
            justify-content: center;
        }
        .avatar {
            width: 70px;
            height: 70px;
            background: #FAF9F5;
            border-radius: 50%;
            border: 4px solid white;
            box-shadow: 0 4px 10px rgba(0,0,0,0.1);
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 32px;
        }
        .content {
            padding: 24px;
        }
        .name {
            font-size: 20px;
            font-weight: 700;
            margin: 10px 0 5px 0;
            color: #5C3A21;
        }
        .username {
            font-size: 12px;
            color: #A88C74;
            margin: 0 0 15px 0;
            font-family: monospace;
        }
        .info-grid {
            border-top: 1px dashed rgba(168, 140, 116, 0.2);
            border-bottom: 1px dashed rgba(168, 140, 116, 0.2);
            padding: 15px 0;
            margin: 15px 0;
            text-align: left;
            font-size: 12px;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
        }
        .info-row:last-child {
            margin-bottom: 0;
        }
        .info-label {
            color: #8C7B72;
        }
        .info-value {
            font-weight: 600;
        }
        .bio-box {
            background: #FAF9F5;
            border-radius: 12px;
            padding: 12px;
            font-size: 11px;
            color: #6B5B52;
            line-height: 1.5;
            font-style: italic;
            text-align: left;
        }
        .footer {
            background: #FAF9F5;
            padding: 15px;
            font-size: 10px;
            color: #A88C74;
            border-top: 1px solid rgba(168, 140, 116, 0.15);
        }
        .badge {
            display: inline-block;
            background: #EADECE;
            color: #5C3A21;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 10px;
            font-weight: bold;
            margin-top: 5px;
        }
        .back-btn {
            display: inline-block;
            margin-top: 15px;
            text-decoration: none;
            color: #8B5A2B;
            font-size: 11px;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="header">
            <div class="logo">☕</div>
            <h1 class="title">悠然咖啡馆</h1>
            <div class="subtitle">Leisurely Coffee Club Member</div>
        </div>
        <div class="avatar-container">
            <div class="avatar">👤</div>
        </div>
        <div class="content">
            <div class="name">${name}</div>
            <div class="username">@${username}</div>
            <span class="badge">${role === 'admin' ? '👑 大堂最高主理人' : '✨ 纯新手作茶点品鉴官'}</span>
            
            <div class="info-grid">
                <div class="info-row">
                    <span class="info-label">绑定邮箱:</span>
                    <span class="info-value">${email}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">入会时间:</span>
                    <span class="info-value">${new Date(createdAt).toLocaleDateString('zh-CN')}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">凭证状态:</span>
                    <span class="info-value" style="color: #2e7d32; font-weight: bold;">● 伪静态实体快照已生成</span>
                </div>
            </div>
            
            <div class="bio-box">
                "${bio || '此品鉴官非常低调，未留下大堂寄语。'}"
            </div>
            
            <a href="/" class="back-btn">← 返回悠然大堂主页</a>
        </div>
        <div class="footer">
            悠然咖啡馆 · 尊享会员专属风味空间版权所有
        </div>
    </div>
</body>
</html>`;

    // Save physical static files
    await fs.writeFile(path.join(staticDir, `${username}.html`), htmlContent, "utf-8");
    await fs.writeFile(
      path.join(jsonDir, `${username}.json`), 
      JSON.stringify({ username, name, email, bio, role, createdAt, staticCacheTime: new Date().toISOString() }, null, 2),
      "utf-8"
    );
    console.log(`[Pseudo-Static Engine] Cached user static snapshot: ${username}.html`);
  } catch (err) {
    console.error(`[Pseudo-Static Engine] Failed to generate snapshot for ${username}:`, err);
  }
}

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
  console.log("📥 [API] 收到注册请求, 请求体:", req.body);
  const { username, password, name, email, bio } = req.body;

  if (!username || !password || !name || !email) {
    console.log("⚠️ [API] 注册失败: 必填字段缺失", { username, name, email, hasPassword: !!password });
    res.status(400).json({ success: false, error: "请填写用户名、密码、昵称和邮箱" });
    return;
  }

  try {
    console.log("🔍 [API] 检查用户名是否已被注册:", username);
    const existingByUsername = await getStoredUserByUsername(username);
    if (existingByUsername) {
      console.log("⚠️ [API] 注册失败: 用户名已被注册:", username);
      res.status(400).json({ success: false, error: "此用户名已被注册" });
      return;
    }

    console.log("🔍 [API] 检查邮箱是否已被注册:", email);
    const existingByEmail = await getStoredUserByEmail(email);
    if (existingByEmail) {
      console.log("⚠️ [API] 注册失败: 邮箱已被注册:", email);
      res.status(400).json({ success: false, error: "此邮箱已被注册" });
      return;
    }

    console.log("🔑 [API] 生成密码哈希和 Salt...");
    const salt = crypto.randomBytes(16).toString("hex");
    const newUser: StoredUser = {
      id: "user-id-" + crypto.randomBytes(8).toString("hex"),
      username,
      name,
      email,
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

    // Generate pseudo-static cache page
    await generatePseudoStaticUser(newUser.username, newUser.name, newUser.email, newUser.bio, newUser.role, newUser.createdAt);

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
  console.log("📥 [API] 收到登录请求, 用户名:", req.body?.username);
  const { username, password } = req.body;

  if (!username || !password) {
    console.log("⚠️ [API] 登录失败: 用户名或密码缺失");
    res.status(400).json({ success: false, error: "请输入用户名和密码" });
    return;
  }

  try {
    console.log("🔍 [API] 查询用户记录:", username);
    const user = await getStoredUserByUsername(username);

    if (!user) {
      console.log("⚠️ [API] 登录失败: 用户不存在:", username);
      res.status(400).json({ success: false, error: "用户名或密码错误" });
      return;
    }

    if (user.status === "suspended") {
      console.log("⚠️ [API] 登录失败: 账户已被禁用:", username);
      res.status(403).json({ success: false, error: "您的账户已被禁用，请联系管理员" });
      return;
    }

    console.log("🔑 [API] 校验密码哈希...");
    const hashedIn = hashPassword(password, user.salt);
    if (hashedIn !== user.passwordHash) {
      console.log("⚠️ [API] 登录失败: 密码不匹配:", username);
      res.status(400).json({ success: false, error: "用户名或密码错误" });
      return;
    }

    // Create token
    const token = "auth-token-" + crypto.randomBytes(16).toString("hex");
    const { salt, passwordHash, ...formatted } = user;
    activeSessions.set(token, formatted);
    console.log("🎉 [API] 用户登录成功, Token已分发:", username);

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
    if (freshUser) {
      await generatePseudoStaticUser(freshUser.username, freshUser.name, freshUser.email, freshUser.bio, freshUser.role, freshUser.createdAt);
    }

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

    // Generate pseudo-static snapshot
    await generatePseudoStaticUser(newUser.username, newUser.name, newUser.email, newUser.bio, newUser.role, newUser.createdAt);

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
    if (freshUser) {
      await generatePseudoStaticUser(freshUser.username, freshUser.name, freshUser.email, freshUser.bio || "", freshUser.role, freshUser.createdAt);
    }

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
app.post("/api/orders/checkout", async (req, res) => {
  const { items, totalPrice, buyerName, buyerUsername, type, jobId } = req.body;

  if (!items || !totalPrice || !buyerName || !type) {
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
      buyerName,
      buyerUsername: buyerUsername || "guest",
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
app.post("/api/print-jobs", async (req, res) => {
  const { jobId, orderId, items, totalPrice, buyerName, buyerUsername } = req.body;
  if (!items || items.length === 0 || !buyerName) {
    res.status(400).json({ success: false, error: "打印投递失败：缺少必要品项数据" });
    return;
  }

  const finalJobId = jobId || "PRT-" + Math.floor(1000 + Math.random() * 9000) + "-" + crypto.randomBytes(3).toString("hex").toUpperCase();

  try {
    const existingJobs = await getAllPrintJobs();
    const existing = existingJobs.find(j => j.id === finalJobId);
    if (existing) {
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
      orderId: orderId || null,
      buyerName,
      buyerUsername: buyerUsername || "guest",
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
      message: "🖨️ 打印任务成功添加！",
      data: newJob,
      printJobId: finalJobId
    });
  } catch (error) {
    console.error("Direct print-jobs submit error:", error);
    res.status(500).json({ success: false, error: "服务器保存打印任务失败" });
  }
});

// Submit any custom print task manually (e.g., printed directly from Wishlist draft card)
app.post("/api/print/submit", async (req, res) => {
  const { buyerName, buyerUsername, items, totalPrice } = req.body;
  if (!items || items.length === 0 || !buyerName) {
    res.status(400).json({ success: false, error: "打印投递失败：缺少必要品项数据" });
    return;
  }

  const newJob: PrintJob = {
    id: "PRT-" + Math.floor(1000 + Math.random() * 9000) + "-" + crypto.randomBytes(3).toString("hex").toUpperCase(),
    buyerName,
    buyerUsername: buyerUsername || "guest",
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
      message: "🖨️ 风味配方凭证成功投递至服务器打印队列（共享连接）！",
      data: newJob
    });
  } catch (error) {
    console.error("Manual print submit error:", error);
    res.status(500).json({ success: false, error: "服务器保存打印投递失败" });
  }
});

// Get current central print queue
app.get("/api/print/queue", async (req, res) => {
  try {
    const queue = await getAllPrintJobs();
    res.json({
      success: true,
      data: queue
    });
  } catch (error) {
    console.error("Fetch print queue error:", error);
    res.status(500).json({ success: false, error: "获取服务器打印队列失败" });
  }
});

// Execute physical-like print rolling sequence with authentication checks
app.post("/api/print/:id/execute", async (req, res) => {
  const { id } = req.params;
  const { myPrintJobIds = [] } = req.body;
  
  try {
    const jobs = await getAllPrintJobs();
    const job = jobs.find(j => j.id === id);
    if (!job) {
      res.status(404).json({ success: false, error: "未找到指定的服务器打印任务" });
      return;
    }

    // Authorization check
    let isAuthorized = false;

    // 1. Try to authenticate via Bearer token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const user = activeSessions.get(token);
      if (user) {
        try {
          const freshUser = await getUserById(user.id);
          if (freshUser) {
            if (freshUser.role === 'admin' || freshUser.username === job.buyerUsername) {
              isAuthorized = true;
            }
          }
        } catch (e) {
          console.error("Auth query in print execution failed:", e);
        }
      }
    }

    // 2. Fallback check for guest session using local IDs list
    if (!isAuthorized) {
      if (Array.isArray(myPrintJobIds) && myPrintJobIds.includes(id)) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      res.status(403).json({ 
        success: false, 
        error: "🔒 权限不足！您不能操作该打印任务。任务不属于您，且您当前不是大堂管理员身份。" 
      });
      return;
    }

    await updatePrintJobStatus(id, 'printing');
    console.log(`🖨️ [Server Printer] Printing job ${id} in progress...`);

    // Simulate server physical printing duration
    setTimeout(async () => {
      await updatePrintJobStatus(id, 'completed');
      console.log(`🖨️ [Server Printer] Printing job ${id} finished successfully.`);
    }, 2500);

    job.status = 'printing';

    res.json({
      success: true,
      message: "🖨️ 服务器打单动作已下发！打印机滚轴正在高速吐出纸质收据...",
      data: job
    });
  } catch (error) {
    console.error("Print execution error:", error);
    res.status(500).json({ success: false, error: "服务器执行打单指令失败" });
  }
});

// Delete/Remove a print job from the central queue (e.g. after customer printed and confirmed)
app.post("/api/print/:id/delete", async (req, res) => {
  const { id } = req.params;
  const { myPrintJobIds = [] } = req.body;

  try {
    const jobs = await getAllPrintJobs();
    const job = jobs.find(j => j.id === id);
    if (!job) {
      res.status(404).json({ success: false, error: "未找到指定的服务器打印任务" });
      return;
    }

    // Authorization check
    let isAuthorized = false;

    // 1. Try to authenticate via Bearer token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const user = activeSessions.get(token);
      if (user) {
        try {
          const freshUser = await getUserById(user.id);
          if (freshUser) {
            if (freshUser.role === 'admin' || freshUser.username === job.buyerUsername) {
              isAuthorized = true;
            }
          }
        } catch (e) {
          console.error("Auth query in print delete failed:", e);
        }
      }
    }

    // 2. Fallback check for guest session using local IDs list
    if (!isAuthorized) {
      if (Array.isArray(myPrintJobIds) && myPrintJobIds.includes(id)) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      res.status(403).json({ 
        success: false, 
        error: "🔒 权限不足！您不能删除该打印任务。" 
      });
      return;
    }

    await deletePrintJob(id);
    console.log(`🖨️ [Server Printer] Print job ${id} confirmed and deleted by user.`);
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
app.post("/api/print/clear", async (req, res) => {
  let isAdmin = false;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const user = activeSessions.get(token);
    if (user) {
      try {
        const freshUser = await getUserById(user.id);
        if (freshUser && freshUser.role === 'admin') {
          isAdmin = true;
        }
      } catch (e) {
        console.error("Auth check in print clear failed:", e);
      }
    }
  }

  if (!isAdmin) {
    res.status(403).json({ 
      success: false, 
      error: "🔒 权限不足！只有大堂系统管理员可以清空共享打印机的全部历史队列。" 
    });
    return;
  }

  try {
    await clearPrintJobs();
    console.log(`🖨️ [Server Printer] Print queue cleared by administrator.`);
    res.json({
      success: true,
      message: "🖨️ 服务器中央打印机队列已完成清空。"
    });
  } catch (error) {
    console.error("Clear print jobs error:", error);
    res.status(500).json({ success: false, error: "清空共享打印机队列失败" });
  }
});

// ==================== User Pseudo-Static Page Router ====================

app.get("/users/:username.html", async (req, res) => {
  const { username } = req.params;
  const filePath = path.join(process.cwd(), "public", "users", `${username}.html`);
  
  try {
    await fs.access(filePath);
    res.sendFile(filePath);
  } catch {
    try {
      const u = await getStoredUserByUsername(username);
      if (u) {
        await generatePseudoStaticUser(u.username, u.name, u.email, u.bio || "", u.role, u.createdAt);
        res.sendFile(filePath);
        return;
      }
    } catch (err) {
      console.error("Pseudo-static server compilation fallback failed:", err);
    }
    res.status(404).send(`
      <div style="font-family: sans-serif; text-align: center; padding: 50px; background: #FAF9F5; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; color: #5C3A21;">
        <h2>☕ 未找到该悠然咖啡客的静态风味档案卡</h2>
        <p style="color: #A88C74;">该用户可能尚未在大堂中注册。请先注册一个账户，伪静态文件会自动实时生成并供本服务器离线分发。</p>
        <a href="/" style="color: #8B5A2B; font-weight: bold; text-decoration: none; margin-top: 20px; border: 1px solid #8B5A2B; padding: 8px 16px; border-radius: 8px;">返回大堂</a>
      </div>
    `);
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

  // Pre-generate pseudo-static HTML and JSON profile caches for all users currently in DB
  try {
    const allUsers = await getAllUsers();
    console.log(`🌱 [Startup Pseudo-Static Engine] Pre-generating HTML snapshots for ${allUsers.length} users...`);
    for (const u of allUsers) {
      await generatePseudoStaticUser(u.username, u.name, u.email, u.bio || "", u.role, u.createdAt);
    }
  } catch (err) {
    console.error("⚠️ [Startup Pseudo-Static Engine] Failed to pre-generate snapshots:", err);
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

  // Periodically clean up expired pending print jobs (older than 5 minutes) every 30 seconds
  setInterval(async () => {
    try {
      await cleanupExpiredPrintJobs();
    } catch (err) {
      console.error("Background print job cleanup interval error:", err);
    }
  }, 30000);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[USER DB ADMIN SYSTEM] Server running on http://localhost:${PORT}`);
  });
}

startServer();
