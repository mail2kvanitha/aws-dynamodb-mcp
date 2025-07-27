"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const dynamodb_client_1 = require("./dynamodb-client");
class HealthCarerMCPServer {
    constructor() {
        this.server = new index_js_1.Server({
            name: 'healthcarer-dynamodb-server',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {}
            }
        });
        this.db = new dynamodb_client_1.HealthCarerDynamoDB();
        this.setupHandlers();
    }
    setupHandlers() {
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
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
                ]
            };
        });
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
            try {
                const { name, arguments: args } = request.params;
                switch (name) {
                    case 'get_availability':
                        const query = {
                            carer_id: args?.carer_id,
                            date: args?.date
                        };
                        const availability = await this.db.getAvailability(query);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(availability, null, 2)
                                }
                            ]
                        };
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
                        const booking = {
                            carer_id: args.carer_id,
                            date: args.date,
                            time_slot: args.time_slot,
                            person_name: args.person_name
                        };
                        const bookingResult = await this.db.bookAppointment(booking);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(bookingResult, null, 2)
                                }
                            ]
                        };
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
                        const cancelResult = await this.db.cancelAppointment(args.carer_id, args.date, args.time_slot);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(cancelResult, null, 2)
                                }
                            ]
                        };
                    case 'initialize_time_slots':
                        await this.db.initializeTimeSlots();
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: 'Time slots initialized successfully'
                                }
                            ]
                        };
                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({ error: errorMessage }, null, 2)
                        }
                    ],
                    isError: true
                };
            }
        });
    }
    async run() {
        const transport = new stdio_js_1.StdioServerTransport();
        await this.server.connect(transport);
        console.error('HealthCarer MCP Server running on stdio');
    }
}
const server = new HealthCarerMCPServer();
server.run().catch(console.error);
