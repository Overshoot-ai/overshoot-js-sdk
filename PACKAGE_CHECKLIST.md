# Package Verification Checklist

Use this checklist before publishing the package to ensure everything is ready.

## Pre-Build Checks

- [ ] **Version number updated** in `package.json`
- [ ] **CHANGELOG.md updated** with changes for this version
- [ ] **All dependencies installed**: `npm install`
- [ ] **No security vulnerabilities**: `npm audit`
- [ ] **Dependencies are up to date** (or intentionally pinned)

## Code Quality Checks

- [ ] **TypeScript compiles without errors**: `npm run type-check`
- [ ] **All tests pass**: `npm test`
- [ ] **Linting passes**: `npm run lint`
- [ ] **No console.logs or debug code** in production code
- [ ] **Code is formatted consistently**

## Build Verification

- [ ] **Clean build succeeds**: 
  ```bash
  rm -rf dist
  npm run build
  ```
- [ ] **Build output exists** in `dist/` directory
- [ ] **Check dist/ contains**:
  - [ ] `index.js` (CommonJS)
  - [ ] `index.mjs` (ESM)
  - [ ] `index.d.ts` (TypeScript definitions)
  - [ ] Source maps (`.map` files)
- [ ] **No unnecessary files** in dist/

## Package Contents Check

Run `npm pack --dry-run` to see what will be published:

```bash
npm pack --dry-run
```

Verify the output includes:
- [ ] `dist/` directory with all built files
- [ ] `README.md`
- [ ] `LICENSE`
- [ ] `package.json`

Verify the output EXCLUDES:
- [ ] `src/` directory (source files)
- [ ] `node_modules/`
- [ ] Test files (`*.test.ts`, `__tests__/`)
- [ ] Config files (`.eslintrc`, `tsconfig.json`, etc.)
- [ ] `.git/` directory

## Documentation Check

- [ ] **README.md is complete**:
  - [ ] Installation instructions
  - [ ] Quick start examples
  - [ ] API reference
  - [ ] Common use cases
  - [ ] Error handling
  - [ ] Links work
- [ ] **CHANGELOG.md updated** with new version
- [ ] **JSDoc comments** on all public APIs
- [ ] **TypeScript types** exported correctly

## Local Testing

- [ ] **Create test tarball**: `npm pack`
- [ ] **Test in fresh project**:
  ```bash
  mkdir /tmp/test-overshoot
  cd /tmp/test-overshoot
  npm init -y
  npm install /path/to/overshoot-1.0.0.tgz
  ```
- [ ] **Test imports work**:
  ```typescript
  import { RealtimeVision } from 'overshoot';
  ```
- [ ] **Types are available** (check in IDE)

## Security & Privacy

- [ ] **No API keys** in code or config
- [ ] **No sensitive data** in repository
- [ ] **Dependencies audited**: `npm audit`
- [ ] **Private package setting** correct in `package.json`

## Configuration Verification

### package.json

- [ ] `name` is correct
- [ ] `version` is updated
- [ ] `description` is accurate
- [ ] `main` points to CommonJS entry (`dist/index.js`)
- [ ] `module` points to ESM entry (`dist/index.mjs`)
- [ ] `types` points to type definitions (`dist/index.d.ts`)
- [ ] `files` array includes only necessary files
- [ ] `private: true` if publishing privately
- [ ] `publishConfig` is set correctly for your registry
- [ ] `keywords` are relevant
- [ ] `repository` URL is correct
- [ ] `license` is specified

### TypeScript Configuration

- [ ] `tsconfig.json` is correct
- [ ] Output directory matches package.json `main`/`module`/`types`
- [ ] Strict mode enabled
- [ ] Declaration files enabled

### Build Configuration

- [ ] `tsup.config.ts` configured correctly
- [ ] Output formats include both CJS and ESM
- [ ] Source maps are generated
- [ ] Tree-shaking enabled

## Git & Version Control

- [ ] **All changes committed**: `git status`
- [ ] **Working directory clean**
- [ ] **On correct branch** (usually `main` or `master`)
- [ ] **Pushed to remote**:
  ```bash
  git push origin main
  ```
- [ ] **Tagged with version**:
  ```bash
  git tag v1.0.0
  git push --tags
  ```

## Publishing Preparation

### For npm Registry

- [ ] **Logged in**: `npm whoami`
- [ ] **Have publish permissions**
- [ ] **Scope configured** (if scoped package)

### For GitHub Packages

- [ ] **Personal access token** created with `write:packages` scope
- [ ] **Authenticated** with GitHub Packages
- [ ] **Repository URL** in package.json matches GitHub repo

### For Private Git

- [ ] **Repository is accessible** to users
- [ ] **Tag exists** for this version

## Final Steps Before Publishing

1. **Run all checks one final time**:
   ```bash
   npm run type-check && npm test && npm run lint && npm run build
   ```

2. **Create pack file** and inspect:
   ```bash
   npm pack
   tar -tzf overshoot-1.0.0.tgz | less
   ```

3. **Check package size**:
   ```bash
   ls -lh overshoot-1.0.0.tgz
   ```
   Should be reasonable (< 1MB for this SDK)

4. **Final review of CHANGELOG**

5. **Ready to publish!**

## Post-Publish Verification

After publishing, verify:

- [ ] **Package is visible** on registry
- [ ] **Installation works**: `npm install overshoot@1.0.0`
- [ ] **Types work** in consuming project
- [ ] **Examples run** successfully
- [ ] **Documentation links** work

## Common Issues

### Package size too large

Check what's being included:
```bash
npm pack --dry-run
```

Add exclusions to `.npmignore` or adjust `files` in `package.json`.

### Missing files in published package

The `files` field in `package.json` is too restrictive. Add necessary directories/files.

### TypeScript types not working

Ensure `types` field in `package.json` points to the correct `.d.ts` file.

### Import errors

- Check `main`, `module`, and `exports` fields in `package.json`
- Verify build output matches these paths

### "Cannot find module" errors

- Ensure all imports use correct relative paths
- Check that `dist/` contains all necessary files
- Verify `exports` field in `package.json` if using

## Rollback Plan

If you need to unpublish or deprecate:

```bash
# Deprecate a version (preferred)
npm deprecate overshoot@1.0.0 "Version has critical bug, use 1.0.1"

# Unpublish (only within 72 hours, not recommended)
npm unpublish overshoot@1.0.0

# Unpublish entire package (emergency only)
npm unpublish overshoot --force
```

## Automation

Consider setting up GitHub Actions to automate these checks:

```yaml
# .github/workflows/quality-check.yml
name: Quality Check
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run type-check
      - run: npm test
      - run: npm run lint
      - run: npm run build
```

---

**Remember**: Better to catch issues before publishing than to have to deprecate or unpublish!
