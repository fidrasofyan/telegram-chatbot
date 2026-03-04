import { migrate } from '@/database';

// Get first argument
const arg = process.argv[2];

if (!arg) {
  console.error('Please provide an argument');
  process.exit(1);
}

if (arg === 'latest') {
  await migrate('latest');
} else if (arg === 'down') {
  await migrate('down');
} else {
  console.error('Invalid argument');
  process.exit(1);
}
