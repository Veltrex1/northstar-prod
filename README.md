# Northstar - Virtual Chief AI Officer

Your company's second brain powered by AI.

## Features

- **Knowledge Bank**: Ingests all company data from multiple sources
- **AI Chatbot**: Answers questions using company knowledge
- **Email Intelligence**: Learns your writing style and drafts emails
- **Board Reports**: Generates comprehensive reports automatically
- **Multi-Platform Integrations**: Google, Microsoft, Slack, CRM, Accounting

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Supabase (Auth + Database)
- Prisma ORM
- Claude AI (Anthropic)
- Pinecone (Vector Database)
- TailwindCSS + Shadcn/ui

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env.local` and fill in values
4. Run database migrations: `npm run db:push`
5. Start development server: `npm run dev`

## Project Structure

- `/src/app` - Next.js pages and API routes
- `/src/components` - React components
- `/src/lib` - Utility functions and integrations
- `/src/hooks` - React hooks
- `/src/types` - TypeScript type definitions
- `/prisma` - Database schema and migrations

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run db:studio` - Open Prisma Studio
- `npm run db:migrate` - Create a new migration

## License

Proprietary - Veltrex Solutions
