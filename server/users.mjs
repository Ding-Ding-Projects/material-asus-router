// People who can sign in. The first account becomes the owner; the owner can
// add operators (who may change router settings) and viewers (read only).
// Roles are enforced here on the server, never only by hiding controls.
import { randomUUID } from "node:crypto";
import { hashPassword } from "./auth.mjs";

export const ROLES = ["operator", "viewer"];
const USERNAME = /^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$/;
const OWNER_ONLY = [/^\/api\/users(\/|$)/, /^\/api\/router\/(connect|approve-host-key|forget|key|key\/upload)$/, /^\/api\/routers(\/|$)/];

export function roleAllows(role, method, route) {
  if (role === "owner") return true;
  if (OWNER_ONLY.some((re) => re.test(route))) return false;
  if (role === "operator") return true;
  if (role === "viewer") return method === "GET" || route === "/api/logout" || route === "/api/changes/preview";
  return false;
}

export const roleRefusal = (role) =>
  role === "viewer" ? "Your account can view the router but not change it." : "Only the owner can do this.";

export function checkUsername(username, state, exceptId = null) {
  const value = String(username ?? "").trim();
  if (!USERNAME.test(value)) throw new Error("User names are 2 to 40 letters, digits, dots, dashes or underscores.");
  const taken = [state.owner?.username, ...state.users.filter((u) => u.id !== exceptId).map((u) => u.username)];
  if (taken.some((t) => String(t || "").toLowerCase() === value.toLowerCase())) throw new Error("That user name is already used.");
  return value;
}

export async function prepareUser(body) {
  return {
    name: String(body.name || "").trim().slice(0, 80),
    username: String(body.username ?? "").trim(),
    role: body.role,
    password: await hashPassword(body.password),
  };
}

export function addUser(state, prepared) {
  if (state.users.length >= 50) throw new Error("A router can have at most 50 people besides the owner.");
  if (!ROLES.includes(prepared.role)) throw new Error("Choose the operator or viewer role.");
  const user = {
    id: randomUUID(),
    name: prepared.name || prepared.username,
    username: checkUsername(prepared.username, state),
    role: prepared.role,
    ...prepared.password,
    createdAt: new Date().toISOString(),
  };
  state.users.push(user);
  return publicUser(user);
}

export function updateUser(state, id, { role, name, password } = {}) {
  const user = state.users.find((u) => u.id === id);
  if (!user) throw new Error("User not found.");
  if (role !== undefined) {
    if (!ROLES.includes(role)) throw new Error("Choose the operator or viewer role.");
    user.role = role;
  }
  if (name !== undefined) user.name = String(name).trim().slice(0, 80) || user.username;
  if (password) Object.assign(user, password);
  return publicUser(user);
}

export function removeUser(state, id) {
  const before = state.users.length;
  state.users = state.users.filter((u) => u.id !== id);
  if (state.users.length === before) throw new Error("User not found.");
}

export const publicUser = (u) => ({ id: u.id, name: u.name, username: u.username, role: u.role, createdAt: u.createdAt });
export const findUser = (state, username) =>
  state.users.find((u) => u.username.toLowerCase() === String(username ?? "").trim().toLowerCase());
