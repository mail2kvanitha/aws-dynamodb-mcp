# HealthCarer DynamoDB MCP Server & Client Guide

## Overview

This guide will help you create an MCP (Model Context Protocol) server for managing healthcare appointments with DynamoDB backend, and a client to interact with it.

## Table Schema Design

### DynamoDB Table: `healthcarer-appointments`

**Primary Key Structure:**

- **Partition Key (PK):** `carer_id` (String) - e.g., "Carer1", "Carer2", "Carer3"
- **Sort Key (SK):** `date_time_slot` (String) - e.g., "20250725#0900", "20250725#0930"

**Attributes:**

- `availability` (String) - "Free" or "Booked"
- `booking_person_name` (String) - Name of person who booked (only if booked)
- `date` (String) - "20250725", "20250726", "20250727"
- `time_slot` (String) - "0900", "0930", "1000", etc.

## Step 1: Set up the Project Structure

```text
healthcarer-mcp/
├── package.json
├── src/
│   ├── server.ts
│   ├── dynamodb-client.ts
│   └── types.ts
├── client/
│   └── client.ts
└── README.md
```

## Step 2: Initialize the Project

```bash
mkdir healthcarer-mcp
cd healthcarer-mcp
npm init -y
npm install @modelcontextprotocol/sdk@latest @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb typescript @types/node ts-node
```

