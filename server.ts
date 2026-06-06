import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { User, UserRole, UserStatus, Order, OrderItem } from "./src/types";

const ORDERS_FILE = path.join(process.cwd(), "orders-db.json");

function getInitialOrders(): Order[] {
  const dates = [
    new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // today
  ];

  return [
    {
      id: "ord-1",
      items: [
        { id: "itm-1", name: "★独家手作★ 耶加雪菲 · 阳光日晒", price: 38, size: "大杯的大口满足 (Large)", sugar: "三分糖 (微甜微醇)", milk: "香浓冰鲜牛奶", temp: "少冰 (少冰爽口)", notes: "请附打包纸架", img: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=687&auto=format&fit=crop" },
        { id: "itm-2", name: "法式手作重乳酪芝士", price: 30, size: "例份", sugar: "半糖 (半糖恰到合适)", milk: "香浓冰鲜牛奶", temp: "常温状态", notes: "", img: "https://images.unsplash.com/photo-1508737027454-e6454ef45afd?q=80&w=734&auto=format&fit=crop" }
      ],
      totalPrice: 68,
      orderTime: dates[0],
      buyerName: "爱丽丝",
      buyerUsername: "alice",
      type: "dine-in"
    },
    {
      id: "ord-2",
      items: [
        { id: "itm-3", name: "香醇生椰乳拿铁", price: 24, size: "大杯的大口满足 (Large)", sugar: "半糖 (半糖恰到合适)", milk: "生椰厚醇乳 (椰丝清香)", temp: "常温状态", notes: "多去冰", img: "https://images.unsplash.com/photo-1541167760496-1628856ab772?q=80&w=687&auto=format&fit=crop" },
        { id: "itm-4", name: "京都静冈宇治抹茶慕斯", price: 28, size: "例份", sugar: "半糖 (半糖恰到合适)", milk: "香浓冰鲜牛奶", temp: "标准温饮", notes: "", img: "https://images.unsplash.com/photo-1579372786545-d24232daf58c?q=80&w=735&auto=format&fit=crop" }
      ],
      totalPrice: 52,
      orderTime: dates[1],
      buyerName: "鲍勃",
      buyerUsername: "bob",
      type: "take-away"
    },
    {
      id: "ord-3",
      items: [
        { id: "itm-5", name: "冰燕麦拿铁 · 低卡臻选", price: 28, size: "超大杯的饱满爽口 (Venti)", sugar: "三分糖 (微甜微醇)", milk: "低脂燕麦奶 (谷物浓郁)", temp: "少冰 (少冰爽口)", notes: "燕麦奶加量", img: "https://images.unsplash.com/photo-1497515114629-f71d768fd07c?q=80&w=684&auto=format&fit=crop" }
      ],
      totalPrice: 28,
      orderTime: dates[2],
      buyerName: "莫奈的调色盘",
      buyerUsername: "guest",
      type: "dine-in"
    },
    {
      id: "ord-4",
      items: [
        { id: "itm-6", name: "★独家手作★ 瑰夏之梦 · 大堂殿堂极配", price: 78, size: "大杯的大口满足 (Large)", sugar: "天然零蔗木糖纯素 (0%)", milk: "不含乳产品 (黑美式)", temp: "标准热饮 (最醇厚香气)", notes: "手冲精心冲滤", img: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=687&auto=format&fit=crop" },
        { id: "itm-7", name: "法式手作重乳酪芝士", price: 30, size: "例份", sugar: "半糖 (半糖恰到合适)", milk: "香浓冰鲜牛奶", temp: "常温状态", notes: "", img: "https://images.unsplash.com/photo-1508737027454-e6454ef45afd?q=80&w=734&auto=format&fit=crop" }
      ],
      totalPrice: 108,
      orderTime: dates[3],
      buyerName: "微风过境",
      buyerUsername: "guest",
      type: "dine-in"
    },
    {
      id: "ord-5",
      items: [
        { id: "itm-8", name: "经典美式咖啡 · 意式原豆", price: 18, size: "中杯的轻盈体验 (Medium)", sugar: "天然零蔗木糖纯素 (0%)", milk: "不含乳产品 (黑美式)", temp: "常温状态", notes: "常温不加糖", img: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=687&auto=format&fit=crop" }
      ],
      totalPrice: 18,
      orderTime: dates[4],
      buyerName: "不加糖的日常",
      buyerUsername: "guest",
      type: "take-away"
    },
    {
      id: "ord-6",
      items: [
        { id: "itm-9", name: "悠然专属特调 · 雨林瑰夏", price: 42, size: "大杯的大口满足 (Large)", sugar: "三分糖 (微甜微醇)", milk: "生椰厚醇乳 (椰丝清香)", temp: "标准热饮 (最醇厚香气)", notes: "请准备两副吸贴和防护盒", img: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=687&auto=format&fit=crop" }
      ],
      totalPrice: 42,
      orderTime: dates[5],
      buyerName: "独立开发者小陈",
      buyerUsername: "guest",
      type: "dine-in"
    }
  ];
}

function readOrders(): Order[] {
  if (!fs.existsSync(ORDERS_FILE)) {
    const list = getInitialOrders();
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(list, null, 2), "utf8");
    return list;
  }
  try {
    const raw = fs.readFileSync(ORDERS_FILE, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    console.error("Error reading orders db:", e);
    return getInitialOrders();
  }
}

function writeOrders(orders: Order[]): void {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), "utf8");
}


const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "users-db.json");

app.use(express.json());

// Simple custom interface extending express Request for typing req.user
interface AuthenticatedRequest extends express.Request {
  user?: User;
}

// Ensure database file exists and is pre-seeded
interface StoredUser extends User {
  passwordHash: string;
  salt: string;
}

function hashPassword(password: string, salt: string): string {
  return crypto.createHash("sha256").update(password + salt).digest("hex");
}

function getInitialUsers(): StoredUser[] {
  const users: StoredUser[] = [];
  
  // Seed admin
  const adminSalt = crypto.randomBytes(16).toString("hex");
  users.push({
    id: "admin-id-1",
    username: "admin",
    name: "系统管理员",
    email: "admin@example.com",
    role: "admin",
    status: "active",
    bio: "系统最高管理员，拥有全部权属和CRUD编辑功能。",
    createdAt: new Date().toISOString(),
    salt: adminSalt,
    passwordHash: hashPassword("adminpassword", adminSalt)
  });

  // Seed user 1
  const aliceSalt = crypto.randomBytes(16).toString("hex");
  users.push({
    id: "user-id-alice",
    username: "alice",
    name: "爱丽丝",
    email: "alice@example.com",
    role: "user",
    status: "active",
    bio: "手冲咖啡发烧友，极简主义界面设计师。",
    createdAt: new Date().toISOString(),
    salt: aliceSalt,
    passwordHash: hashPassword("password123", aliceSalt)
  });

  // Seed user 2
  const bobSalt = crypto.randomBytes(16).toString("hex");
  users.push({
    id: "user-id-bob",
    username: "bob",
    name: "鲍勃",
    email: "bob@example.com",
    role: "user",
    status: "active",
    bio: "专注于React和Node.js之全栈资深发烧友。",
    createdAt: new Date().toISOString(),
    salt: bobSalt,
    passwordHash: hashPassword("password123", bobSalt)
  });

  return users;
}

function readUsers(): StoredUser[] {
  if (!fs.existsSync(DB_FILE)) {
    const list = getInitialUsers();
    fs.writeFileSync(DB_FILE, JSON.stringify(list, null, 2), "utf8");
    return list;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    console.error("Error reading users db:", e);
    return getInitialUsers();
  }
}

function writeUsers(users: StoredUser[]): void {
  fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2), "utf8");
}

