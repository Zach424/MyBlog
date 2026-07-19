export interface CmsOAuthEnv {
  GITHUB_OAUTH_ID?: string;
  GITHUB_OAUTH_SECRET?: string;
}

type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

const encoder = new TextEncoder();
const STATE_TTL_SECONDS = 10 * 60;

function base64UrlEncode(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function hmacKey(secret: string, usage: KeyUsage[]) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usage,
  );
}

async function createState(origin: string, secret: string, now = Date.now()) {
  const nonce = crypto.getRandomValues(new Uint8Array(16));
  const payload = base64UrlEncode(
    encoder.encode(
      JSON.stringify({
        origin,
        expiresAt: Math.floor(now / 1000) + STATE_TTL_SECONDS,
        nonce: base64UrlEncode(nonce),
      }),
    ),
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret, ["sign"]),
    encoder.encode(payload),
  );
  return `${payload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function readState(state: string, secret: string, now = Date.now()) {
  const [payload, signature, extra] = state.split(".");
  if (!payload || !signature || extra) return null;

  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret, ["verify"]),
      base64UrlDecode(signature),
      encoder.encode(payload),
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  try {
    const parsed = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as {
      origin?: unknown;
      expiresAt?: unknown;
      nonce?: unknown;
    };
    if (
      typeof parsed.origin !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      typeof parsed.nonce !== "string" ||
      parsed.expiresAt < Math.floor(now / 1000)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function noStoreHeaders(contentType: string) {
  return {
    "cache-control": "no-store",
    "content-type": contentType,
  };
}

function textResponse(message: string, status: number) {
  return new Response(message, {
    status,
    headers: noStoreHeaders("text/plain; charset=utf-8"),
  });
}

function callbackHtml(status: "success" | "error", token: string, targetOrigin: string) {
  const authorizationMessage = `authorization:github:${status}:${JSON.stringify({ token })}`;
  const serializedMessage = JSON.stringify(authorizationMessage).replaceAll("<", "\\u003c");
  const serializedOrigin = JSON.stringify(targetOrigin).replaceAll("<", "\\u003c");

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>连接 GitHub · Zach424</title>
  </head>
  <body>
    <p>${status === "success" ? "GitHub 已连接，正在返回发布后台…" : "GitHub 连接失败，请关闭窗口后重试。"}</p>
    <script>
      const targetOrigin = ${serializedOrigin};
      const authorizationMessage = ${serializedMessage};
      if (window.opener) {
        const receiveMessage = (event) => {
          if (event.origin !== targetOrigin || event.data !== "authorizing:github") return;
          window.opener.postMessage(authorizationMessage, targetOrigin);
          window.removeEventListener("message", receiveMessage);
        };
        window.addEventListener("message", receiveMessage);
        window.opener.postMessage("authorizing:github", targetOrigin);
      }
    </script>
  </body>
</html>`;
}

function oauthConfiguration(env: CmsOAuthEnv) {
  const id = env.GITHUB_OAUTH_ID?.trim();
  const secret = env.GITHUB_OAUTH_SECRET?.trim();
  return id && secret ? { id, secret } : null;
}

export async function handleCmsOAuth(
  request: Request,
  env: CmsOAuthEnv,
  fetchImplementation: FetchImplementation = fetch,
) {
  const configuration = oauthConfiguration(env);
  if (!configuration) {
    return textResponse("Publishing Studio OAuth is not configured.", 503);
  }

  const url = new URL(request.url);
  if (request.method !== "GET") return textResponse("Method not allowed.", 405);
  if (url.searchParams.get("provider") !== "github") {
    return textResponse("Invalid OAuth provider.", 400);
  }

  if (url.pathname === "/api/cms/auth") {
    const siteId = url.searchParams.get("site_id");
    if (siteId && siteId !== url.hostname && siteId !== url.host) {
      return textResponse("OAuth site does not match this publishing studio.", 403);
    }

    const callbackUrl = `${url.origin}/api/cms/callback?provider=github`;
    const state = await createState(url.origin, configuration.secret);
    const authorizationUrl = new URL("https://github.com/login/oauth/authorize");
    authorizationUrl.searchParams.set("client_id", configuration.id);
    authorizationUrl.searchParams.set("redirect_uri", callbackUrl);
    authorizationUrl.searchParams.set("scope", "public_repo,user");
    authorizationUrl.searchParams.set("state", state);

    return new Response(null, {
      status: 302,
      headers: {
        ...noStoreHeaders("text/plain; charset=utf-8"),
        location: authorizationUrl.href,
      },
    });
  }

  if (url.pathname !== "/api/cms/callback") return textResponse("Not found.", 404);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return textResponse("Missing OAuth callback parameters.", 400);

  const stateData = await readState(state, configuration.secret);
  if (!stateData || stateData.origin !== url.origin) {
    return textResponse("OAuth state is invalid or expired.", 400);
  }

  const tokenResponse = await fetchImplementation("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      client_id: configuration.id,
      client_secret: configuration.secret,
      code,
      redirect_uri: `${url.origin}/api/cms/callback?provider=github`,
    }),
  });
  const tokenResult = (await tokenResponse.json().catch(() => null)) as {
    access_token?: unknown;
  } | null;
  const token = typeof tokenResult?.access_token === "string" ? tokenResult.access_token : "";
  const status = tokenResponse.ok && token ? "success" : "error";

  return new Response(callbackHtml(status, token, stateData.origin), {
    status: status === "success" ? 200 : 502,
    headers: noStoreHeaders("text/html; charset=utf-8"),
  });
}
