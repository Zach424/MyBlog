import assert from "node:assert/strict";
import test from "node:test";
import { handleCmsOAuth } from "../lib/cms-oauth.ts";

const env = {
  GITHUB_OAUTH_ID: "client-id",
  GITHUB_OAUTH_SECRET: "test-secret-that-is-not-a-production-credential",
};

test("keeps the publishing OAuth route closed until the owner configures it", async () => {
  const response = await handleCmsOAuth(
    new Request("https://blog.example.test/api/cms/auth?provider=github"),
    {},
  );
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("starts a signed same-origin GitHub OAuth flow", async () => {
  const response = await handleCmsOAuth(
    new Request("https://blog.example.test/api/cms/auth?provider=github&site_id=blog.example.test"),
    env,
  );
  assert.equal(response.status, 302);

  const location = new URL(response.headers.get("location"));
  assert.equal(location.origin, "https://github.com");
  assert.equal(location.searchParams.get("client_id"), "client-id");
  assert.equal(location.searchParams.get("scope"), "public_repo,user");
  assert.equal(
    location.searchParams.get("redirect_uri"),
    "https://blog.example.test/api/cms/callback?provider=github",
  );
  assert.match(location.searchParams.get("state") ?? "", /^[\w-]+\.[\w-]+$/u);
});

test("rejects cross-site and tampered OAuth requests", async () => {
  const wrongSite = await handleCmsOAuth(
    new Request("https://blog.example.test/api/cms/auth?provider=github&site_id=attacker.example"),
    env,
  );
  assert.equal(wrongSite.status, 403);

  const tamperedState = await handleCmsOAuth(
    new Request("https://blog.example.test/api/cms/callback?provider=github&code=code&state=bad.state"),
    env,
  );
  assert.equal(tamperedState.status, 400);
});

test("exchanges the callback code and only posts the token to the studio origin", async () => {
  const authResponse = await handleCmsOAuth(
    new Request("https://blog.example.test/api/cms/auth?provider=github"),
    env,
  );
  const state = new URL(authResponse.headers.get("location")).searchParams.get("state");
  let exchangeRequest;

  const callbackResponse = await handleCmsOAuth(
    new Request(`https://blog.example.test/api/cms/callback?provider=github&code=one-use-code&state=${state}`),
    env,
    async (input, init) => {
      exchangeRequest = { input: String(input), init };
      return Response.json({ access_token: "github-token" });
    },
  );

  assert.equal(callbackResponse.status, 200);
  assert.equal(exchangeRequest.input, "https://github.com/login/oauth/access_token");
  assert.doesNotMatch(exchangeRequest.init.body, /test-secret.*github-token/u);
  const html = await callbackResponse.text();
  assert.match(html, /authorization:github:success/);
  assert.match(html, /github-token/);
  assert.match(html, /"https:\/\/blog\.example\.test"/);
  assert.doesNotMatch(html, /postMessage\([^,]+,\s*["']\*["']/u);
});
