# Azure Todo App

A full-stack Todo application built with React, Node.js, Express, and PostgreSQL, designed for deployment to Azure App Service.

## Features

- Create, read, update, and delete todos
- Mark todos as complete/incomplete
- Modern Material-UI interface
- PostgreSQL database backend
- Ready for Azure deployment

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- PostgreSQL database
- Azure account

## Local Development Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   cd client
   npm install
   ```

3. Create a PostgreSQL database and run the schema:
   - Create a new database
   - Run the SQL commands in `database.sql`

4. Create a `.env` file in the root directory with:
   ```
   PORT=5000
   DATABASE_URL=your_postgresql_connection_string
   ```

5. Start the development server:
   ```bash
   # In the root directory
   npm run dev
   ```

## Deployment to Azure

1. Create an Azure App Service
2. Create an Azure PostgreSQL database
3. Set up the following environment variables in Azure App Service Configuration:
   - `DATABASE_URL`: Your Azure PostgreSQL connection string
   - `NODE_ENV`: "production"

4. Deploy to Azure using Azure CLI or GitHub Actions:
   ```bash
   # Using Azure CLI
   az webapp up --name your-app-name --resource-group your-resource-group
   ```

## Project Structure

- `/client` - React frontend
- `server.js` - Express backend
- `database.sql` - Database schema
- `.env` - Environment variables (local development)

## API Endpoints

- GET `/api/todos` - Get all todos
- POST `/api/todos` - Create a new todo
- PUT `/api/todos/:id` - Update a todo
- DELETE `/api/todos/:id` - Delete a todo

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request 