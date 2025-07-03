import { beforeAll, afterAll, afterEach } from '@jest/globals';
import { getMonitoring } from '@cm-diagnostics/logger';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = process.env.TEST_LOG_LEVEL || 'error';

// Mock monitoring for tests
const monitoring = getMonitoring();
const logger = monitoring.getLogger({ component: 'test-setup' });

// Global test setup
beforeAll(async () => {
  logger.info('Starting test suite');
  
  // Mock timers for tests that need them
  if (process.env.USE_FAKE_TIMERS === 'true') {
    jest.useFakeTimers();
  }
});

// Global test teardown
afterAll(async () => {
  logger.info('Test suite completed');
  
  // Restore real timers
  if (process.env.USE_FAKE_TIMERS === 'true') {
    jest.useRealTimers();
  }
  
  // Allow time for async operations to complete
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Clean up after each test
afterEach(async () => {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Clear module cache for fresh imports
  jest.resetModules();
});

// Mock console methods to reduce noise in tests
if (process.env.SUPPRESS_CONSOLE !== 'false') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

// Add custom matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
  
  toBeValidDate(received: any) {
    const pass = received instanceof Date && !isNaN(received.getTime());
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid date`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid date`,
        pass: false,
      };
    }
  }
});

// Extend Jest matchers TypeScript definitions
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
      toBeValidDate(): R;
    }
  }
}