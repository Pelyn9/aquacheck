const DEFAULT_ADMIN_SECRET = "Aquackeck123";
const DEFAULT_MASTER_PASSWORD = "watercheck123";
const SECRETS_TABLE = process.env.ADMIN_SECRETS_TABLE || "admin_secrets";
const ADMIN_SECRET_COLUMN = process.env.ADMIN_SECRET_COLUMN || "secret_admin_password";
const MASTER_PASSWORD_COLUMN = process.env.MASTER_PASSWORD_COLUMN || "master_password";

let runtimeAdminSecret = process.env.ADMIN_SECRET || DEFAULT_ADMIN_SECRET;
let runtimeMasterPassword =
  process.env.MASTER_ADMIN_PASSWORD || DEFAULT_MASTER_PASSWORD;

const getSupabaseConfig = () => {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.REACT_APP_SUPABASE_URL ||
    "";
  const rawServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SERVICE_ROLE_KEY ||
    "";

  return {
    supabaseUrl: supabaseUrl.replace(/\/+$/, ""),
    serviceKey: rawServiceKey.replace(/\s+/g, ""),
  };
};

const decodeJwtRole = (token) => {
  if (typeof token !== "string" || token.trim() === "") return "";
  const [, payloadPart] = token.split(".");
  if (!payloadPart) return "";

  try {
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "="
    );
    const decoded = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
    return typeof decoded?.role === "string" ? decoded.role : "";
  } catch {
    return "";
  }
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

const validateSupabaseConfig = () => {
  const { supabaseUrl, serviceKey } = getSupabaseConfig();

  if (!supabaseUrl) {
    throw new Error(
      "Missing SUPABASE_URL. Set SUPABASE_URL (or REACT_APP_SUPABASE_URL) in server environment variables."
    );
  }

  if (!serviceKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Add the service_role key in server environment variables."
    );
  }

  const jwtRole = decodeJwtRole(serviceKey);
  if (jwtRole && jwtRole !== "service_role") {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY must be a service_role key (your configured key is not service_role)."
    );
  }

  return { supabaseUrl, serviceKey };
};

const parseResponseJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const supabaseAdminRequest = async ({ path, method = "GET", body }) => {
  const { supabaseUrl, serviceKey } = validateSupabaseConfig();
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

  const payload = await parseResponseJson(response);

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

const supabaseTableRequest = async ({
  path,
  method = "GET",
  body,
  preferRepresentation = false,
}) => {
  const { supabaseUrl, serviceKey } = validateSupabaseConfig();
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };

  if (preferRepresentation) {
    headers.Prefer = "return=representation";
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const payload = await parseResponseJson(response);

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.hint ||
      payload?.details ||
      payload?.error ||
      `Supabase table HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return payload;
};

const normalizeSecretValue = (value) =>
  typeof value === "string" ? value.trim() : "";

const readSecretsRow = async () => {
  const select = encodeURIComponent(
    `id,${ADMIN_SECRET_COLUMN},${MASTER_PASSWORD_COLUMN}`
  );
  const payload = await supabaseTableRequest({
    path: `${SECRETS_TABLE}?select=${select}&order=id.asc&limit=1`,
  });

  if (!Array.isArray(payload) || payload.length === 0) {
    return null;
  }

  return payload[0];
};

const syncRuntimeSecretsFromTable = async () => {
  try {
    const row = await readSecretsRow();
    if (!row) return null;

    const tableAdminSecret = normalizeSecretValue(row[ADMIN_SECRET_COLUMN]);
    const tableMasterPassword = normalizeSecretValue(row[MASTER_PASSWORD_COLUMN]);

    if (tableAdminSecret) runtimeAdminSecret = tableAdminSecret;
    if (tableMasterPassword) runtimeMasterPassword = tableMasterPassword;

    return row;
  } catch {
    return null;
  }
};

const persistSecretsToTable = async ({ adminSecret, masterPassword }) => {
  const payload = {};
  const nextAdminSecret = normalizeSecretValue(adminSecret);
  const nextMasterPassword = normalizeSecretValue(masterPassword);

  if (nextAdminSecret) payload[ADMIN_SECRET_COLUMN] = nextAdminSecret;
  if (nextMasterPassword) payload[MASTER_PASSWORD_COLUMN] = nextMasterPassword;

  if (Object.keys(payload).length === 0) {
    return { persisted: false };
  }

  try {
    const currentRow = await readSecretsRow();

    if (currentRow?.id !== undefined && currentRow?.id !== null) {
      await supabaseTableRequest({
        path: `${SECRETS_TABLE}?id=eq.${encodeURIComponent(String(currentRow.id))}`,
        method: "PATCH",
        body: payload,
        preferRepresentation: true,
      });
      return { persisted: true };
    }

    await supabaseTableRequest({
      path: SECRETS_TABLE,
      method: "POST",
      body: payload,
      preferRepresentation: true,
    });
    return { persisted: true };
  } catch (error) {
    return { persisted: false, error: error.message };
  }
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
    await syncRuntimeSecretsFromTable();
    const key = typeof body.key === "string" ? body.key.trim() : "";
    return send(res, key === runtimeAdminSecret ? 200 : 401, {
      valid: key === runtimeAdminSecret,
      message: key === runtimeAdminSecret ? "Key verified" : "Invalid admin key",
    });
  }

  if (path === "/change-key" && req.method === "POST") {
    await syncRuntimeSecretsFromTable();
    const oldKey = typeof body.oldKey === "string" ? body.oldKey.trim() : "";
    const newKey = typeof body.newKey === "string" ? body.newKey.trim() : "";

    if (!oldKey || !newKey) {
      return send(res, 400, { error: "Current key and new key are required." });
    }

    if (oldKey !== runtimeAdminSecret) {
      return send(res, 401, { error: "Current key is incorrect." });
    }

    runtimeAdminSecret = newKey;
    const dbResult = await persistSecretsToTable({ adminSecret: newKey });

    return send(res, 200, {
      success: true,
      persistedToTable: Boolean(dbResult.persisted),
      message: dbResult.persisted
        ? "Admin key updated."
        : "Admin key updated in runtime. SQL sync not available.",
      warning: dbResult.error || undefined,
    });
  }

  if (path === "/master-password") {
    if (req.method === "GET") {
      await syncRuntimeSecretsFromTable();
      return send(res, 200, { password: runtimeMasterPassword });
    }

    if (req.method === "PUT") {
      const password =
        typeof body.password === "string" ? body.password.trim() : "";
      if (!password) {
        return send(res, 400, { error: "Password cannot be empty." });
      }

      runtimeMasterPassword = password;
      const dbResult = await persistSecretsToTable({ masterPassword: password });

      return send(res, 200, {
        success: true,
        password: runtimeMasterPassword,
        persistedToTable: Boolean(dbResult.persisted),
        warning: dbResult.error || undefined,
      });
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
