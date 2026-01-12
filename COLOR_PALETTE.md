# Color Palette Reference

This document captures the current color scheme used in the PM Dashboard application.

## Primary Colors (Vivaro Blue)

The application uses a blue-based primary color palette:

- `--primary-50`: `#e3f2fd` (Lightest blue)
- `--primary-100`: `#bbdefb`
- `--primary-200`: `#90caf9`
- `--primary-300`: `#64b5f6`
- `--primary-400`: `#42A5F5`
- `--primary-500`: `#1565C0` (Main primary color)
- `--primary-600`: `#0d47a1`
- `--primary-700`: `#0a3d91`
- `--primary-800`: `#083278`
- `--primary-900`: `#051f4d` (Darkest blue)

## Neutral Colors (Gray Scale)

- `--gray-50`: `#f9fafb` (Lightest gray)
- `--gray-100`: `#f3f4f6`
- `--gray-200`: `#e5e7eb`
- `--gray-300`: `#d1d5db`
- `--gray-400`: `#9ca3af`
- `--gray-500`: `#6b7280`
- `--gray-600`: `#4b5563`
- `--gray-700`: `#374151`
- `--gray-800`: `#1f2937`
- `--gray-900`: `#111827` (Darkest gray)

## Semantic Colors

### Success
- `--success`: `#10b981` (Green)
- `--success-light`: `#d1fae5` (Light green background)

### Warning
- `--warning`: `#f59e0b` (Amber/Orange)
- `--warning-light`: `#fef3c7` (Light amber background)

### Error
- `--error`: `#ef4444` (Red)
- `--error-light`: `#fee2e2` (Light red background)

### Info
- `--info`: `#3b82f6` (Blue)
- `--info-light`: `#dbeafe` (Light blue background)

## Special Colors

### Header Background
- Gradient: `linear-gradient(135deg, #1a3a52 0%, #2d5a7a 100%)`
- Solid fallback: `#1a3a52`

### Body Background
- Gradient: `linear-gradient(135deg, #f5f7fa 0%, #e8edf2 100%)`

### White
- `#ffffff` (Used for cards, buttons, and backgrounds)

### Additional Error Shades
- `#dc2626` (Darker red for hover states)
- `#b91c1c` (Even darker red for active states)

## Usage Patterns

### Gradients
- Primary buttons: `linear-gradient(135deg, var(--primary-500) 0%, var(--primary-400) 100%)`
- Primary buttons hover: `linear-gradient(135deg, var(--primary-600) 0%, var(--primary-500) 100%)`
- Error buttons: `linear-gradient(135deg, var(--error) 0%, #dc2626 100%)`
- Header: `linear-gradient(135deg, #1a3a52 0%, #2d5a7a 100%)`

### Shadows
- `--shadow-xs`: `0 1px 2px 0 rgba(0, 0, 0, 0.05)`
- `--shadow-sm`: `0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)`
- `--shadow-md`: `0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)`
- `--shadow-lg`: `0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)`
- `--shadow-xl`: `0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)`
- `--shadow-2xl`: `0 25px 50px -12px rgba(0, 0, 0, 0.25)`

## Color Definitions Location

All color variables are defined in: `src/index.css` (in the `:root` selector)

## Last Updated

Documented on: Current session