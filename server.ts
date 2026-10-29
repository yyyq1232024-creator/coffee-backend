import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import crypto from "crypto";
import { User, UserRole, UserStatus, Order, PrintJob, WishlistItem } from "./src/types.ts";
import {
  initDatabase,
  getAllUsers,
  getRawUsers,
  getUserById,
  getUserBySessionToken,
  getStoredUserByUsername,
  getStoredUserByEmail,
  createUserSession,
  deleteUserSession,
  deleteUserSessionsByUserId,
  deleteExpiredUserSessions,
  touchUserSession,
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
  getMenuProducts,
  updateProductInventory,
  getWishlistByUserId,
  replaceWishlist,
  insertOrderWithInventory,
} from "./src/db.ts";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "1mb" }));

// ==================== Shared Server Print Queue Models ====================
// PrintJob interface is imported from types.ts. The queue is persisted in PostgreSQL.

// Simple custom interface extending express Request for typing req.user
interface AuthenticatedRequest extends express.Request {
  user?: User;
}

const SESSION_TTL_DAYS = Math.max(1, Number(process.env.SESSION_TTL_DAYS) || 30);
const assistantRateLimits = new Map<string, { count: number; resetAt: number }>();

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

  try {
    const token = authHeader.substring(7);
    const freshUser = await getUserBySessionToken(token);
    
    if (!freshUser) {
      res.status(401).json({ success: false, error: "登录凭证失效或已过期，请重新登录" });
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

    // Store only the token digest in PostgreSQL so a Render restart cannot end the session.
    const token = "auth-token-" + crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
    const { salt, passwordHash, ...formatted } = user;
    await deleteExpiredUserSessions();
    await createUserSession(token, user.id, expiresAt);
    console.log("🎉 [API] 用户登录成功, Token已分发:", user.username);

    res.json({
      success: true,
      message: "登录成功",
      data: {
        token,
        user: formatted,
        expiresAt: expiresAt.toISOString(),
      }
    });
  } catch (error) {
    console.error("❌ [API] 登录接口异常, 错误详情:", error);
    res.status(500).json({ success: false, error: "登录失败，数据库查询异常" });
  }
});

// Logout
app.post("/api/auth/logout", async (req, res) => {
  const authHeader = req.headers.authorization;
  try {
    if (authHeader && authHeader.startsWith("Bearer ")) {
      await deleteUserSession(authHeader.substring(7));
    }
    res.json({ success: true, message: "注销登录成功" });
  } catch (error) {
    console.error("Logout session cleanup error:", error);
    res.status(500).json({ success: false, error: "注销失败，请稍后重试" });
  }
});

// Get current user info
app.get("/api/auth/me", authMiddleware, (req: AuthenticatedRequest, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    void touchUserSession(authHeader.substring(7)).catch((error) => {
      console.error("Failed to update session last_seen_at:", error);
    });
  }
  res.json({
    success: true,
    data: req.user
  });
});

// Update current user profile
app.put("/api/auth/profile", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { name, email, bio, avatar } = req.body;
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

    const normalizedAvatar = typeof avatar === "string" ? avatar.trim() : "";
    if (
      normalizedAvatar &&
      (!/^data:image\/(?:jpeg|png|webp);base64,/i.test(normalizedAvatar) || normalizedAvatar.length > 350_000)
    ) {
      res.status(400).json({ success: false, error: "头像格式不受支持或文件过大，请重新选择图片" });
      return;
    }

    await updateUser(req.user.id, { name, email, bio: bio || "", avatar: normalizedAvatar });
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
    if ((password && password.trim() !== "") || status === "suspended") {
      await deleteUserSessionsByUserId(req.params.id);
    }
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

// ==================== Menu, Bean Origin & Wishlist Endpoints ====================

app.get("/api/products", async (_req, res) => {
  try {
    res.json({ success: true, data: await getMenuProducts(false) });
  } catch (error) {
    console.error("Product retrieval error:", error);
    res.status(500).json({ success: false, error: "菜单与库存读取失败" });
  }
});

app.get("/api/admin/products", authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    res.json({ success: true, data: await getMenuProducts(true) });
  } catch (error) {
    console.error("Admin product retrieval error:", error);
    res.status(500).json({ success: false, error: "库存列表读取失败" });
  }
});

