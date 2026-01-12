# Publishing Guide for Overshoot SDK

This guide covers how to publish the `overshoot` npm package privately.

## Prerequisites

1. Node.js 18+ installed
2. npm account (for npm registry) or GitHub account (for GitHub Packages)
3. Appropriate access permissions

## Option 1: Private npm Package (Recommended for Teams)

### Setup

1. **Create an npm account** (if you don't have one):
   ```bash
   npm signup
   ```

2. **Login to npm**:
   ```bash
   npm login
   ```

3. **Update package.json** to ensure it's marked as private:
   ```json
   {
     "name": "@your-org/overshoot",
     "private": true,
     "publishConfig": {
       "access": "restricted"
     }
   }
   ```

### Publishing Steps

1. **Update version**:
   ```bash
   npm version patch  # or minor, or major
   ```

2. **Build the package**:
   ```bash
   npm run build
   ```

3. **Test locally** (optional but recommended):
   ```bash
   npm pack
   # This creates a .tgz file you can install locally to test
   npm install /path/to/overshoot-1.0.0.tgz
   ```

4. **Publish**:
   ```bash
   npm publish
   ```

### Installing the Private Package

Users will need to be added to your npm organization, then:

```bash
npm install @your-org/overshoot
```

## Option 2: GitHub Packages (Free for Private Repos)

### Setup

1. **Update package.json**:
   ```json
   {
     "name": "@your-github-username/overshoot",
     "repository": {
       "type": "git",
       "url": "https://github.com/your-github-username/overshoot-sdk.git"
     },
     "publishConfig": {
       "registry": "https://npm.pkg.github.com"
     }
   }
   ```

2. **Create a Personal Access Token** on GitHub:
   - Go to Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Generate new token with `write:packages` and `read:packages` scopes
   - Save the token securely

3. **Authenticate with GitHub Packages**:
   ```bash
   npm login --scope=@your-github-username --registry=https://npm.pkg.github.com
   # Username: your-github-username
   # Password: your-personal-access-token
   # Email: your-email
   ```

### Publishing Steps

1. **Update version**:
   ```bash
   npm version patch
   ```

2. **Build**:
   ```bash
   npm run build
   ```

3. **Publish**:
   ```bash
   npm publish
   ```

### Installing from GitHub Packages

Users need to create a `.npmrc` file in their project root:

```
@your-github-username:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

Then install:

```bash
npm install @your-github-username/overshoot
```

## Option 3: Private Git Repository

If you don't want to use a registry at all, you can install directly from Git:

### Setup

1. **Push to private Git repository**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/your-org/overshoot-sdk.git
   git push -u origin main
   ```

### Installing from Git

Users with access to the repository can install directly:

```bash
npm install git+https://github.com/your-org/overshoot-sdk.git
```

Or with a specific version/tag:

```bash
npm install git+https://github.com/your-org/overshoot-sdk.git#v1.0.0
```

## Version Management

Follow semantic versioning (semver):

- **Patch** (1.0.x): Bug fixes, no breaking changes
  ```bash
  npm version patch
  ```

- **Minor** (1.x.0): New features, backward compatible
  ```bash
  npm version minor
  ```

- **Major** (x.0.0): Breaking changes
  ```bash
  npm version major
  ```

## Pre-publish Checklist

Before publishing, ensure:

- [ ] All tests pass: `npm test`
- [ ] Types are correct: `npm run type-check`
- [ ] Code is linted: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] README is up to date
- [ ] CHANGELOG is updated (if you maintain one)
- [ ] Version number is bumped appropriately

## Automation (CI/CD)

You can automate publishing with GitHub Actions. Create `.github/workflows/publish.yml`:

```yaml
name: Publish Package

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://npm.pkg.github.com'
          scope: '@your-github-username'
      
      - run: npm ci
      - run: npm run build
      - run: npm test
      
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Troubleshooting

### "You do not have permission to publish"

- Ensure you're logged in: `npm whoami`
- Check package name isn't taken (for public packages)
- Verify organization access (for scoped packages)

### "Package name too similar to existing package"

- Use a scoped name: `@your-org/overshoot`

### Build failures

- Clean and rebuild:
  ```bash
  rm -rf dist node_modules
  npm install
  npm run build
  ```

## Best Practices

1. **Always build before publishing**: `npm run build`
2. **Test the build**: Install the packed tarball locally
3. **Use semver**: Follow semantic versioning strictly
4. **Tag releases**: Create Git tags for versions
5. **Document changes**: Maintain a CHANGELOG.md
6. **Test in isolation**: Use `npm pack` to test before publishing
7. **Review package contents**: Check `npm pack` output to ensure correct files

## Security

- Never commit API keys or tokens
- Use environment variables for sensitive data
- Review dependencies regularly: `npm audit`
- Keep dependencies updated: `npm update`
