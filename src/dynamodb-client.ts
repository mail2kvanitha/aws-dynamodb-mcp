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
    const carers = ['Doctor1', 'Doctor2', 'doctor3'];
    const dates = ['20250728', '20250729', '20250730'];
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