app.patch("/api/admin/products/:id/inventory", authMiddleware, adminMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  const stock = Number(req.body?.stock);
  const active = req.body?.active !== false;
  if (!Number.isInteger(id) || !Number.isFinite(stock) || stock < 0 || stock > 9999) {
    res.status(400).json({ success: false, error: "库存数量必须是0至9999之间的整数" });
    return;
  }
  try {
    const product = await updateProductInventory(id, Math.floor(stock), active);
    if (!product) {
      res.status(404).json({ success: false, error: "未找到该商品" });
      return;
    }
    res.json({ success: true, message: "库存状态已更新", data: product });
  } catch (error) {
    console.error("Inventory update error:", error);
    res.status(500).json({ success: false, error: "库存更新失败" });
  }
});

app.get("/api/wishlist", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    res.json({ success: true, data: await getWishlistByUserId(req.user!.id) });
  } catch (error) {
    console.error("Wishlist retrieval error:", error);
    res.status(500).json({ success: false, error: "心愿卡读取失败" });
  }
});

app.put("/api/wishlist", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const rawItems = req.body?.items;
  if (!Array.isArray(rawItems) || rawItems.length > 50) {
    res.status(400).json({ success: false, error: "心愿卡数据格式不正确或数量超过上限" });
    return;
  }
  const items: WishlistItem[] = rawItems.map((item: any) => ({
    wishId: String(item.wishId || "").slice(0, 255),
    itemId: Number.isInteger(Number(item.itemId)) ? Number(item.itemId) : undefined,
    name: String(item.name || "").slice(0, 255),
    price: Math.max(0, Number(item.price) || 0),
    category: String(item.category || "coffee").slice(0, 50),
    img: String(item.img || "").slice(0, 1000),
    sugar: String(item.sugar || "").slice(0, 255),
    milk: String(item.milk || "").slice(0, 255),
    temp: String(item.temp || "").slice(0, 255),
    size: String(item.size || "").slice(0, 255),
    notes: String(item.notes || "").slice(0, 1000),
    addedAt: String(item.addedAt || new Date().toISOString()).slice(0, 255),
  }));
  if (items.some((item) => !item.wishId || !item.name)) {
    res.status(400).json({ success: false, error: "心愿卡存在缺失标识或名称的项目" });
    return;
  }
  try {
    await replaceWishlist(req.user!.id, items);
    res.json({ success: true, message: "心愿卡已保存到数据库", data: items });
  } catch (error) {
    console.error("Wishlist save error:", error);
    res.status(500).json({ success: false, error: "心愿卡保存失败" });
  }
});

// ==================== DeepSeek Conversational Coffee Consultant ====================

