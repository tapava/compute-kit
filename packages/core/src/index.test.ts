/**
 * ComputeKit Core Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ComputeKit, isWasmSupported, getHardwareConcurrency } from '../src';

describe('ComputeKit', () => {
  let kit: ComputeKit;

  beforeEach(() => {
    kit = new ComputeKit({ debug: false });
  });

  afterEach(async () => {
    await kit.terminate();
  });

  describe('constructor', () => {
    it('should create instance with default options', () => {
      expect(kit).toBeInstanceOf(ComputeKit);
    });

    it('should accept custom options', () => {
      const customKit = new ComputeKit({
        maxWorkers: 2,
        timeout: 5000,
        debug: true,
      });
      expect(customKit).toBeInstanceOf(ComputeKit);
    });

    it('should accept remoteDependencyNames option', () => {
      const customKit = new ComputeKit({
        remoteDependencies: [
          'https://cdnjs.cloudflare.com/ajax/libs/dayjs/1.11.18/dayjs.min.js',
        ],
        remoteDependencyNames: {
          'https://cdnjs.cloudflare.com/ajax/libs/dayjs/1.11.18/dayjs.min.js':
            'dayjs',
        },
      });
      expect(customKit).toBeInstanceOf(ComputeKit);
    });
  });

  describe('register', () => {
    it('should register a function', () => {
      kit.register('test', (n: number) => n * 2);
      // Should not throw
    });

    it('should allow chaining', () => {
      const result = kit
        .register('fn1', () => 1)
        .register('fn2', () => 2);
      expect(result).toBe(kit);
    });
  });

  describe('run', () => {
    it('should execute a registered function', async () => {
      kit.register('double', (n: number) => n * 2);
      // Note: In the mock environment, we get 'mock result' back
      const result = await kit.run('double', 5);
      expect(result).toBeDefined();
    });

    it('should reject for unregistered function', async () => {
      await expect(kit.run('unknown', {})).rejects.toThrow();
    });
  });

  describe('getStats', () => {
    it('should return pool statistics', () => {
      const stats = kit.getStats();
      expect(stats).toHaveProperty('totalWorkers');
      expect(stats).toHaveProperty('activeWorkers');
      expect(stats).toHaveProperty('queueLength');
      expect(stats).toHaveProperty('tasksCompleted');
    });
  });

  describe('isWasmSupported', () => {
    it('should return a boolean', () => {
      const result = kit.isWasmSupported();
      expect(typeof result).toBe('boolean');
    });
  });
});

describe('Utility Functions', () => {
  describe('isWasmSupported', () => {
    it('should return a boolean', () => {
      const result = isWasmSupported();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getHardwareConcurrency', () => {
    it('should return a positive number', () => {
      const result = getHardwareConcurrency();
      expect(result).toBeGreaterThan(0);
    });
  });
});