## Step 3: Create TypeScript Configuration

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": false,
    "sourceMap": false
  },
  "include": ["src/**/*", "client/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Step 4: Create Types Definition

Create `src/types.ts`:

```typescript
export interface TimeSlot {
  carer_id: string;
  date_time_slot: string;
  availability: 'Free' | 'Booked';
  booking_person_name?: string;
  date: string;
  time_slot: string;
}

export interface BookingRequest {
  carer_id: string;
  date: string;
  time_slot: string;
  person_name: string;
}

export interface AvailabilityQuery {
  carer_id?: string;
  date?: string;
}
```

## Step 5: Create DynamoDB Client

Create `src/dynamodb-client.ts`:

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { TimeSlot, BookingRequest, AvailabilityQuery } from './types';

export class HealthCarerDynamoDB {
  private docClient: DynamoDBDocumentClient;
  private tableName = 'healthcarer-appointments';

  constructor() {
    // Use the default credential provider chain which will automatically
    // pick up credentials from ~/.aws/credentials, environment variables, 
    // or IAM roles
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1'
    });
    this.docClient = DynamoDBDocumentClient.from(client);
  }

  async initializeTimeSlots(): Promise<void> {
    const carers = ['Carer1', 'Carer2', 'Carer3'];
    const dates = ['20250725', '20250726', '20250727'];
    const timeSlots = this.generateTimeSlots();

    const promises = [];
    
    for (const carer of carers) {
      for (const date of dates) {
        for (const timeSlot of timeSlots) {
          const item: TimeSlot = {
            carer_id: carer,
            date_time_slot: `${date}#${timeSlot}`,
            availability: 'Free',
            date: date,
            time_slot: timeSlot
          };

          promises.push(
            this.docClient.send(new PutCommand({
              TableName: this.tableName,
              Item: item,
              ConditionExpression: 'attribute_not_exists(carer_id)'
            })).catch(() => {
              // Ignore if item already exists
            })
          );
        }
      }
    }

    await Promise.all(promises);
  }

  private generateTimeSlots(): string[] {
    const slots = [];
    for (let hour = 9; hour <= 15; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}${minute.toString().padStart(2, '0')}`;
        slots.push(timeString);
      }
    }
    return slots;
  }

  async getAvailability(query: AvailabilityQuery): Promise<TimeSlot[]> {
    if (query.carer_id && query.date) {
      // Query specific carer and date
      const response = await this.docClient.send(new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'carer_id = :carer_id AND begins_with(date_time_slot, :date)',
        ExpressionAttributeValues: {
          ':carer_id': query.carer_id,
          ':date': query.date
        }
      }));
      return response.Items as TimeSlot[];
    } else if (query.carer_id) {
      // Query specific carer, all dates
      const response = await this.docClient.send(new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'carer_id = :carer_id',
        ExpressionAttributeValues: {
          ':carer_id': query.carer_id
        }
      }));
      return response.Items as TimeSlot[];
    } else {
      // Scan all items (be careful with large datasets)
      const response = await this.docClient.send(new ScanCommand({
        TableName: this.tableName
      }));
      return response.Items as TimeSlot[];
    }
  }

  async bookAppointment(booking: BookingRequest): Promise<{ success: boolean; message: string }> {
    const dateTimeSlot = `${booking.date}#${booking.time_slot}`;
    
    try {
      await this.docClient.send(new UpdateCommand({
        TableName: this.tableName,
        Key: {
          carer_id: booking.carer_id,
          date_time_slot: dateTimeSlot
        },
        UpdateExpression: 'SET availability = :booked, booking_person_name = :person_name',
        ConditionExpression: 'availability = :free',
        ExpressionAttributeValues: {
          ':booked': 'Booked',
          ':free': 'Free',
          ':person_name': booking.person_name
        }
      }));

      return { success: true, message: 'Appointment booked successfully' };
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        return { success: false, message: 'Time slot is already booked or does not exist' };
      }
      throw error;
    }
  }

  async cancelAppointment(carer_id: string, date: string, time_slot: string): Promise<{ success: boolean; message: string }> {
    const dateTimeSlot = `${date}#${time_slot}`;
    
    try {
      await this.docClient.send(new UpdateCommand({
        TableName: this.tableName,
        Key: {
          carer_id: carer_id,
          date_time_slot: dateTimeSlot
        },
        UpdateExpression: 'SET availability = :free REMOVE booking_person_name',
        ConditionExpression: 'availability = :booked',
        ExpressionAttributeValues: {
          ':free': 'Free',
          ':booked': 'Booked'
        }
      }));

      return { success: true, message: 'Appointment cancelled successfully' };
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        return { success: false, message: 'No booking found for this time slot' };
      }
      throw error;
    }
  }
}
```

## Step 6: Create MCP Server

Create `src/server.ts`:
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolResult,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { HealthCarerDynamoDB } from './dynamodb-client';
import { BookingRequest, AvailabilityQuery } from './types';

class HealthCarerMCPServer {
  private server: Server;
  private db: HealthCarerDynamoDB;

  constructor() {
    this.server = new Server({
      name: 'healthcarer-dynamodb-server',
      version: '1.0.0',
    }, {
      capabilities: {
        tools: {}
      }
    });

    this.db = new HealthCarerDynamoDB();
    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_availability',
            description: 'Get availability for carers',
            inputSchema: {
              type: 'object',
              properties: {
                carer_id: { type: 'string', description: 'Specific carer ID (optional)' },
                date: { type: 'string', description: 'Date in YYYYMMDD format (optional)' }
              }
            }
          },
          {
            name: 'book_appointment',
            description: 'Book an appointment with a carer',
            inputSchema: {
              type: 'object',
              properties: {
                carer_id: { type: 'string', description: 'Carer ID' },
                date: { type: 'string', description: 'Date in YYYYMMDD format' },
                time_slot: { type: 'string', description: 'Time slot in HHMM format' },
                person_name: { type: 'string', description: 'Name of person booking' }
              },
              required: ['carer_id', 'date', 'time_slot', 'person_name']
            }
          },
          {
            name: 'cancel_appointment',
            description: 'Cancel an appointment',
            inputSchema: {
              type: 'object',
              properties: {
                carer_id: { type: 'string', description: 'Carer ID' },
                date: { type: 'string', description: 'Date in YYYYMMDD format' },
                time_slot: { type: 'string', description: 'Time slot in HHMM format' }
              },
              required: ['carer_id', 'date', 'time_slot']
            }
          },
          {
            name: 'initialize_time_slots',
            description: 'Initialize all time slots in the database',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          }
        ] as Tool[]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case 'get_availability':
            const query: AvailabilityQuery = {
              carer_id: args?.carer_id as string,
              date: args?.date as string
            };
            const availability = await this.db.getAvailability(query);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(availability, null, 2)
                }
              ]
            } as CallToolResult;

          case 'book_appointment':
            if (!args || typeof args !== 'object') {
              throw new Error('Invalid arguments for book_appointment');
            }
            
            const requiredFields = ['carer_id', 'date', 'time_slot', 'person_name'];
            for (const field of requiredFields) {
              if (!(field in args) || typeof args[field] !== 'string') {
                throw new Error(`Missing or invalid required field: ${field}`);
              }
            }

            const booking: BookingRequest = {
              carer_id: args.carer_id as string,
              date: args.date as string,
              time_slot: args.time_slot as string,
              person_name: args.person_name as string
            };
            
            const bookingResult = await this.db.bookAppointment(booking);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(bookingResult, null, 2)
                }
              ]
            } as CallToolResult;

          case 'cancel_appointment':
            if (!args || typeof args !== 'object') {
              throw new Error('Invalid arguments for cancel_appointment');
            }
            
            const cancelRequiredFields = ['carer_id', 'date', 'time_slot'];
            for (const field of cancelRequiredFields) {
              if (!(field in args) || typeof args[field] !== 'string') {
                throw new Error(`Missing or invalid required field: ${field}`);
              }
            }

            const cancelResult = await this.db.cancelAppointment(
              args.carer_id as string,
              args.date as string,
              args.time_slot as string
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(cancelResult, null, 2)
                }
              ]
            } as CallToolResult;

          case 'initialize_time_slots':
            await this.db.initializeTimeSlots();
            return {
              content: [
                {
                  type: 'text',
                  text: 'Time slots initialized successfully'
                }
              ]
            } as CallToolResult;

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: errorMessage }, null, 2)
            }
          ],
          isError: true
        } as CallToolResult;
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('HealthCarer MCP Server running on stdio');
  }
}

const server = new HealthCarerMCPServer();
server.run().catch(console.error);
```

