
# High Level Overview

You have TWO different systems working together:
🔧 MCP Server/Client Setup

MCP Server: src/server.ts - Handles MCP protocol tools
MCP Client: client/client.ts - Connects via stdio to call MCP tools
Purpose: For AI assistants ike Claude, Nova, or custom AI agents and programmatic access via MCP protocol

🌐 REST API Server + Web Frontend

REST API Server: src/api-server.ts - Standard HTTP REST endpoints
Web Frontend: public/index.html - Beautiful HTML interface
Purpose: For web browsers, mobile apps, and standard HTTP clients.
Perfect for humans using web browsers or mobile apps

Yes, Both Access the Same Data!
Both systems use the same HealthCarerDynamoDB class, so they share the same appointment data.
You could use either:

MCP Client → MCP Server → DynamoDB (for AI agents)
Web Browser → REST API → DynamoDB (for humans)

## The Relationship

┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   HTML Frontend │───▶│   REST API       │───▶│   DynamoDB      │
│   (Browser)     │    │   Server         │    │   Database      │
└─────────────────┘    │   (Express.js)   │    └─────────────────┘
                       └──────────────────┘              ▲
                                                         │
┌─────────────────┐    ┌──────────────────┐              │
│   MCP Client    │───▶│   MCP Server     │──────────────┘
│   (AI Tools)    │    │   (MCP Protocol) │
└─────────────────┘    └──────────────────┘



## Features of the Frontend

### ✨ Beautiful UI

Modern gradient design
Responsive layout
Mobile-friendly
Smooth animations

### 📅 Availability Checking

Filter by carer and/or date
Visual time slot grid
Statistics (total, available, booked slots)
Grouped by carer and date

### 📝 Easy Booking

Click any free slot to book
Simple form with name input
Instant confirmation

### ❌ Appointment Cancellation

Dedicated cancellation section
Dropdown selections for easy use

### 📊 Real-time Updates

Instant status messages
Auto-refresh after booking/cancelling
Color-coded time slots (green=free, red=booked)

### Testing the Frontend

Initialize: Click "Initialize Time Slots" first
Check Availability: Select filters and click "Check Availability"
Book: Click any green time slot, enter your name, confirm
Cancel: Use the cancellation form on the right