// In-memory active sessions mapping: token -> User
const activeSessions = new Map<string, User>();

// Helper to clean User payload for sending to browser (exclude password hash and salt)
function formatUser(stored: StoredUser): User {
  const { passwordHash, salt, ...rest } = stored;
  return rest;
}

// Authentication middleware
const authMiddleware = (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction): void => {
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

  // Refresh user state from database to ensure up-to-date role/status/metadata
  const dbUsers = readUsers();
  const freshUser = dbUsers.find(u => u.id === user.id);
  
  if (!freshUser) {
    res.status(401).json({ success: false, error: "用户账户不存在" });
    return;
  }

  if (freshUser.status === "suspended") {
    res.status(403).json({ success: false, error: "您的账户已被禁用，无法进行此操作" });
    return;
  }

  req.user = formatUser(freshUser);
  next();
};

// Admin middleware - runs after authMiddleware
const adminMiddleware = (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction): void => {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ success: false, error: "权限不足，此操作仅允许管理员执行" });
    return;
  }
  next();
};

// ==================== User Authentication Endpoints ====================

// Register
app.post("/api/auth/register", (req, res) => {
  const { username, password, name, email, bio } = req.body;

  if (!username || !password || !name || !email) {
    res.status(400).json({ success: false, error: "请填写用户名、密码、昵称和邮箱" });
    return;
  }

  const users = readUsers();
  const existingByUsername = users.some(u => u.username.toLowerCase() === username.toLowerCase());
  if (existingByUsername) {
    res.status(400).json({ success: false, error: "此用户名已被注册" });
    return;
  }

  const existingByEmail = users.some(u => u.email.toLowerCase() === email.toLowerCase());
  if (existingByEmail) {
    res.status(400).json({ success: false, error: "此邮箱已被注册" });
    return;
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const newUser: StoredUser = {
    id: "user-id-" + crypto.randomBytes(8).toString("hex"),
    username,
    name,
    email,
    role: "user", // Registration always seeds standard 'user'
    status: "active",
    bio: bio || "",
    createdAt: new Date().toISOString(),
    salt,
    passwordHash: hashPassword(password, salt)
  };

  users.push(newUser);
  writeUsers(users);

  res.json({
    success: true,
    message: "注册成功！请使用您的凭据登录",
    data: formatUser(newUser)
  });
});

// Login
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ success: false, error: "请输入用户名和密码" });
    return;
  }

  const users = readUsers();
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());

  if (!user) {
    res.status(400).json({ success: false, error: "用户名或密码错误" });
    return;
  }

  if (user.status === "suspended") {
    res.status(403).json({ success: false, error: "您的账户已被禁用，请联系管理员" });
    return;
  }

  const hashedIn = hashPassword(password, user.salt);
  if (hashedIn !== user.passwordHash) {
    res.status(400).json({ success: false, error: "用户名或密码错误" });
    return;
  }

  // Create token
  const token = "auth-token-" + crypto.randomBytes(16).toString("hex");
  const formatted = formatUser(user);
  activeSessions.set(token, formatted);

  res.json({
    success: true,
    message: "登录成功",
    data: {
      token,
      user: formatted
    }
  });
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
app.put("/api/auth/profile", authMiddleware, (req: AuthenticatedRequest, res) => {
  const { name, email, bio } = req.body;
  if (!name || !email) {
    res.status(400).json({ success: false, error: "名字/昵称与电子邮箱不可为空" });
    return;
  }

  const users = readUsers();
  const userIdx = users.findIndex(u => u.id === req.user?.id);
  if (userIdx === -1) {
    res.status(404).json({ success: false, error: "当前用户未找到" });
    return;
  }

  // Check email redundancy against other accounts
  const emailTaken = users.some(u => u.id !== req.user?.id && u.email.toLowerCase() === email.toLowerCase());
  if (emailTaken) {
    res.status(400).json({ success: false, error: "此电子邮箱已被其他账户占用" });
    return;
  }

  users[userIdx].name = name;
  users[userIdx].email = email;
  users[userIdx].bio = bio || "";

  writeUsers(users);

  res.json({
    success: true,
    message: "个人资料更新成功！",
    data: formatUser(users[userIdx])
  });
});


