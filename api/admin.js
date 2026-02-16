const DEFAULT_ADMIN_SECRET = "SuperSecretAdminKey123";
const DEFAULT_MASTER_PASSWORD = "watercheck123";

let runtimeAdminSecret = process.env.ADMIN_SECRET || DEFAULT_ADMIN_SECRET;
let runtimeMasterPassword =
  process.env.MASTER_ADMIN_PASSWORD || DEFAULT_MASTER_PASSWORD;

const getSupabaseConfig = () => {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.REACT_APP_SUPABASE_URL ||
    "";

  return {
    supabaseUrl: supabaseUrl.replace(/\/+$/, ""),
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  };
};

const parseBody = (body) => {
  if (!body) return {};
  if (typeof body === "object") return body;
  if (typeof body !== "string") return {};

  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
};

const parseRoutePath = (req) => {
  const routePath = req.query?.path;

  if (typeof routePath === "string" && routePath.trim() !== "") {
    return routePath.startsWith("/") ? routePath : `/${routePath}`;
  }

  return "/";
};

const send = (res, status, payload) => {
  res.status(status).json(payload);
};

const withCors = (req, res) => {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Admin-Key"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
};

const decodeRouteSegment = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const supabaseAdminRequest = async ({ path, method = "GET", body }) => {
  const { supabaseUrl, serviceKey } = getSupabaseConfig();

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/admin${path}`, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload?.msg ||
      payload?.message ||
      payload?.error_description ||
      payload?.error ||
      `Supabase admin HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return payload;
};

async function handler(req, res) {
  withCors(req, res);
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const path = parseRoutePath(req);
  const body = parseBody(req.body);

  if (path === "/verify-key" && req.method === "POST") {
    const key = typeof body.key === "string" ? body.key.trim() : "";
    return send(res, key === runtimeAdminSecret ? 200 : 401, {
      valid: key === runtimeAdminSecret,
      message: key === runtimeAdminSecret ? "Key verified" : "Invalid admin key",
    });
  }

  if (path === "/change-key" && req.method === "POST") {
    const oldKey = typeof body.oldKey === "string" ? body.oldKey.trim() : "";
    const newKey = typeof body.newKey === "string" ? body.newKey.trim() : "";

    if (!oldKey || !newKey) {
      return send(res, 400, { error: "Current key and new key are required." });
    }

    if (oldKey !== runtimeAdminSecret) {
      return send(res, 401, { error: "Current key is incorrect." });
    }

    runtimeAdminSecret = newKey;
    return send(res, 200, { success: true, message: "Admin key updated." });
  }

  if (path === "/master-password") {
    if (req.method === "GET") {
      return send(res, 200, { password: runtimeMasterPassword });
    }

    if (req.method === "PUT") {
      const password =
        typeof body.password === "string" ? body.password.trim() : "";
      if (!password) {
        return send(res, 400, { error: "Password cannot be empty." });
      }

      runtimeMasterPassword = password;
      return send(res, 200, { success: true, password: runtimeMasterPassword });
    }
  }

  if (path === "/users" && req.method === "GET") {
    try {
      const payload = await supabaseAdminRequest({
        path: "/users?page=1&per_page=1000",
      });

      const users = Array.isArray(payload?.users)
        ? payload.users.map((user) => ({
            id: user.id,
            email: user.email,
            created_at: user.created_at,
            banned_until: user.banned_until,
            disabled: Boolean(
              user.banned_until &&
                user.banned_until !== "none" &&
                user.banned_until !== "1970-01-01 00:00:00+00"
            ),
          }))
        : [];

      return send(res, 200, { users });
    } catch (error) {
      return send(res, error.status || 500, {
        error: error.message || "Failed to fetch users.",
      });
    }
  }

  const deleteMatch = path.match(/^\/users\/([^/]+)$/);
  if (deleteMatch && req.method === "DELETE") {
    const userId = decodeRouteSegment(deleteMatch[1]);

    try {
      await supabaseAdminRequest({
        path: `/users/${userId}`,
        method: "DELETE",
      });
      return send(res, 200, { success: true, message: "User deleted." });
    } catch (error) {
      return send(res, error.status || 500, {
        error: error.message || "Failed to delete user.",
      });
    }
  }

  const toggleMatch = path.match(/^\/users\/([^/]+)\/toggle$/);
  if (toggleMatch && req.method === "POST") {
    const userId = decodeRouteSegment(toggleMatch[1]);
    const enable = Boolean(body.enable);

    try {
      await supabaseAdminRequest({
        path: `/users/${userId}`,
        method: "PUT",
        body: { ban_duration: enable ? "none" : "forever" },
      });

      return send(res, 200, {
        success: true,
        message: enable ? "User enabled." : "User disabled.",
      });
    } catch (error) {
      return send(res, error.status || 500, {
        error: error.message || "Failed to update user status.",
      });
    }
  }

  return send(res, 404, {
    error: "Unknown admin route.",
    path,
    allowedPaths: [
      "/users",
      "/users/:id",
      "/users/:id/toggle",
      "/master-password",
      "/change-key",
      "/verify-key",
    ],
  });
}

module.exports = handler;
