"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthCarerDynamoDB = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
class HealthCarerDynamoDB {
    constructor() {
        this.tableName = 'healthcarer-appointments';
        // Use the default credential provider chain which will automatically
        // pick up credentials from ~/.aws/credentials, environment variables, 
        // or IAM roles
        const client = new client_dynamodb_1.DynamoDBClient({
            region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1'
        });
        this.docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
    }
    async initializeTimeSlots() {
        const carers = ['Carer1', 'Carer2', 'Carer3'];
        const dates = ['20250725', '20250726', '20250727'];
        const timeSlots = this.generateTimeSlots();
        const promises = [];
        for (const carer of carers) {
            for (const date of dates) {
                for (const timeSlot of timeSlots) {
                    const item = {
                        carer_id: carer,
                        date_time_slot: `${date}#${timeSlot}`,
                        availability: 'Free',
                        date: date,
                        time_slot: timeSlot
                    };
                    promises.push(this.docClient.send(new lib_dynamodb_1.PutCommand({
                        TableName: this.tableName,
                        Item: item,
                        ConditionExpression: 'attribute_not_exists(carer_id)'
                    })).catch(() => {
                        // Ignore if item already exists
                    }));
                }
            }
        }
        await Promise.all(promises);
    }
    generateTimeSlots() {
        const slots = [];
        for (let hour = 9; hour <= 15; hour++) {
            for (let minute = 0; minute < 60; minute += 30) {
                const timeString = `${hour.toString().padStart(2, '0')}${minute.toString().padStart(2, '0')}`;
                slots.push(timeString);
            }
        }
        return slots;
    }
    async getAvailability(query) {
        if (query.carer_id && query.date) {
            // Query specific carer and date
            const response = await this.docClient.send(new lib_dynamodb_1.QueryCommand({
                TableName: this.tableName,
                KeyConditionExpression: 'carer_id = :carer_id AND begins_with(date_time_slot, :date)',
                ExpressionAttributeValues: {
                    ':carer_id': query.carer_id,
                    ':date': query.date
                }
            }));
            return response.Items;
        }
        else if (query.carer_id) {
            // Query specific carer, all dates
            const response = await this.docClient.send(new lib_dynamodb_1.QueryCommand({
                TableName: this.tableName,
                KeyConditionExpression: 'carer_id = :carer_id',
                ExpressionAttributeValues: {
                    ':carer_id': query.carer_id
                }
            }));
            return response.Items;
        }
        else {
            // Scan all items (be careful with large datasets)
            const response = await this.docClient.send(new lib_dynamodb_1.ScanCommand({
                TableName: this.tableName
            }));
            return response.Items;
        }
    }
    async bookAppointment(booking) {
        const dateTimeSlot = `${booking.date}#${booking.time_slot}`;
        try {
            await this.docClient.send(new lib_dynamodb_1.UpdateCommand({
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
        }
        catch (error) {
            if (error.name === 'ConditionalCheckFailedException') {
                return { success: false, message: 'Time slot is already booked or does not exist' };
            }
            throw error;
        }
    }
    async cancelAppointment(carer_id, date, time_slot) {
        const dateTimeSlot = `${date}#${time_slot}`;
        try {
            await this.docClient.send(new lib_dynamodb_1.UpdateCommand({
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
        }
        catch (error) {
            if (error.name === 'ConditionalCheckFailedException') {
                return { success: false, message: 'No booking found for this time slot' };
            }
            throw error;
        }
    }
}
exports.HealthCarerDynamoDB = HealthCarerDynamoDB;
