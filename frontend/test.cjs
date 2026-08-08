process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function run() {
  const loginRes = await fetch('https://localhost:7065/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@orbit.com', password: 'Password123!' })
  });
  
  if (!loginRes.ok) {
    console.error('Login failed', loginRes.status);
    return;
  }
  
  const { token } = await loginRes.json();
  
  const r1 = await fetch('https://localhost:7065/api/v1/permissions', {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Permissions:', r1.status, await r1.text());

  const r2 = await fetch('https://localhost:7065/api/v1/permissions/roles', {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Roles:', r2.status, await r2.text());
}

run();
