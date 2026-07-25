// PM2 process definition for LetterMyComic.
//
// Runs the Next.js production server in cluster mode so that
// `pm2 reload lettermycomic` performs a zero-downtime restart: PM2 starts
// fresh workers, waits for them to bind the port, and only then drains the
// old ones — the site keeps serving throughout a deploy.
//
// Two workers share the port via Node's cluster module. SQLite serialises
// writes across them; if you move to Postgres you can raise `instances`.
const PORT = process.env.PORT || "3000";

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
      },
    },
  ],
};
