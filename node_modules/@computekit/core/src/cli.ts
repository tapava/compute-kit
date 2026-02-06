/**
 * ComputeKit CLI
 * Build tool for compiling AssemblyScript compute functions
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'fs';
import { join, basename, dirname, relative } from 'path';

interface BuildOptions {
  /** Input directory containing .ts files */
  input: string;
  /** Output directory for compiled WASM */
  output: string;
  /** Enable debug mode */
  debug?: boolean;
  /** Optimization level (0-3) */
  optimize?: number;
  /** Generate source maps */
  sourceMap?: boolean;
  /** Memory configuration */
  memory?: {
    initial?: number;
    maximum?: number;
  };
}

interface ComputeFunction {
  name: string;
  path: string;
  wasmPath: string;
}

/**
 * Find all compute function files
 */
function findComputeFunctions(dir: string): string[] {
  const files: string[] = [];

  function traverse(currentDir: string): void {
    if (!existsSync(currentDir)) return;

    const entries = readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        traverse(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

/**
 * Compile a single AssemblyScript file to WASM
 */
function compileToWasm(
  inputPath: string,
  outputPath: string,
  options: BuildOptions
): void {
  const outputDir = dirname(outputPath);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const optimizeLevel = options.optimize ?? 3;
  const args = [
    'npx',
    'asc',
    inputPath,
    '-o',
    outputPath,
    '--runtime',
    'stub',
    `--optimize`,
    `-O${optimizeLevel}`,
    '--exportRuntime',
  ];

  if (options.debug) {
    args.push('--debug');
  }

  if (options.sourceMap) {
    args.push('--sourceMap');
  }

  if (options.memory?.initial) {
    args.push('--initialMemory', String(options.memory.initial));
  }

  if (options.memory?.maximum) {
    args.push('--maximumMemory', String(options.memory.maximum));
  }

  const command = args.join(' ');
  console.log(`Compiling: ${inputPath}`);

  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`  → ${outputPath}`);
  } catch (error) {
    console.error(`Failed to compile ${inputPath}`);
    throw error;
  }
}

/**
 * Generate the compute registry file
 */
function generateRegistry(functions: ComputeFunction[], outputDir: string): void {
  const imports = functions
    .map((fn) => {
      const relativePath = relative(outputDir, fn.wasmPath).replace(/\\/g, '/');
      return `  '${fn.name}': () => import('./${relativePath}?url'),`;
    })
    .join('\n');

  const registry = `/**
 * ComputeKit - Auto-generated WASM Registry
 * Generated at: ${new Date().toISOString()}
 */

export const wasmModules: Record<string, () => Promise<{ default: string }>> = {
${imports}
};

export const moduleNames = ${JSON.stringify(functions.map((fn) => fn.name))};
`;

  const registryPath = join(outputDir, 'registry.ts');
  writeFileSync(registryPath, registry);
  console.log(`Generated registry: ${registryPath}`);
}

/**
 * Build all compute functions
 */
export async function build(options: BuildOptions): Promise<void> {
  console.log('\n🔧 ComputeKit Build\n');

  const { input, output } = options;

  // Find all .ts files
  const files = findComputeFunctions(input);
  if (files.length === 0) {
    console.log('No compute functions found.');
    return;
  }

  console.log(`Found ${files.length} compute function(s):\n`);

  // Ensure output directory exists
  if (!existsSync(output)) {
    mkdirSync(output, { recursive: true });
  }

  const functions: ComputeFunction[] = [];

  // Compile each file
  for (const file of files) {
    const name = basename(file, '.ts');
    const wasmPath = join(output, `${name}.wasm`);

    compileToWasm(file, wasmPath, options);

    functions.push({
      name,
      path: file,
      wasmPath,
    });
  }

  // Generate registry
  generateRegistry(functions, output);

  console.log(`\n✅ Build complete! ${functions.length} module(s) compiled.\n`);
}

/**
 * Watch mode for development
 */
export function watch(options: BuildOptions): void {
  console.log('\n👀 Watching for changes...\n');

  // Initial build
  build(options);

  // Watch for changes (simplified - in production use chokidar)
  const checkInterval = setInterval(() => {
    // In a real implementation, use file watchers
  }, 1000);

  process.on('SIGINT', () => {
    clearInterval(checkInterval);
    process.exit(0);
  });
}

// CLI entry point
if (typeof process !== 'undefined' && process.argv) {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
ComputeKit Build Tool

Usage:
  computekit build [options]
  computekit watch [options]

Options:
  --input, -i    Input directory (default: ./compute)
  --output, -o   Output directory (default: ./compute/wasm)
  --debug        Enable debug mode
  --optimize     Optimization level 0-3 (default: 3)
  --sourceMap    Generate source maps
  --help, -h     Show this help
    `);
    process.exit(0);
  }

  const getArg = (name: string, short?: string): string | undefined => {
    const idx = args.findIndex((a) => a === `--${name}` || a === `-${short}`);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const options: BuildOptions = {
    input: getArg('input', 'i') ?? './compute',
    output: getArg('output', 'o') ?? './compute/wasm',
    debug: args.includes('--debug'),
    optimize: parseInt(getArg('optimize') ?? '3'),
    sourceMap: args.includes('--sourceMap'),
  };

  if (args.includes('watch')) {
    watch(options);
  } else {
    build(options).catch(console.error);
  }
}
