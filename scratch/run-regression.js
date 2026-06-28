const { spawn, execSync } = require('child_process');
const path = require('path');

const suites = [
  'scratch/test-day8.js',
  'scratch/test-day9.js',
  'scratch/test-day9-5.js',
  'scratch/test-day10-rls.js',
  'scratch/test-day11.js',
  'scratch/test-day12.js',
  'scratch/test-day13.js',
  'scratch/test-audit-A.js',
  'scratch/test-audit-B.js',
  'scratch/test-audit-C.js',
  'scratch/test-audit-D.js',
  'scratch/test-issue-8.js',
];

const BASE_URL = 'http://localhost:3000';

async function probeHttp() {
  try {
    const r = await fetch(`${BASE_URL}/api/webhooks/razorpay`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    return r.status !== 0;
  } catch {
    return false;
  }
}

async function main() {
  let devServer = null;

  if (await probeHttp()) {
    console.log('[REGRESSION] Server already running.');
  } else {
    console.log('[REGRESSION] Starting dev server...');
    devServer = spawn('npm', ['run', 'dev', '--', '--webpack'], {
      cwd: path.join(__dirname, '..'),
      shell: true,
      stdio: 'ignore',
    });

    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000));
      if (await probeHttp()) {
        console.log('[REGRESSION] Dev server ready.');
        break;
      }
    }
  }

  const failures = [];

  for (const suite of suites) {
    console.log(`\n============================================================`);
    console.log(`RUNNING SUITE: ${suite}`);
    console.log(`============================================================`);
    try {
      execSync(`node ${suite}`, { stdio: 'inherit' });
      console.log(`✓ SUITE PASSED: ${suite}`);
    } catch (err) {
      console.error(`✗ SUITE FAILED: ${suite}`);
      failures.push(suite);
    }
  }

  if (devServer) {
    console.log('[REGRESSION] Stopping dev server...');
    devServer.kill('SIGTERM');
  }

  console.log(`\n============================================================`);
  console.log(`REGRESSION SUMMARY`);
  console.log(`============================================================`);
  if (failures.length === 0) {
    console.log(`ALL SUITES PASSED!`);
    process.exit(0);
  } else {
    console.log(`Failed suites:\n${failures.join('\n')}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
