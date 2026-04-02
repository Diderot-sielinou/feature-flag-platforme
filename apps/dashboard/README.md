# LaunchLayer Dashboard

A modern, premium feature flags management dashboard built with Next.js 14, React, and Tailwind CSS.

## 🎨 Design System

### Color Palette
- **Obsidian** (`#0E0503`) - Primary dark background
- **Mahogany** (`#7C3805`) - Secondary accent
- **Tangerine** (`#D17303`) - Primary brand color
- **Amber** (`#E19547`) - Highlight color
- **Rust** (`#9B4F06`) - Tertiary accent

### Typography
- **Body**: DM Sans
- **Display/Headings**: Outfit
- **Code**: Geist Mono

### Design Philosophy
Premium artisanal aesthetic inspired by aged leather, noble wood, and warm metals. Dark mode by default with high contrast and subtle animations.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Backend API running (see `/apps/api-management`)

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Configure your environment variables
# - NEXT_PUBLIC_API_URL
# - NEXT_PUBLIC_COGNITO_USER_POOL_ID
# - NEXT_PUBLIC_COGNITO_CLIENT_ID

# Start development server
npm run dev
```

The dashboard will be available at `http://localhost:3002`.

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (marketing)/       # Public landing page
│   ├── auth/              # Authentication pages
│   │   ├── login/
│   │   ├── register/
│   │   ├── verify/
│   │   └── forgot-password/
│   └── dashboard/         # Authenticated dashboard
│       ├── flags/         # Feature flags management
│       ├── projects/      # Projects management
│       ├── segments/      # User segments
│       ├── schedules/     # Scheduled releases
│       ├── api-keys/      # API key management
│       ├── members/       # Team management
│       ├── audit/         # Audit logs
│       └── settings/      # Project settings
├── components/
│   ├── ui/               # Shadcn/UI components (customized)
│   ├── layout/           # Layout components
│   ├── features/         # Feature-specific components
│   ├── shared/           # Shared components
│   └── providers/        # React context providers
├── hooks/                # Custom React hooks
├── services/             # API services & configurations
├── stores/               # Zustand state management
├── types/                # TypeScript type definitions
├── lib/                  # Utilities and helpers
└── styles/               # Global styles and CSS
```

## 🧩 Components

### UI Components (Shadcn/UI Customized)
- `Button` - Multiple variants including "glow" effect
- `Input` - With icon support and error states
- `Card` - Interactive, elevated, and glass variants
- `Switch` - Multiple sizes with gradient checked state
- `Badge` - Environment badges, role badges, status badges
- `Dialog` - Modal with animations
- `Avatar` - Multiple sizes with fallback
- `DropdownMenu` - Context menus
- `Select` - Custom select dropdowns
- `Tabs` - Tab navigation
- `Tooltip` - Hover tooltips
- `Progress` - Progress bars with variants
- `Toast` - Toast notifications via Sonner

### Layout Components
- `Sidebar` - Collapsible navigation sidebar
- `Header` - Top navigation with search, notifications, user menu
- `DashboardLayout` - Main dashboard wrapper

## 🔧 Configuration

### Environment Variables

```env
# API
NEXT_PUBLIC_API_URL=http://localhost:3001

# AWS Cognito
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_xxx
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxx
```

### Tailwind Configuration
Custom Tailwind config with:
- Extended color palette with brand colors
- Custom animations (20+ animations)
- Custom shadows (glow effects, elevations)
- Custom typography scale
- Responsive breakpoints

## 📦 Dependencies

### Core
- Next.js 14 (App Router)
- React 18
- TypeScript

### UI & Styling
- Tailwind CSS
- Radix UI Primitives
- Framer Motion
- Lucide React Icons
- class-variance-authority
- tailwind-merge

### State & Data
- TanStack React Query
- Zustand
- React Hook Form
- Zod validation

### Authentication
- AWS Amplify (Cognito)

### Utilities
- Axios
- date-fns
- Sonner (toasts)

## 🎯 Features

### Authentication
- Email/password login
- Registration with email verification
- Forgot password flow
- Protected routes

### Dashboard
- Overview with stats and activity feed
- Project management
- Feature flags with environment toggles
- User segments with targeting rules
- Scheduled releases
- API key management
- Team member management with roles
- Complete audit logging
- Project settings

### UX Features
- Dark mode by default
- Responsive design
- Keyboard shortcuts
- Toast notifications
- Loading states
- Empty states
- Error handling

## 🛠 Development

### Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript compiler
```

### Code Style
- ESLint with Next.js config
- Prettier for formatting
- TypeScript strict mode

## 📝 License

Proprietary - LaunchLayer
