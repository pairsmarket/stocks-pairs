const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

function formatTime() {
  const now = new Date();
  return now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function log(icon, tag, message, color = colors.reset) {
  const time = formatTime();
  const tagFormatted = `${colors.dim}[${time}]${colors.reset} ${color}${icon}${colors.reset} ${tag}${colors.reset}`;
  console.log(`${tagFormatted} ${message}`);
}

const logger = {
  info: (tag, message) => log('ℹ', tag, message, colors.cyan),
  success: (tag, message) => log('✓', tag, message, colors.green),
  warn: (tag, message) => log('⚠', tag, message, colors.yellow),
  error: (tag, message) => log('✗', tag, message, colors.red),
  deploy: (message) => log('→', 'DEPLOY', message, colors.blue),
  swap: (message) => log('↔', 'SWAP', message, colors.magenta),
  step: (step, message) => log('→', `STEP ${step}`, message, colors.cyan),
  done: (message, duration) => log('✓', 'DONE', `${message} (${duration}s)`, colors.green),
};

module.exports = logger;