// ==================== Administrator CRUD Operations ====================

// List users [Retrieve]
app.get("/api/admin/users", authMiddleware, adminMiddleware, (req, res) => {
  const users = readUsers();
  // Return formatted safe user items to the administration dashboard
  const userList = users.map(u => formatUser(u));
  res.json({
    success: true,
    data: userList
  });
});

// Get single user details [Retrieve]
app.get("/api/admin/users/:id", authMiddleware, adminMiddleware, (req, res) => {
  const users = readUsers();
  const targetUser = users.find(u => u.id === req.params.id);
  if (!targetUser) {
    res.status(404).json({ success: false, error: "指定的用户条目不存在" });
    return;
  }
  res.json({
    success: true,
    data: formatUser(targetUser)
  });
});

// Add new user [Create]
app.post("/api/admin/users", authMiddleware, adminMiddleware, (req, res) => {
  const { username, password, name, email, role, status, bio } = req.body;

  if (!username || !password || !name || !email || !role || !status) {
    res.status(400).json({ success: false, error: "请完整填写用户名、密码、昵称、邮箱、身份和状态" });
    return;
  }

  const users = readUsers();
  const existingByUsername = users.some(u => u.username.toLowerCase() === username.toLowerCase());
  if (existingByUsername) {
    res.status(400).json({ success: false, error: "此用户名已被注册" });
    return;
  }

  const existingByEmail = users.some(u => u.email.toLowerCase() === email.toLowerCase());
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

  users.push(newUser);
  writeUsers(users);

  res.json({
    success: true,
    message: "管理员成功添加新用户！",
    data: formatUser(newUser)
  });
});

