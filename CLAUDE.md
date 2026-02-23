# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Horizon is Shopify's flagship first-party Liquid theme. It uses **zero external dependencies** — pure Liquid, vanilla JavaScript (Web Components), and modern CSS. There is no bundler, no framework, and no package manager. HTML is server-rendered by Shopify's Liquid engine; JavaScript is only for progressive enhancement.

## Development Commands

```bash
# Start local development server
shopify theme dev

# Lint/validate the theme
shopify theme check

# Build schemas (JS → Liquid {% schema %} blocks)
npm run build:schemas

# Push theme to Shopify store
shopify theme push
```

There is no test suite — validation is done via `shopify theme check` and manual browser testing.

## Architecture

### File Structure

- **`blocks/`** — Theme blocks (reusable components nestable under sections/other blocks)
- **`sections/`** — Page sections (top-level layout containers)
- **`snippets/`** — Reusable Liquid partials (included via `{% render %}`)
- **`templates/`** — JSON page templates that compose sections
- **`layout/`** — Layout wrappers (`theme.liquid`, `password.liquid`)
- **`assets/`** — JavaScript, CSS, SVGs (flat directory, no subdirectories)
- **`config/`** — `settings_schema.json` (theme settings definition) and `settings_data.json`
- **`locales/`** — Translation files (50+ languages); `en.default.json` is the source of truth

### Component Framework (`assets/component.js`)

All interactive components extend the `Component` base class (a Web Component):

- **Refs**: Elements with `ref="name"` are auto-collected into `this.refs.name`. Use `ref="items[]"` for arrays.
- **Declarative events**: `on:click="/methodName"` on elements automatically delegates to the closest `Component` ancestor's method. Supports `on:change`, `on:submit`, `on:input`, `on:keydown`, etc.
- **Mutation observer**: Refs auto-update when DOM changes.
- **Import pattern**: `import { Component } from '@theme/component';`

### Schema System

**Never edit `{% schema %}` blocks directly in `.liquid` files.** Schemas are authored as JavaScript in `schemas/` and compiled to Liquid via `npm run build:schemas`. This enables TypeScript validation and shared schema fragments.

Schema translation keys use `t:names.keyname` format and must exist in `locales/en.default.schema.json`.

### Rendering Model

- **Server-side**: Liquid renders all HTML. No client-side routing.
- **Sections**: Composed in JSON template files, rendered by Shopify.
- **Blocks**: Can be static (developer-placed via `{% content_for 'block', type: '...', id: '...' %}`) or dynamic (merchant-arranged via `{% content_for 'blocks' %}`).
- **Critical constraint**: Only ONE `{% content_for 'blocks' %}` per Liquid file. If needed in conditionals, capture it first.

### Cross-Component Communication

- **Parent → child**: Invoke public methods on child component refs
- **Child → parent**: Dispatch `CustomEvent` with `bubbles: true`
- **Sibling**: Listen on `document` for custom events (e.g., `cart:updated`)

## Coding Standards

Extensive rules exist in `.cursor/rules/` (44 files). Key requirements:

### JavaScript
- Zero external dependencies — native browser APIs only
- `async/await` only, never `.then()` chaining
- `for (const item of items)` over `.forEach()`
- `const` over `let`; early returns over nested conditionals
- JSDoc type annotations (TypeDefs for refs, `@extends {Component<Refs>}`)
- Private methods use `#` prefix
- Event-driven architecture for component communication

### CSS
- **BEM naming**: `.block__element--modifier`
- **Specificity max `0 1 0`** (single class); never use IDs; avoid `!important`
- **Logical properties**: `padding-inline`, `margin-block`, `text-align: start` (RTL support)
- **Scoped CSS variables**: Namespace to component (e.g., `--component-padding`)
- **Instance styling**: Use inline `style` attributes with CSS variables set from Liquid settings, not `{% style %}` blocks with block-ID selectors
- **Nesting**: Never beyond first level (except media queries and parent-modifier contexts); no `&` operator
- **Mobile-first**: `min-width` media queries
- **Container queries** for responsive components
- **`:has()` performance**: Anchor close to children, use `>` combinator

### Liquid
- Prefer inline Liquid over declaring variables (reduces scroll distance)
- Use `{% liquid %}` for multiline logic blocks
- All user-visible text must use translation keys: `{{ 'key' | t }}`
- Snippets must have `{% doc %}` documentation with `@param` types and `@example`
- `{% stylesheet %}` for block/section-scoped CSS; `{% javascript %}` for component scripts

### HTML
- Progressive enhancement: semantic HTML → CSS → JavaScript
- Native elements first: `<details>`, `<dialog>`, `popover`, `<search>`, `<output>`
- IDs use CamelCase with section/block identifiers: `id="ProductModal-{{ product.id }}-{{ section.id }}"`
- `tabindex="0"` for custom interactive elements; never positive tabindex

### Accessibility (WCAG AA)
- 20+ detailed accessibility guideline files in `.cursor/rules/`
- Focus-visible indicators on all interactive elements
- `prefers-reduced-motion` media queries for all animations
- Touch targets: 24x24px minimum, 44x44px recommended
- Screen reader: semantic HTML, `aria-label`, `aria-expanded` as appropriate
- Never prevent zoom (`maximum-scale=1.0`, `user-scalable=no`)

### Schemas
- Setting organization: resource pickers → layout → typography → colors → spacing
- Labels under 30 characters, title case
- Nested block presets require `block_order` arrays
