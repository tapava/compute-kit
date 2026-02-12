# Contributing to ComputeKit

First off, thank you for considering contributing to ComputeKit! It's people like you that make ComputeKit such a great tool.

## Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct: be respectful, inclusive, and constructive.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the issue tracker as you might find that the bug has already been reported. When you create a bug report, please include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples** (code snippets, links to files)
- **Describe the behavior you observed and what you expected**
- **Include your environment** (OS, Node version, browser)

### Suggesting Features

Feature suggestions are welcome! Please:

- **Use a clear and descriptive title**
- **Provide a detailed description** of the suggested feature
- **Explain why this feature would be useful**
- **Include code examples** if applicable

### Pull Requests

1. Fork the repo and create your branch from `develop`
2. If you've added code that should be tested, add tests
3. Ensure the test suite passes
4. Make sure your code follows the existing style
5. Write a clear PR description

## Development Setup

```bash
# Clone your fork
git clone https://github.com/your-username/computekit.git
cd computekit

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test

# Start the React demo
npm run dev
```

## Project Structure

```
packages/
├── core/           # Main library
│   └── src/
│       ├── index.ts    # Public API
│       ├── pool.ts     # Worker pool
│       ├── wasm.ts     # WASM utilities
│       └── types.ts    # TypeScript types
│
└── react/          # React bindings
    └── src/
        └── index.ts    # Hooks and provider
```

## Coding Guidelines

### TypeScript

- Use strict TypeScript
- Export types for public APIs
- Prefer interfaces over type aliases for object shapes
- Use meaningful variable names

### Style

- Use Prettier for formatting (it runs on commit)
- Use ESLint rules (they run on commit)
- Write JSDoc comments for public APIs
- Keep functions small and focused

### Commits

We use conventional commits:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation only
- `style:` Formatting, no code change
- `refactor:` Code change that doesn't fix a bug or add a feature
- `test:` Adding tests
- `chore:` Maintenance tasks

Example: `feat: add progress reporting to useCompute hook`

### Testing

- Write tests for new features
- Ensure existing tests pass
- Test edge cases
- Use descriptive test names

```typescript
describe('WorkerPool', () => {
  it('should execute tasks in parallel', async () => {
    // ...
  });
});
```

## Release Process

Releases are automated via GitHub Actions when a version tag is pushed:

```bash
npm version patch  # or minor, major
git push --follow-tags
```

## Questions?

Feel free to open an issue or reach out to the maintainers.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
