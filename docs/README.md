# Documentation Directory

This directory contains all project documentation, organized by category.

## Directory Structure

```
docs/
├── README.md                           # This file
├── ACCESSIBILITY.md                    # Accessibility features and guidelines
├── NUTRITION.md                        # Nutrition feature documentation
└── scripts/                            # Script documentation
    ├── IMPORT_TRANSLATIONS_README.md   # Nutrition translation import system
    └── QUICKSTART.md                   # Quick start guide for scripts
```

## Core Documentation

### Feature Documentation
- **NUTRITION.md** - Nutrition tracking features and usage
- **ACCESSIBILITY.md** - Accessibility features and WCAG compliance

### Scripts Documentation
- **IMPORT_TRANSLATIONS_README.md** - Nutrition translation import system
- **QUICKSTART.md** - Quick start guide for scripts

## In-App Documentation

User-facing help is also available in the application itself, rendered from the
route definitions and help pages under `src/pages/docs/`. These cover the main
feature areas accessible from the sidebar help menu.

## Contributing

When adding new documentation:

1. **Core Documentation**: Place in root `docs/` directory if it's:
   - User-facing documentation
   - Frequently referenced technical docs
   - Feature documentation

2. **Script Documentation**: Place in `docs/scripts/` if it's:
   - Script usage instructions
   - Utility tool documentation

3. **Update This File**: Add new documentation to the appropriate section

## Documentation Standards

- Use Markdown format (.md)
- Include clear headings and structure
- Add table of contents for documents >500 lines
- Keep documentation up-to-date with code changes
- Archive version-specific documentation after release
- Use English for all documentation
- Include code examples where appropriate
- Add diagrams for complex systems

## Finding Documentation

**For Users:**
- Start with the in-app help pages for feature instructions
- Use the sidebar help menu for context-sensitive guides

**For Developers:**
- Review `NUTRITION.md` for the nutrition database and calculation details
- See `docs/scripts/` for translation import documentation

---

**Last Updated**: 2026-08-01  
**Version**: v1.0 (Self-Hosted)
