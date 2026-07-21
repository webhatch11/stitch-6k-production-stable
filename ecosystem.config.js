module.exports = {
  apps: [
    {
      name: "stitch-payment-worker",
      script: "lib/jobs/runners/payment-worker.ts",
      interpreter: "node",
      interpreter_args: "--import tsx",
      autorestart: true,
      max_memory_restart: "200M",
      restart_delay: 5000,
      env: {
        NODE_ENV: "production",
        IS_WORKER: "true",
        IS_ISOLATED_RUNNER: "true"
      },
      error_file: "logs/payment-worker-error.log",
      out_file: "logs/payment-worker-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss"
    },
    {
      name: "stitch-email-worker",
      script: "lib/jobs/runners/email-worker.ts",
      interpreter: "node",
      interpreter_args: "--import tsx",
      autorestart: true,
      max_memory_restart: "200M",
      restart_delay: 5000,
      env: {
        NODE_ENV: "production",
        IS_WORKER: "true",
        IS_ISOLATED_RUNNER: "true"
      },
      error_file: "logs/email-worker-error.log",
      out_file: "logs/email-worker-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss"
    },
    {
      name: "stitch-shipment-worker",
      script: "lib/jobs/runners/shipment-worker.ts",
      interpreter: "node",
      interpreter_args: "--import tsx",
      autorestart: true,
      max_memory_restart: "200M",
      restart_delay: 5000,
      env: {
        NODE_ENV: "production",
        IS_WORKER: "true",
        IS_ISOLATED_RUNNER: "true"
      },
      error_file: "logs/shipment-worker-error.log",
      out_file: "logs/shipment-worker-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss"
    },
    {
      name: "stitch-cleanup-worker",
      script: "lib/jobs/runners/cleanup-worker.ts",
      interpreter: "node",
      interpreter_args: "--import tsx",
      autorestart: true,
      max_memory_restart: "200M",
      restart_delay: 5000,
      env: {
        NODE_ENV: "production",
        IS_WORKER: "true",
        IS_ISOLATED_RUNNER: "true"
      },
      error_file: "logs/cleanup-worker-error.log",
      out_file: "logs/cleanup-worker-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss"
    },
    {
      name: "stitch-loyalty-worker",
      script: "lib/jobs/runners/loyalty-worker.ts",
      interpreter: "node",
      interpreter_args: "--import tsx",
      autorestart: true,
      max_memory_restart: "200M",
      restart_delay: 5000,
      env: {
        NODE_ENV: "production",
        IS_WORKER: "true",
        IS_ISOLATED_RUNNER: "true"
      },
      error_file: "logs/loyalty-worker-error.log",
      out_file: "logs/loyalty-worker-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss"
    }
  ]
};
