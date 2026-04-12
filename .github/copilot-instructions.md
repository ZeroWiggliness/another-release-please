# Copilot Instructions for another-release-please

## Project Overview

This project is a release-please style variant targeted primarily towards GitLab. The goal is to automate version management and changelog generation for GitLab projects.

## General Guidelines

- Write clear, concise, and maintainable code
- Follow existing code patterns and conventions in the repository
- Prioritize simplicity and readability over complexity
- Consider GitLab-specific features and workflows when making changes

## Code Style

- Use consistent naming conventions throughout the codebase
- Follow JavaScript/TypeScript best practices
- Use meaningful variable and function names that describe their purpose
- Keep functions small and focused on a single responsibility
- Add comments for complex logic, but prefer self-documenting code

## Documentation

- Update README.md when adding new features or changing functionality
- Include inline comments for non-obvious code logic
- Document public APIs and interfaces
- Keep documentation up-to-date with code changes
- Use clear examples where applicable

## Testing

- Write tests for new features and bug fixes
- Ensure tests are deterministic and isolated
- Follow existing test patterns in the repository
- Run tests before committing changes
- Aim for meaningful test coverage, not just high percentages

## Version Control

- Write clear, descriptive commit messages
- Keep commits focused and atomic
- Reference issue numbers in commit messages when applicable
- Follow conventional commit format if established in the project

## GitLab Integration

- Consider GitLab API compatibility when making changes
- Test changes with GitLab-specific features
- Be mindful of GitLab's rate limits and API constraints
- Follow GitLab's documentation for API usage and best practices

## Error Handling

- Handle errors gracefully with appropriate error messages
- Log errors with sufficient context for debugging
- Avoid exposing sensitive information in error messages
- Validate inputs and handle edge cases

## Dependencies

- Minimize adding new dependencies
- When adding dependencies, prefer well-maintained, widely-used packages
- Keep dependencies up-to-date for security patches
- Document the purpose of new dependencies

## Security

- Never commit sensitive information (API keys, tokens, passwords)
- Validate and sanitize user inputs
- Follow security best practices for API interactions
- Be cautious with external data and API responses

## Performance

- Consider performance implications of changes
- Optimize for common use cases
- Avoid unnecessary API calls or expensive operations
- Use caching where appropriate

## Accessibility

- Ensure any user-facing features are accessible
- Follow accessibility best practices for documentation
- Use clear and inclusive language

## Contribution Workflow

- Check for existing issues before implementing features
- Follow the project's contribution guidelines if available
- Be responsive to feedback in code reviews
- Test changes thoroughly before submitting

# Agent Instructions

The package uses yarn. So to build the project, run `yarn build`. To run tests, use `yarn test`. Ensure that any code you generate adheres to the project's coding standards and passes all tests before submission.
All imports from local files should end with .js in the main code.
Helper methods should be added in src/helpers/ if they are likely to be reused; otherwise, they can be added in the same file where they are used.
Never try commit or create a PR.

# Plan Mode
Do not ask if you should create a PR or not. Never create a PR in plan mode.

