# Metrox TaxInvoo Backend

## Setup

1. Install dependencies
   npm install

2. Configure env
   cp .env.example .env

3. Run
   npm run dev

## Required request headers

- `x-business-id`: current tenant business id
- `x-user-id`: current authenticated user id (owner or permitted user)