## Step 7: Create MCP Client

Create `client/client.ts`:
```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

class HealthCarerMCPClient {
  private client: Client;
  private transport: StdioClientTransport;

  constructor() {
    this.client = new Client({
      name: 'healthcarer-client',
      version: '1.0.0',
    });
    
    // Create transport with server parameters and inherit environment
    this.transport = new StdioClientTransport({
      command: 'node',
      args: ['dist/src/server.js'],
      env: {
        ...process.env,  // Inherit all environment variables
        AWS_REGION: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1'
      }
    });
  }

  async connect() {
    await this.client.connect(this.transport);
    console.log('Connected to HealthCarer MCP Server');
  }

  async initializeTimeSlots() {
    try {
      const result = await this.client.callTool({
        name: 'initialize_time_slots',
        arguments: {}
      });
      
      if (Array.isArray(result.content) && result.content.length > 0) {
        console.log('Initialize Result:', result.content[0]);
      }
    } catch (error) {
      console.error('Error initializing time slots:', error);
    }
  }

  async getAvailability(carer_id?: string, date?: string) {
    try {
      const result = await this.client.callTool({
        name: 'get_availability',
        arguments: { carer_id, date }
      });
      
      if (Array.isArray(result.content) && result.content.length > 0) {
        const contentItem = result.content[0];
        if (contentItem && typeof contentItem === 'object' && 'text' in contentItem) {
          const availability = JSON.parse(contentItem.text as string);
          console.log('Availability:', availability);
          return availability;
        }
      }
      return [];
    } catch (error) {
      console.error('Error getting availability:', error);
      return [];
    }
  }

  async bookAppointment(carer_id: string, date: string, time_slot: string, person_name: string) {
    try {
      const result = await this.client.callTool({
        name: 'book_appointment',
        arguments: { carer_id, date, time_slot, person_name }
      });
      
      if (Array.isArray(result.content) && result.content.length > 0) {
        const contentItem = result.content[0];
        if (contentItem && typeof contentItem === 'object' && 'text' in contentItem) {
          const bookingResult = JSON.parse(contentItem.text as string);
          console.log('Booking Result:', bookingResult);
          return bookingResult;
        }
      }
      return { success: false, message: 'No response received' };
    } catch (error) {
      console.error('Error booking appointment:', error);
      return { success: false, message: 'Error occurred' };
    }
  }

  async cancelAppointment(carer_id: string, date: string, time_slot: string) {
    try {
      const result = await this.client.callTool({
        name: 'cancel_appointment',
        arguments: { carer_id, date, time_slot }
      });
      
      if (Array.isArray(result.content) && result.content.length > 0) {
        const contentItem = result.content[0];
        if (contentItem && typeof contentItem === 'object' && 'text' in contentItem) {
          const cancelResult = JSON.parse(contentItem.text as string);
          console.log('Cancel Result:', cancelResult);
          return cancelResult;
        }
      }
      return { success: false, message: 'No response received' };
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      return { success: false, message: 'Error occurred' };
    }
  }

  async close() {
    await this.client.close();
  }
}

// Example usage
async function main() {
  const client = new HealthCarerMCPClient();
  
  try {
    await client.connect();

    // Initialize time slots
    console.log('=== Initializing Time Slots ===');
    await client.initializeTimeSlots();

    // Get all availability
    console.log('\n=== All Availability ===');
    await client.getAvailability();

    // Get availability for specific carer
    console.log('\n=== Carer1 Availability ===');
    await client.getAvailability('Carer1');

    // Get availability for specific date
    console.log('\n=== Today\'s Availability ===');
    await client.getAvailability(undefined, '20250725');

    // Book an appointment
    console.log('\n=== Booking Appointment ===');
    await client.bookAppointment('Carer1', '20250725', '0900', 'John Doe');

    // Check availability after booking
    console.log('\n=== Availability After Booking ===');
    await client.getAvailability('Carer1', '20250725');

    // Cancel appointment
    console.log('\n=== Cancelling Appointment ===');
    await client.cancelAppointment('Carer1', '20250725', '0900');

    // Check availability after cancellation
    console.log('\n=== Availability After Cancellation ===');
    await client.getAvailability('Carer1', '20250725');

  } catch (error) {
    console.error('Client Error:', error);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main();
}
```

