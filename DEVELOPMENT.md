# Development Guide

This guide covers setting up the development environment and contributing to the Overshoot SDK.

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- Git

## Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-org/overshoot-sdk.git
   cd overshoot-sdk
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the project**:
   ```bash
   npm run build
   ```

## Project Structure

```
overshoot-sdk/
├── src/
│   ├── client/
│   │   ├── __tests__/       # Unit tests
│   │   ├── client.ts        # Low-level API client
│   │   ├── RealtimeVision.ts # Main SDK interface
│   │   ├── types.ts         # TypeScript type definitions
│   │   ├── errors.ts        # Custom error classes
│   │   └── index.ts         # Client exports
│   └── index.ts             # Main entry point
├── dist/                    # Build output (gitignored)
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
└── README.md
```

## Available Scripts

### Development

```bash
# Build the package
npm run build

# Build in watch mode (auto-rebuild on changes)
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm test -- --coverage
```

## Development Workflow

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** in the `src/` directory

3. **Test your changes**:
   ```bash
   npm run build
   npm test
   ```

4. **Type check**:
   ```bash
   npm run type-check
   ```

5. **Lint your code**:
   ```bash
   npm run lint
   ```

6. **Test locally**:
   ```bash
   npm pack
   # Install in another project to test
   cd ../test-project
   npm install ../overshoot-sdk/overshoot-1.0.0.tgz
   ```

## Adding New Features

### Adding a new method to RealtimeVision

1. Add the method to `src/client/RealtimeVision.ts`
2. Add types if needed in `src/client/types.ts`
3. Export from `src/client/index.ts`
4. Add tests in `src/client/__tests__/`
5. Update README with usage examples
6. Update CHANGELOG

### Adding new error types

1. Create error class in `src/client/errors.ts`
2. Export from `src/client/index.ts`
3. Document in README

## Testing Guidelines

- Write tests for all new features
- Maintain test coverage above 80%
- Use descriptive test names
- Mock external dependencies (fetch, WebSocket, MediaStream)
- Test both success and error cases

Example test structure:

```typescript
describe("FeatureName", () => {
  beforeEach(() => {
    // Setup
  });

  it("should do something successfully", async () => {
    // Arrange
    // Act
    // Assert
  });

  it("should handle errors appropriately", async () => {
    // Test error cases
  });
});
```

## Code Style

- Follow TypeScript best practices
- Use descriptive variable names
- Add JSDoc comments for public APIs
- Keep functions focused and small
- Prefer composition over inheritance
- Use async/await over callbacks

## Type Safety

- Avoid `any` types (use `unknown` if necessary)
- Define explicit return types for public methods
- Use strict TypeScript configuration
- Export all public types

## Error Handling

- Create custom error classes for different error types
- Provide actionable error messages
- Include request IDs where available
- Handle cleanup in error cases
- Don't swallow errors silently

## Performance Considerations

- Minimize memory leaks (clean up event listeners, timers)
- Use efficient data structures
- Avoid unnecessary re-renders or re-computations
- Profile critical paths
- Consider bundle size

## Documentation

- Update README.md for user-facing changes
- Update CHANGELOG.md following Keep a Changelog format
- Add JSDoc comments for all public APIs
- Include usage examples
- Document breaking changes prominently

## Release Process

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Commit changes: `git commit -m "chore: bump version to x.y.z"`
4. Create tag: `git tag vx.y.z`
5. Push: `git push && git push --tags`
6. Build: `npm run build`
7. Publish: `npm publish`

## Debugging

### Local development with another project

1. Build the SDK:
   ```bash
   npm run build
   ```

2. Link locally:
   ```bash
   npm link
   ```

3. In your test project:
   ```bash
   npm link overshoot
   ```

4. Make changes and rebuild:
   ```bash
   npm run dev  # Watch mode
   ```

### Debugging tests

```bash
# Run specific test file
npm test -- client.test.ts

# Run with debugger
node --inspect-brk node_modules/.bin/vitest run

# Use VS Code debugger
# Add breakpoints and run "Debug Current Test File"
```

## Common Issues

### TypeScript errors after changes

```bash
# Clean build
rm -rf dist
npm run build
```

### Tests failing

```bash
# Clear cache
rm -rf node_modules/.vitest
npm test
```

### Module not found errors

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

## Contributing Guidelines

1. Follow the code style guide
2. Write tests for new features
3. Update documentation
4. Keep commits atomic and descriptive
5. Squash commits before merging if needed
6. Get code review before merging

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vitest Documentation](https://vitest.dev/)
- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules)
- [Semantic Versioning](https://semver.org/)
