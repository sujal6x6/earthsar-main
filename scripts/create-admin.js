/* Create an admin, or reset an existing admin's password.
   Usage: npm run create-admin
   Or without prompts: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... npm run create-admin */
const readline = require("readline");
const { query, pool, migrate } = require("../server/db");
const { hashPassword } = require("../server/auth");

function ask(question, hidden = false) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = s => {
        if (s.includes(question)) rl.output.write(s);
        else rl.output.write("*");
      };
    }
    rl.question(question, answer => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

(async () => {
  await migrate();
  const email = (process.env.ADMIN_EMAIL || (await ask("Admin email: "))).toLowerCase();
  const name = process.env.ADMIN_NAME || (process.env.ADMIN_EMAIL ? "Admin" : (await ask("Name (optional): ")) || "Admin");
  const password = process.env.ADMIN_PASSWORD || (await ask("Password (10+ characters): ", true));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("That is not a valid email address.");
  if (password.length < 10) throw new Error("The password must be at least 10 characters.");
  const existing = await query("SELECT id FROM admins WHERE email = ?", [email]);
  if (existing.rows[0]) {
    await query("UPDATE admins SET name = ?, password_hash = ?, token_version = token_version + 1 WHERE email = ?", [
      name,
      await hashPassword(password),
      email
    ]);
    console.log(`Password reset for ${email}.`);
  } else {
    await query("INSERT INTO admins (email, name, password_hash) VALUES (?, ?, ?)", [email, name, await hashPassword(password)]);
    console.log(`Admin ${email} created.`);
  }
})()
  .catch(err => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
