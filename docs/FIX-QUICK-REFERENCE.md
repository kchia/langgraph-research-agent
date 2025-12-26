# Fix Implementation Quick Reference

> Quick reference guide for implementing fixes. See `FIX-IMPLEMENTATION-STRATEGY.md` for full details.

## Priority Order

### 🔴 Critical (Do First)

1. **Type Safety**: Fix `withStructuredOutput` assertions
2. **Type Safety**: Add interrupt data validation
3. **Validation**: Checkpointer validation
4. **Validation**: API key validation
5. **Validation**: Router state validation

### 🟠 High Priority (Do Second)

6. **Error Handling**: Graph-level error recovery
7. **Error Handling**: Standardize agent error handling
8. **Validation**: Input validation

### 🟡 Medium Priority (Do Third)

9. **State**: Document clarificationAttempts
10. **State**: Message summarization
11. **State**: Token budget consistency
12. **Type Safety**: Streaming type improvements
13. **Error Handling**: Error callback completeness
14. **Docs**: State reset documentation

### 🟢 Low Priority (Do Last)

15. **Observability**: Structured logging
16. **Production**: Timeout mechanism
17. **Config**: Company normalization configurable
18. **Testing**: Error scenario tests
19. **Docs**: Update documentation

## Commit Message Template

```
<type>(scope): <subject>

<body>

- Change 1
- Change 2
- Add tests
```

**Types**: `fix`, `feat`, `refactor`, `test`, `docs`

## Testing Checklist

Before each commit:

- [ ] Run `npm test`
- [ ] Run `npm run build` (check types)
- [ ] Manual smoke test if applicable

After each phase:

- [ ] Full test suite passes
- [ ] Integration tests pass
- [ ] No regressions

## File Change Patterns

### Type Safety Fixes

- Add type guards
- Remove `as` casts
- Add validation functions

### Error Handling

- Wrap in try-catch
- Return fallback state
- Log errors consistently

### Validation

- Add early validation
- Clear error messages
- Fail fast

## Risk Levels

**High Risk** (test extra carefully):

- Graph structure changes
- All-agent changes
- Message handling changes

**Medium Risk**:

- Core agent logic
- Graph execution

**Low Risk**:

- Documentation
- Validation additions
- Type improvements
