# Amity Coding Club OD Form

A modern, interactive OD (On Duty) form submission system built with Next.js and React.

## Features

- Single entry form with dynamic subject selection
- Multiple entry with file upload (CSV/Spreadsheet)
- Typewriter animations
- Responsive design with Tailwind CSS
- Custom fonts (Grandiflora One, JURA)

## Getting Started

### Prerequisites

- Node.js 18.17 or later
- npm, yarn, or pnpm

### Installation

1. Clone or download the project
2. Install dependencies:

\`\`\`bash
npm install
# or
yarn install
# or
pnpm install
\`\`\`

3. Create the public/images directory and add the ACC logo:
\`\`\`bash
mkdir -p public/images
\`\`\`
Add your `acc-logo.png` file to the `public/images/` directory.

4. Run the development server:

\`\`\`bash
npm run dev
# or
yarn dev
# or
pnpm dev
\`\`\`

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

- `app/` - Next.js app router pages and layouts
- `components/` - Reusable React components
- `lib/` - Utility functions
- `public/` - Static assets

## Technologies Used

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS v4
- Radix UI components
- Lucide React icons