## Alternative: Simple HTTP-based Client

If the stdio transport continues to cause issues, here's an HTTP-based alternative:

```typescript
// Simple HTTP client (no MCP SDK dependencies)
class SimpleHealthCarerClient {
  private baseUrl: string;

  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  async initializeTimeSlots() {
    const response = await fetch(`${this.baseUrl}/initialize`, { method: 'POST' });
    return response.json();
  }

  async getAvailability(carer_id?: string, date?: string) {
    const params = new URLSearchParams();
    if (carer_id) params.append('carer_id', carer_id);
    if (date) params.append('date', date);
    
    const response = await fetch(`${this.baseUrl}/availability?${params}`);
    return response.json();
  }

  async bookAppointment(carer_id: string, date: string, time_slot: string, person_name: string) {
    const response = await fetch(`${this.baseUrl}/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ carer_id, date, time_slot, person_name })
    });
    return response.json();
  }

  async cancelAppointment(carer_id: string, date: string, time_slot: string) {
    const response = await fetch(`${this.baseUrl}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ carer_id, date, time_slot })
    });
    return response.json();
  }
}
```

## Step 8: Setup Scripts and Build

Update `package.json`:
```json
{
  "name": "healthcarer-mcp",
  "version": "1.0.0",
  "description": "HealthCarer MCP Server with DynamoDB",
  "main": "dist/src/server.js",
  "type": "commonjs",
  "scripts": {
    "build": "tsc",
    "start": "node dist/src/server.js",
    "client": "node dist/client/client.js",
    "dev": "ts-node src/server.ts",
    "test-client": "ts-node client/client.ts",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest",
    "@aws-sdk/client-dynamodb": "^3.478.0",
    "@aws-sdk/lib-dynamodb": "^3.478.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0",
    "ts-node": "^10.9.0"
  }
}
```

## Step 9: AWS Setup

### Create DynamoDB Table
```bash
# Using AWS CLI
aws dynamodb create-table \
    --table-name healthcarer-appointments \
    --attribute-definitions \
        AttributeName=carer_id,AttributeType=S \
        AttributeName=date_time_slot,AttributeType=S \
    --key-schema \
        AttributeName=carer_id,KeyType=HASH \
        AttributeName=date_time_slot,KeyType=RANGE \
    --provisioned-throughput \
        ReadCapacityUnits=5,WriteCapacityUnits=5
```

### Set Environment Variables
```bash
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
```

## Step 10: Build and Run

```bash
# Build the project
npm run build

# Run the server (in one terminal)
npm start

# Run the client (in another terminal)
npm run client
```

## Usage Examples

### 1. Initialize Time Slots
```javascript
await client.initializeTimeSlots();
```

### 2. Get All Availability
```javascript
const availability = await client.getAvailability();
```

### 3. Get Specific Carer Availability
```javascript
const carerAvailability = await client.getAvailability('Carer1');
```

### 4. Get Availability for Specific Date
```javascript
const dateAvailability = await client.getAvailability(undefined, '20250725');
```

### 5. Book an Appointment
```javascript
const result = await client.bookAppointment('Carer1', '20250725', '0900', 'John Doe');
```

### 6. Cancel an Appointment
```javascript
const result = await client.cancelAppointment('Carer1', '20250725', '0900');
```

## Time Slot Format
- **Dates**: YYYYMMDD format (e.g., "20250725")
- **Time Slots**: HHMM format (e.g., "0900" for 9:00 AM, "1430" for 2:30 PM)
- **Available Times**: 9:00 AM to 4:00 PM in 30-minute intervals

## Error Handling
The system handles common scenarios:
- Attempting to book an already booked slot
- Cancelling a non-existent booking
- Invalid carer IDs or time slots
- AWS connectivity issues
