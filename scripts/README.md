# Scripts

Helper scripts for managing the Crisis2 application.

---

## create-admin-user.js

Creates an admin user with a secure bcrypt password hash.

### Usage

```bash
node scripts/create-admin-user.js <password>
```

### Example

```bash
node scripts/create-admin-user.js mySecurePassword123
```

### Output

The script will generate:

1. **User Details**:
   - UUID (unique user ID)
   - Email: `admin@example.com`
   - Role: `admin`

2. **Bcrypt Hash**:
   - Securely hashed password (10 salt rounds)

3. **SQL Command**:
   - Ready-to-run command to insert the user into D1

### Example Output

```
🔐 Generating bcrypt hash...
✅ Hash generated successfully!

📋 User Details:
   ID: 7f3e4d5a-2b1c-4a9e-8f7d-6c5b4a3e2d1f
   Email: admin@example.com
   Role: admin
   Password: mySecurePassword123

🔑 Bcrypt Hash:
   $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy

📝 Run this command to create the user:

wrangler d1 execute crisis2-db --remote --command="INSERT INTO users (id, email, password_hash, role, active, created_at) VALUES ('7f3e4d5a-2b1c-4a9e-8f7d-6c5b4a3e2d1f', 'admin@example.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin', 1, datetime('now'));"

✅ After running the command above, you can login with:
   Email: admin@example.com
   Password: mySecurePassword123
```

### Requirements

- Node.js installed
- `bcryptjs` package installed (`npm install`)
- Password must be at least 8 characters

### Security Notes

- Uses bcrypt with 10 salt rounds (industry standard)
- Generates cryptographically secure UUIDs
- Password is never stored in plain text
- SQL command is safe to copy/paste (no injection risk)

---

## Adding More Scripts

When adding new scripts to this directory:

1. **Make them executable**:
   ```bash
   chmod +x scripts/your-script.js
   ```

2. **Add a shebang**:
   ```javascript
   #!/usr/bin/env node
   ```

3. **Document usage** in this README

4. **Include error handling**:
   ```javascript
   if (!requiredArg) {
     console.error('❌ Error: required argument missing');
     process.exit(1);
   }
   ```

---

## Related Documentation

- [docs/FIX-401-ERRORS.md](../docs/FIX-401-ERRORS.md) - 401 error troubleshooting
- [docs/AUTH-IMPROVEMENTS.md](../docs/AUTH-IMPROVEMENTS.md) - Authentication improvements
- [docs/NEXT-STEPS.md](../docs/NEXT-STEPS.md) - Deployment next steps
