# DatabaseMapper — Frontend

## Project Overview

DatabaseMapper is a web application for documenting mappings between database schemas and service model objects. It is part of a two-component solution aimed at automating test data retrieval for QA automation testers.

This repository contains the **React frontend** of the web application.

## Goals

- Allow BAs/developers to connect to database instances and visually create mappings between DB columns and model fields
- Allow users to load Swagger/OpenAPI specs to auto-discover model structures
- Allow users to export mapping metadata as compact files
- Provide a clean, structured UI that enforces consistency (replacing ad-hoc Excel-based documentation)

## Target Users

- **Business Analysts** — document database-to-model mappings through a visual interface
- **QA Automation Testers** — consume the mappings via the Java library to simplify test assertions
- **Technical Leads** — get visibility into service-database dependencies
- **New Team Members** — understand data flow when onboarding

## Tech Stack

- **Framework**: React
- **UI Components**: Ant Design
- **Build Tool**: Vite
- **Language**: TypeScript

## Backend

The frontend communicates with a Spring Boot backend (separate repository) via REST API. The backend handles:
- Database connection management
- Swagger/OpenAPI spec parsing
- Mapping persistence
- Metadata file export
- Model hydration API endpoints

## Key Features to Implement

1. **Database Connection Manager** — UI for adding/editing/removing database connections
2. **Mapping Editor** — visual drag-and-drop or dropdown-based interface for mapping DB columns to model fields
3. **Swagger Import** — load OpenAPI specs to auto-discover model structures
4. **Metadata Export** — download mapping metadata as compact files

## Out of Scope (for now)

- Complex JOIN operations and multi-table aggregations
- NoSQL database support
- Code generation for ORMs
- Support for languages other than Java in the library

## Conventions

- Component files use PascalCase: `MappingEditor.jsx`
- Utility/helper files use camelCase: `apiClient.js`
- Keep components small and focused — extract logic into hooks where possible
- API calls go through a dedicated service layer, not directly in components

## Related Repositories

- `databasemapper-backend` — Spring Boot backend
- `databasemapper-library` — Java library for test automation (distributed via Maven)