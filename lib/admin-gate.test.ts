import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { HIDDEN_ADMIN_PATH, adminRouteStatus, bypassesAuthRedirect, type AdminAccess } from "./admin-gate.ts";
import { safeNext } from "./registration.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FUNAAB = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const signedOut: AdminAccess = { signedIn: false, verified: false, roles: [], universityId: null };
const student: AdminAccess = { signedIn: true, verified: true, roles: [], universityId: FUNAAB };
const unverifiedAdmin: AdminAccess = {
  signedIn: true,
  verified: false,
  roles: [{ role: "university_admin", university_id: FUNAAB }],
  universityId: FUNAAB,
};
const admin: AdminAccess = {
  signedIn: true,
  verified: true,
  roles: [{ role: "university_admin", university_id: FUNAAB }],
  universityId: FUNAAB,
};

const hidden = [HIDDEN_ADMIN_PATH, `${HIDDEN_ADMIN_PATH}/funaab`, `${HIDDEN_ADMIN_PATH}/funaab/activity`];
const retired = ["/admin", "/admin/funaab", "/admin/funaab/verifications"];

describe("admin route status", () => {
  it("returns 404 for a non-admin on /teblad and /admin", () => {
    for (const access of [signedOut, student, unverifiedAdmin]) {
      for (const pathName of [...hidden, ...retired]) {
        assert.equal(adminRouteStatus(pathName, access), 404, `${pathName} for ${access.signedIn ? "signed-in" : "signed-out"}`);
      }
    }
  });

  it("lets a verified admin open the hidden room and still 404s /admin", () => {
    assert.equal(adminRouteStatus(HIDDEN_ADMIN_PATH, admin), 200);
    assert.equal(adminRouteStatus(`${HIDDEN_ADMIN_PATH}/funaab`, admin), 200);
    assert.equal(adminRouteStatus(`${HIDDEN_ADMIN_PATH}/funaab/activity`, admin), 200);
    assert.equal(adminRouteStatus(`${HIDDEN_ADMIN_PATH}/other`, { ...admin, universityId: OTHER }), 404);
    for (const pathName of retired) assert.equal(adminRouteStatus(pathName, admin), 404);
  });

  it("does not turn those paths into a sign-in redirect", () => {
    for (const pathName of [...hidden, ...retired]) assert.equal(bypassesAuthRedirect(pathName), true);
    assert.equal(bypassesAuthRedirect("/signin"), false);
    assert.equal(bypassesAuthRedirect("/room/funaab"), false);
    assert.equal(bypassesAuthRedirect("/administrator"), false);
  });

  it("still accepts a direct return path after Google sign-in", () => {
    assert.equal(safeNext(`${HIDDEN_ADMIN_PATH}/funaab`), `${HIDDEN_ADMIN_PATH}/funaab`);
    assert.equal(safeNext("https://evil.example/teblad"), "/room/funaab");
  });
});

describe("student-facing files", () => {
  it("does not mention the hidden path or an admin sign-in link", () => {
    const files = [
      ...walk(path.join(root, "app/signin")),
      ...walk(path.join(root, "app/register")),
      ...walk(path.join(root, "app/room")),
      ...walk(path.join(root, "app/pending")),
      path.join(root, "app/page.tsx"),
      path.join(root, "app/layout.tsx"),
      path.join(root, "app/not-found.tsx"),
      path.join(root, "components/chrome.tsx"),
      path.join(root, "components/icons.tsx"),
      path.join(root, "design/signin.html"),
      path.join(root, "design/index.html"),
      path.join(root, "design/404.html"),
    ];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const label = path.relative(root, file);
      assert.equal(text.includes(HIDDEN_ADMIN_PATH), false, label);
      assert.equal(text.includes("Admin sign in"), false, label);
    }
  });
});

describe("hidden admin HTTP", () => {
  const port = 34567;
  const origin = `http://127.0.0.1:${port}`;
  let child: ChildProcess | undefined;

  after(() => {
    if (!child?.pid) return;
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  });

  it("returns the same 404 for a non-admin on /teblad and /admin", async () => {
    const env: NodeJS.ProcessEnv = { ...process.env, NEXT_TELEMETRY_DISABLED: "1" };
    delete env.NEXT_PUBLIC_SUPABASE_URL;
    delete env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete env.SUPABASE_SERVICE_ROLE_KEY;
    child = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "dev", "-p", String(port)], {
      cwd: root,
      detached: true,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let logs = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      logs += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      logs += chunk.toString();
    });

    await waitForServer(origin, child);
    const paths = ["/admin", "/admin/funaab", "/admin/funaab/activity", HIDDEN_ADMIN_PATH, `${HIDDEN_ADMIN_PATH}/funaab`, `${HIDDEN_ADMIN_PATH}/funaab/verifications`];
    for (const pathName of paths) {
      const response = await fetch(`${origin}${pathName}`, { redirect: "manual" });
      const body = await response.text();
      assert.equal(response.status, 404, `${pathName} status ${response.status} body ${body.slice(0, 180)} logs ${logs.slice(-500)}`);
      assert.match(body, /We can(?:'|&#x27;|&#39;)t find this page/);
      assert.match(body, /Back to the Room/);
      assert.equal(body.includes("Admin sign in"), false, pathName);
      assert.equal(body.includes(`href="${HIDDEN_ADMIN_PATH}"`), false, pathName);
      assert.equal(body.includes("tab-admin"), false, pathName);
    }

    const signin = await fetch(`${origin}/signin`, { redirect: "manual" });
    const signinBody = await signin.text();
    assert.equal(signin.status, 200);
    assert.equal(signinBody.includes("Admin sign in"), false);
    assert.equal(signinBody.includes(HIDDEN_ADMIN_PATH), false);
    assert.equal(signinBody.includes("tab-admin"), false);
    await assertScriptsOmitPath(origin, signinBody);
  });
});

async function assertScriptsOmitPath(origin: string, html: string) {
  const sources = [...html.matchAll(/\ssrc="([^"]+)"/g)].map((match) => match[1]).filter((src) => src.startsWith("/"));
  assert.ok(sources.length > 0, "signin page loaded no scripts");
  for (const src of sources) {
    const response = await fetch(`${origin}${src}`);
    const body = await response.text();
    assert.equal(response.status, 200, src);
    assert.equal(body.includes(HIDDEN_ADMIN_PATH), false, src);
    assert.equal(body.includes("Admin sign in"), false, src);
  }
}

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (/\.(tsx|ts|jsx|js|html)$/.test(name)) files.push(full);
  }
  return files;
}

async function waitForServer(origin: string, child: ChildProcess) {
  const deadline = Date.now() + 90_000;
  let last = "";
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`next dev exited ${child.exitCode}: ${last}`);
    try {
      const response = await fetch(`${origin}/signin`, { redirect: "manual" });
      if (response.status === 200) return;
      last = `status ${response.status}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`next dev did not start: ${last}`);
}