// Edit user [Update]
app.put("/api/admin/users/:id", authMiddleware, adminMiddleware, (req, res) => {
  const { name, email, role, status, bio, password } = req.body;
  if (!name || !email || !role || !status) {
    res.status(400).json({ success: false, error: "请完整填写昵称、邮箱、身份和状态" });
    return;
  }

  const users = readUsers();
  const userIdx = users.findIndex(u => u.id === req.params.id);

  if (userIdx === -1) {
    res.status(404).json({ success: false, error: "欲编辑的用户未找到" });
    return;
  }

  // Prevent email duplicates
  const emailTaken = users.some(u => u.id !== req.params.id && u.email.toLowerCase() === email.toLowerCase());
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

  users[userIdx].name = name;
  users[userIdx].email = email;
  users[userIdx].role = role as UserRole;
  users[userIdx].status = status as UserStatus;
  users[userIdx].bio = bio || "";

  // Optional password update
  if (password && password.trim() !== "") {
    const salt = crypto.randomBytes(16).toString("hex");
    users[userIdx].salt = salt;
    users[userIdx].passwordHash = hashPassword(password, salt);
  }

  writeUsers(users);

  res.json({
    success: true,
    message: "账户数据成功修改！",
    data: formatUser(users[userIdx])
  });
});

// Delete user [Delete]
app.delete("/api/admin/users/:id", authMiddleware, adminMiddleware, (req, res) => {
  const users = readUsers();
  const userIdx = users.findIndex(u => u.id === req.params.id);

  if (userIdx === -1) {
    res.status(404).json({ success: false, error: "欲删除的用户未找到" });
    return;
  }

  // Prevent admin from deleting themselves
  if (req.params.id === (req as any).user?.id) {
    res.status(400).json({ success: false, error: "您无法删除自己当前的登录管理员账户" });
    return;
  }

  const deletedUser = users[userIdx];
  users.splice(userIdx, 1);
  writeUsers(users);

  res.json({
    success: true,
    message: `成功删除用户：${deletedUser.username}`
  });
});


// ==================== Order Transaction Endpoints ====================

// Submit and Pay Checkout
app.post("/api/orders/checkout", (req, res) => {
  const { items, totalPrice, buyerName, buyerUsername, type } = req.body;

  if (!items || !totalPrice || !buyerName || !type) {
    res.status(400).json({ success: false, error: "提单失败：遗漏了必要的产品信息、总价或配送形式" });
    return;
  }

  const orders = readOrders();
  const newOrder: Order = {
    id: "ord-new-" + crypto.randomBytes(8).toString("hex"),
    items: items.map((itm: any, idx: number) => ({
      id: itm.id || `itm-new-${idx}-${crypto.randomBytes(4).toString("hex")}`,
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

  orders.push(newOrder);
  writeOrders(orders);

  res.json({
    success: true,
    message: "🎉 订单支付且提单成功！我们的大堂工匠已开始为您称量豆粉手工调制风味。",
    data: newOrder
  });
});

// Admin view sales
app.get("/api/admin/sales", authMiddleware, adminMiddleware, (req, res) => {
  const orders = readOrders();
  res.json({
    success: true,
    data: orders
  });
});


// ==================== Dev Setup & Asset Hosting ====================

async function startServer() {
  // Vite dev server mounting in non-production mode
  if (process.env.NODE_ENV !== "production") {
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
