// PM2 process definition for LetterMyComic.
//
// Runs the Next.js production server in cluster mode so that
// `pm2 reload lettermycomic` performs a zero-downtime restart: PM2 starts
// fresh workers, waits for them to bind the port, and only then drains the
// old ones — the site keeps serving throughout a deploy.
//
// Two workers share the port via Node's cluster module. PostgreSQL handles
// the concurrent connections; raise `instances` for more throughput.

const fs = require("fs");
const path = require("path");

// Read APP_DIR/.env directly so the workers always get DATABASE_URL even if
// they are launched without it exported (e.g. a manual `pm2 restart`). This
// does not depend on Next.js's own .env loading.
function loadEnvFile(file) {
  const out = {};
  try {
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      out[m[1]] = v;
    }
  } catch {
    /* no .env yet */
  }
  return out;
}

const fileEnv = loadEnvFile(path.join(__dirname, ".env"));
const PORT = process.env.PORT || fileEnv.PORT || "3000";
const DATABASE_URL = process.env.DATABASE_URL || fileEnv.DATABASE_URL || "";

module.exports = {
  apps: [
    {
      name: process.env.SERVICE || "lettermycomic",
      script: "node_modules/next/dist/bin/next",
      args: `start -p ${PORT}`,
      cwd: __dirname,
      instances: 2,
      exec_mode: "cluster",
      // give a new worker time to boot & bind before PM2 kills the old one
      listen_timeout: 10000,
      kill_timeout: 5000,
      max_memory_restart: "600M",
      env: {
        NODE_ENV: "production",
        PORT,
        DATABASE_URL,
      },
    },
  ],
};
