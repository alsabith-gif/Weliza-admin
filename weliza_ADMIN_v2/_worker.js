// Weliza Admin Panel - Cloudflare Worker Password Protection
// Password is stored as environment variable ADMIN_PASSWORD

const LOGIN_HTML = (error = '') => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weliza Admin</title>
  <link rel="apple-touch-icon" href="/weliza-icon.png">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="Weliza">
  <meta name="theme-color" content="#1e4735">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      background: #0d1f17;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Segoe UI', Arial, sans-serif;
      padding: 1rem;
    }
    .card {
      background: #132b1f;
      border: 1px solid #1e4735;
      border-radius: 16px;
      padding: 2.5rem 2rem;
      width: 100%;
      max-width: 360px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.5);
    }
    .logo {
      text-align: center;
      margin-bottom: 2rem;
    }
    .logo img {
      width: 72px;
      height: 72px;
      border-radius: 16px;
      object-fit: cover;
    }
    .logo-name {
      font-family: Georgia, serif;
      font-size: 1.4rem;
      font-weight: 700;
      letter-spacing: 3px;
      color: #fff;
      margin-top: 12px;
    }
    .logo-sub {
      font-size: 11px;
      color: #6b9e7e;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-top: 3px;
    }
    label {
      display: block;
      font-size: 11px;
      color: #6b9e7e;
      font-weight: 600;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    input[type="password"] {
      width: 100%;
      background: #0d1f17;
      border: 1px solid #1e4735;
      border-radius: 8px;
      padding: 11px 14px;
      color: #fff;
      font-size: 15px;
      outline: none;
      transition: border-color 0.2s;
    }
    input[type="password"]:focus { border-color: #2d7a52; }
    .error {
      font-size: 12px;
      color: #f87171;
      margin-top: 8px;
      display: ${error ? 'block' : 'none'};
    }
    button {
      width: 100%;
      margin-top: 16px;
      background: #1e4735;
      border: none;
      border-radius: 8px;
      padding: 12px;
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      letter-spacing: 0.5px;
      transition: background 0.2s;
    }
    button:hover { background: #2d6b4f; }
    .lock-note {
      text-align: center;
      margin-top: 16px;
      font-size: 11px;
      color: #2d6b4f;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <img src="/weliza-icon.png" alt="Weliza">
      <div class="logo-name">WELIZA</div>
      <div class="logo-sub">Admin Portal</div>
    </div>
    <form method="POST" action="/__auth">
      <label for="pw">Password</label>
      <input type="password" id="pw" name="password" placeholder="Enter password" autocomplete="current-password" autofocus required>
      <div class="error">${error}</div>
      <button type="submit">Unlock Dashboard</button>
    </form>
    <div class="lock-note">🔒 Secure access</div>
  </div>
</body>
</html>`;

const SESSION_COOKIE = 'weliza_session';
const SESSION_DURATION = 365 * 24 * 60 * 60; // 1 year in seconds

function generateToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join('');
}

function getCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = cookieHeader.split(';').map(c => c.trim());
  for (const cookie of cookies) {
    const [key, ...vals] = cookie.split('=');
    if (key.trim() === name) return vals.join('=');
  }
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ADMIN_PASSWORD = env.ADMIN_PASSWORD || 'weliza2024';

    // Handle auth form submission
    if (request.method === 'POST' && url.pathname === '/__auth') {
      const formData = await request.formData();
      const password = formData.get('password');

      if (password === ADMIN_PASSWORD) {
        const token = generateToken();
        // Store valid token in KV or just use a signed value
        // For simplicity: store hash of password + secret as the valid token value
        const validToken = await hashToken(password + (env.TOKEN_SECRET || 'weliza_secret'));
        
        return new Response(null, {
          status: 302,
          headers: {
            'Location': '/',
            'Set-Cookie': `${SESSION_COOKIE}=${validToken}; Path=/; Max-Age=${SESSION_DURATION}; HttpOnly; SameSite=Strict; Secure`
          }
        });
      } else {
        return new Response(LOGIN_HTML('Incorrect password — try again.'), {
          status: 401,
          headers: { 'Content-Type': 'text/html' }
        });
      }
    }

    // Check session cookie for all other requests
    const sessionToken = getCookie(request, SESSION_COOKIE);
    if (sessionToken) {
      const validToken = await hashToken(ADMIN_PASSWORD + (env.TOKEN_SECRET || 'weliza_secret'));
      if (sessionToken === validToken) {
        // Authenticated — pass through to the actual page
        return env.ASSETS.fetch(request);
      }
    }

    // Show login page for unauthenticated requests (except static assets)
    const ext = url.pathname.split('.').pop();
    const staticExts = ['css', 'js', 'png', 'jpg', 'ico', 'svg', 'woff', 'woff2'];
    if (staticExts.includes(ext)) {
      return env.ASSETS.fetch(request);
    }

    return new Response(LOGIN_HTML(), {
      headers: { 'Content-Type': 'text/html' }
    });
  }
};

async function hashToken(input) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
