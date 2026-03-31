# Contributing to NPTEL Hub

Thank you for your interest in contributing! This document outlines our contributing guidelines.

## Code of Conduct

We are committed to providing a welcoming and inspiring community for all. Please read and adhere to our Code of Conduct:

- Be respectful and inclusive
- Welcome newcomers
- Focus on what is best for the community
- Show empathy towards other community members
- Report concerning behavior to maintainers

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check the issue list as you might find out that you don't need to create one. When you are creating a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps which reproduce the problem**
- **Provide specific examples to demonstrate the steps**
- **Describe the behavior you observed and why it's a problem**
- **Explain which behavior you expected to see instead and why**

### Submitting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Use a clear and descriptive title**
- **Provide a step-by-step description of the suggested enhancement**
- **Provide specific examples to demonstrate the steps**
- **Describe the current behavior and expected behavior**
- **Explain why this enhancement would be useful**

### Pull Requests

When submitting a pull request:

1. **Fork the repository** and create your branch from `main`
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**: Implement your feature or fix
4. **Follow code style**: Maintain consistency with existing code
5. **Test your changes**: Ensure no breaking changes
6. **Commit with clear messages**: `git commit -m 'Add amazing feature'`
7. **Push to your fork**: `git push origin feature/amazing-feature`
8. **Open a Pull Request** with a clear description

### Coding Standards

#### JavaScript/Node.js
```javascript
// Use ES6+ syntax
const functionName = () => {
  // Code here
};

// Proper error handling
try {
  // Try block
} catch (error) {
  console.error('Error:', error);
  next(new AppError(error.message, 500));
}

// Comments for complex logic
// Use meaningful variable names
const userData = await User.findById(userId);
```

#### React/Next.js
```jsx
// Use functional components
export default function ComponentName({ prop1, prop2 }) {
  // Use hooks appropriately
  const [state, setState] = useState(null);
  
  useEffect(() => {
    // Side effects
  }, []);

  return (
    <div className="tailwind-classes">
      {/* JSX here */}
    </div>
  );
}
```

#### Naming Conventions
- **Files**: PascalCase for components (ComponentName.jsx), camelCase for utilities
- **Variables/Functions**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **CSS Classes**: kebab-case with Tailwind utilities

### Git Workflow

1. **Keep commits atomic**: Each commit should represent one logical change
2. **Write meaningful messages**: 
   ```
   feat: Add real-time chat notifications
   fix: Prevent XSS in message content
   docs: Update installation instructions
   ```
3. **Before submitting PR**:
   ```bash
   git pull origin main
   git rebase main
   ```

### Development Setup

```bash
# Clone repository
git clone https://github.com/yourusername/nptel-hub.git
cd nptel-hub

# Setup backend
cd server
npm install
cp .env.example .env
# Fill in .env with your credentials
npm run dev

# Setup frontend (new terminal)
cd client
npm install
cp .env.local.example .env.local
npm run dev
```

### Testing

Before submitting a PR, test your changes:

```bash
# Backend
cd server
npm run test  # if available

# Frontend
cd client
npm run lint
npm run build
```

### Documentation

Please update documentation for any changes:

- Update [README.md](README.md) for new features
- Add inline comments for complex logic
- Update API docs for new endpoints
- Include examples in documentation

## Commit Message Format

We follow conventional commits:

```
type(scope): subject

body

footer
```

**Types:**
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding tests
- `chore`: Build process, dependencies

**Example:**
```
feat(chat): Add emoji reactions to messages

- Implement emoji picker component
- Add reaction-added socket event
- Store reactions in Message model

Closes #123
```

## Code Review Process

1. **Automated checks**: GitHub Actions will run linting and tests
2. **Code review**: Maintainers will review your code
3. **Feedback**: We'll provide constructive feedback if needed
4. **Revision**: Update your PR based on feedback
5. **Merge**: Your PR will be merged once approved

## Areas for Contribution

We especially welcome contributions in:

- **Bug fixes**: Found a bug? Fix it!
- **New features**: Have an idea? Implement it!
- **Documentation**: Improve guides and examples
- **Tests**: Add unit, integration, or e2e tests
- **Performance**: Optimize code and database queries
- **UI/UX**: Enhance user experience and design
- **Localization**: Help translate to other languages
- **DevOps**: Improve CI/CD and deployment

## Getting Help

- **Questions**: Open a discussion on GitHub
- **Documentation**: Check README.md and inline comments
- **Community**: Reach out to maintainers

## License

By contributing to NPTEL Hub, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to NPTEL Hub! 🎉**
