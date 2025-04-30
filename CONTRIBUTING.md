# Contributing to MCP Tools for ChatGPT

Thank you for your interest in contributing to Browser MCP Tools extension! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please help keep this project open and inclusive. Be respectful and constructive in your communications.

## Development Setup

1. **Clone the repository:**
   ```
   git clone [repository-url]
   cd mcp-tools-for-chatgpt
   ```

2. **Install dependencies:**
   ```
   npm install
   ```

3. **Run in development mode:**
   ```
   npm run dev
   ```

4. **Build the extension:**
   ```
   npm run build
   ```

5. **Package for distribution:**
   ```
   npm run package
   ```

## Pull Request Process

1. **Fork the repository** and create your branch from `main`.
2. **Add tests** for any new features or bug fixes.
3. **Ensure the test suite passes** by running `npm test`.
4. **Make sure your code lints** by running `npm run lint`.
5. **Update documentation** if necessary.
6. **Submit a pull request** describing your changes.

## Coding Guidelines

### JavaScript/TypeScript Style

- Follow the project's ESLint and Prettier configurations.
- Use 2 spaces for indentation.
- Use single quotes for strings.
- Add JSDoc comments to all functions and classes.
- Use TypeScript for type safety where possible.

### Git Workflow

- Use feature branches with descriptive names (e.g., `feature/add-new-tool`, `fix/network-error`).
- Keep commits focused on a single change.
- Write clear, descriptive commit messages.
- Rebase your branch on top of the latest `main` before submitting a PR.

### Testing

- Write unit tests for all new features.
- Ensure existing tests continue to pass.
- Include integration tests where appropriate.

## Adding New Tools

To add a new tool to the extension:

1. Define the tool in `src/modules/ToolManager.js`.
2. Implement the tool's logic in a separate module if complex.
3. Add appropriate tests for the tool.
4. Update the options page to include the new tool.
5. Document the tool in the README.

## Release Process

1. Version numbers follow [Semantic Versioning](https://semver.org/).
2. Create a tag for each release.
3. Update CHANGELOG.md with notable changes.
4. Package the release using `npm run package`.

## Reporting Issues

When reporting issues, please include:

- A clear, descriptive title
- A detailed description of the issue
- Steps to reproduce the behavior
- Expected behavior vs. actual behavior
- Browser version and OS information
- Screenshots if applicable

## License

By contributing to this project, you agree that your contributions will be licensed under the project's MIT License. 