app.post("/api/assistant/chat", async (req, res) => {
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const current = assistantRateLimits.get(key);
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + 60 * 60 * 1000 }
    : current;
  if (bucket.count >= 30) {
    res.status(429).json({ success: false, error: "本小时咨询次数已达到上限，请稍后再试" });
    return;
  }
  bucket.count += 1;
  assistantRateLimits.set(key, bucket);

  const rawMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const messages = rawMessages
    .filter((message: any) => message?.role === "user" || message?.role === "assistant")
    .slice(-10)
    .map((message: any) => ({ role: message.role, content: String(message.content || "").slice(0, 1200) }));
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    res.status(400).json({ success: false, error: "请输入需要咨询的问题" });
    return;
  }

  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    res.status(503).json({ success: false, code: "AI_NOT_CONFIGURED", error: "咖啡顾问正在配置中，请稍后再来" });
    return;
  }

  try {
    const products = await getMenuProducts(false);
    const menuContext = products.map((product) => {
      const origin = product.beanBatch
        ? `；豆源：${product.beanBatch.country}${product.beanBatch.region}，${product.beanBatch.process}，${product.beanBatch.flavorNotes.join("、")}`
        : "";
      return `- ${product.name}：¥${product.price}，库存${product.stock}，${product.desc}${origin}`;
    }).join("\n");
    const systemMessage = `你是“悠然咖啡客”的24小时对话式咖啡顾问。请使用自然、克制、可靠的中文回答。\n\n当前真实菜单：\n${menuContext}\n\n规则：\n1. 只提供咖啡、茶饮、甜点、菜单和饮用知识咨询，不执行下单、退款、库存修改或账户操作。\n2. 涉及本店商品、价格和库存时只能依据上方菜单，不得编造。\n3. 可以根据预算、冷热、甜度、风味和咖啡因偏好给出2至3个建议并解释原因。\n4. 涉及过敏、孕期、疾病和药物时明确说明不是医疗建议，建议咨询医生或店员核实配料。\n5. 回答尽量控制在300字以内，除非用户要求详细说明。`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let deepSeekResponse: globalThis.Response;
    try {
      deepSeekResponse = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.DEEPSEEK_MODEL || "deepseek-flash",
          messages: [{ role: "system", content: systemMessage }, ...messages],
          thinking: { type: "disabled" },
          max_tokens: 700,
          stream: false,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const payload: any = await deepSeekResponse.json().catch(() => ({}));
    if (!deepSeekResponse.ok) {
      console.error("DeepSeek API error:", deepSeekResponse.status, payload?.error?.message || "unknown");
      res.status(502).json({ success: false, error: deepSeekResponse.status === 402 ? "咖啡顾问额度暂不可用" : "咖啡顾问暂时无法回答，请稍后重试" });
      return;
    }
    const reply = payload?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      res.status(502).json({ success: false, error: "咖啡顾问没有返回有效内容" });
      return;
    }
    res.json({ success: true, data: { reply, usage: payload.usage || null } });
  } catch (error: any) {
    console.error("Coffee assistant error:", error?.name === "AbortError" ? "timeout" : error);
    res.status(502).json({ success: false, error: error?.name === "AbortError" ? "咖啡顾问响应超时，请稍后重试" : "咖啡顾问暂时不可用" });
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

    const productQuantities = new Map<number, number>();
    for (const item of items) {
      const productId = Number(item.itemId);
      if (Number.isInteger(productId)) {
        productQuantities.set(productId, (productQuantities.get(productId) || 0) + 1);
      }
    }
    await insertOrderWithInventory(newOrder, productQuantities);

    const printJobId = jobId || "PRT-" + Math.floor(1000 + Math.random() * 9000) + "-" + crypto.randomBytes(3).toString("hex").toUpperCase();

    res.json({
      success: true,
      message: "🎉 订单支付成功！已为您生成提单凭证。",
      data: newOrder,
      printJobId: printJobId
    });
  } catch (error: any) {
    console.error("Order checkout error:", error);
    if (typeof error?.message === "string" && error.message.startsWith("INSUFFICIENT_STOCK:")) {
      const [, productName, remaining] = error.message.split(":");
      res.status(409).json({ success: false, error: `${productName}库存不足，当前仅剩${remaining}份` });
      return;
    }
    if (typeof error?.message === "string" && error.message.startsWith("PRODUCT_UNAVAILABLE:")) {
      res.status(409).json({ success: false, error: "订单中包含已下架商品，请刷新菜单后重试" });
      return;
    }
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
  // The application is SQL-only: startup must stop if the database is unavailable.
  await initDatabase();

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
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (/\.(?:mp4|webm|webp|avif|png|jpe?g)$/i.test(filePath)) {
          res.setHeader("Cache-Control", "public, max-age=604800");
        } else if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    }));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[USER DB ADMIN SYSTEM] Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("❌ Failed to start because the SQL database is unavailable:", error);
  process.exitCode = 1;
});
