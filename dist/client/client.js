"use strict";
//MCP CLIENT
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/client/stdio.js");
class HealthCarerMCPClient {
    constructor() {
        this.client = new index_js_1.Client({
            name: 'healthcarer-client',
            version: '1.0.0',
        });
        // Create transport with server parameters and inherit environment
        this.transport = new stdio_js_1.StdioClientTransport({
            command: 'node',
            args: ['dist/src/server.js'],
            env: {
                ...process.env, // Inherit all environment variables
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
        }
        catch (error) {
            console.error('Error initializing time slots:', error);
        }
    }
    async getAvailability(carer_id, date) {
        try {
            const result = await this.client.callTool({
                name: 'get_availability',
                arguments: { carer_id, date }
            });
            if (Array.isArray(result.content) && result.content.length > 0) {
                const contentItem = result.content[0];
                if (contentItem && typeof contentItem === 'object' && 'text' in contentItem) {
                    const availability = JSON.parse(contentItem.text);
                    console.log('Availability:', availability);
                    return availability;
                }
            }
            return [];
        }
        catch (error) {
            console.error('Error getting availability:', error);
            return [];
        }
    }
    async bookAppointment(carer_id, date, time_slot, person_name) {
        try {
            const result = await this.client.callTool({
                name: 'book_appointment',
                arguments: { carer_id, date, time_slot, person_name }
            });
            if (Array.isArray(result.content) && result.content.length > 0) {
                const contentItem = result.content[0];
                if (contentItem && typeof contentItem === 'object' && 'text' in contentItem) {
                    const bookingResult = JSON.parse(contentItem.text);
                    console.log('Booking Result:', bookingResult);
                    return bookingResult;
                }
            }
            return { success: false, message: 'No response received' };
        }
        catch (error) {
            console.error('Error booking appointment:', error);
            return { success: false, message: 'Error occurred' };
        }
    }
    async cancelAppointment(carer_id, date, time_slot) {
        try {
            const result = await this.client.callTool({
                name: 'cancel_appointment',
                arguments: { carer_id, date, time_slot }
            });
            if (Array.isArray(result.content) && result.content.length > 0) {
                const contentItem = result.content[0];
                if (contentItem && typeof contentItem === 'object' && 'text' in contentItem) {
                    const cancelResult = JSON.parse(contentItem.text);
                    console.log('Cancel Result:', cancelResult);
                    return cancelResult;
                }
            }
            return { success: false, message: 'No response received' };
        }
        catch (error) {
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
    }
    catch (error) {
        console.error('Client Error:', error);
    }
    finally {
        await client.close();
    }
}
if (require.main === module) {
    main();
}
