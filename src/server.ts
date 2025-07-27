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