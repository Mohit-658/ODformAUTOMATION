# ODformAUTOMATION

ODformAUTOMATION is a web application designed to automate the process of submitting and managing OD (On-Duty) forms, streamlining workflows for students and administrators. It provides a user-friendly interface to facilitate requests, approvals, and record-keeping.

## Tech Stack

- **Frontend:** Next.js, React, TypeScript
- **Backend:** Firebase (Authentication, Firestore Database)
- **Styling:** Tailwind CSS
- **Deployment:** Vercel

## Features

- **Automated OD Form Submission:** Easily fill and submit OD forms online.
- **Admin Dashboard:** Manage, approve, or reject OD requests efficiently.
- **Firebase Integration:** Secure authentication and real-time data management.
- **Responsive Design:** Optimized for desktop and mobile devices.
- **Custom Components:** Modular architecture for easy maintenance and extensibility.

## Live Demo

Visit the live application: [ODformAUTOMATION](https://o-dform-automation.vercel.app)

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- PNPM (or npm/yarn)
- Firebase Project (for authentication and database)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Mohit-658/ODformAUTOMATION.git
   cd ODformAUTOMATION
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Configure Firebase:**
   - Update your Firebase credentials in the config files.

4. **Run the development server:**
   ```bash
   pnpm dev
   ```
   The app will be available at `http://localhost:3000`.

## Project Structure

- `/app` - Main application logic and pages
- `/components` - Reusable UI components
- `/firebase` - Firebase configuration and helpers
- `/hooks` - Custom React hooks
- `/lib` - Utility libraries
- `/public` - Static assets
- `/styles` - CSS/SCSS files

## Contributing

Contributions are welcome! Please open issues or pull requests for improvements or bug fixes.

## License

This project currently does not specify a license.

## Author

- [Mohit-658](https://github.com/Mohit-658)
