import express from 'express';
import cors from 'cors';
import { HealthCarerDynamoDB } from '../src/dynamodb-client';
import { BookingRequest, AvailabilityQuery } from '../src/types';

class HealthCarerAPIServer {
  private app: express.Application;
  private db: HealthCarerDynamoDB;
  private port: number;

  constructor(port: number = 3000) {
    this.app = express();
    this.port = port;
    this.db = new HealthCarerDynamoDB();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    // Security middleware
    this.app.use(cors());
    


    // Body parsing
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'OK', timestamp: new Date().toISOString() });
    });

    // Initialize time slots
    this.app.post('/api/initialize', async (req, res) => {
      try {
        await this.db.initializeTimeSlots();
        res.json({ 
          success: true, 
          message: 'Time slots initialized successfully' 
        });
      } catch (error) {
        console.error('Initialize error:', error);
        res.status(500).json({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });

    // Get availability
    this.app.get('/api/availability', async (req, res) => {
      try {
        const { carer_id, date } = req.query;
        
        const query: AvailabilityQuery = {
          carer_id: carer_id as string,
          date: date as string
        };

        const availability = await this.db.getAvailability(query);
        res.json({ success: true, data: availability });
      } catch (error) {
        console.error('Get availability error:', error);
        res.status(500).json({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });

    // Get availability for specific carer and date
    this.app.get('/api/availability/:carer_id/:date', async (req, res) => {
      try {
        const { carer_id, date } = req.params;
        
        const query: AvailabilityQuery = { carer_id, date };
        const availability = await this.db.getAvailability(query);
        
        res.json({ success: true, data: availability });
      } catch (error) {
        console.error('Get specific availability error:', error);
        res.status(500).json({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });

    // Book appointment
    this.app.post('/api/book', async (req, res) => {
      try {
        const { carer_id, date, time_slot, person_name } = req.body;

        // Validation
        if (!carer_id || !date || !time_slot || !person_name) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: carer_id, date, time_slot, person_name'
          });
        }

        const booking: BookingRequest = {
          carer_id,
          date,
          time_slot,
          person_name
        };

        const result = await this.db.bookAppointment(booking);
        
        if (result.success) {
          res.json(result);
        } else {
          res.status(400).json(result);
        }
      } catch (error) {
        console.error('Book appointment error:', error);
        res.status(500).json({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });

    // Cancel appointment
    this.app.delete('/api/cancel', async (req, res) => {
      try {
        const { carer_id, date, time_slot } = req.body;

        // Validation
        if (!carer_id || !date || !time_slot) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: carer_id, date, time_slot'
          });
        }

        const result = await this.db.cancelAppointment(carer_id, date, time_slot);
        
        if (result.success) {
          res.json(result);
        } else {
          res.status(400).json(result);
        }
      } catch (error) {
        console.error('Cancel appointment error:', error);
        res.status(500).json({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });

    // Get all carers
    this.app.get('/api/carers', (req, res) => {
      res.json({
        success: true,
        data: ['Carer1', 'Carer2', 'Carer3']
      });
    });

    // Get available dates
    this.app.get('/api/dates', (req, res) => {
      res.json({
        success: true,
        data: ['20250725', '20250726', '20250727']
      });
    });

    // Get time slots
    this.app.get('/api/timeslots', (req, res) => {
      const slots = [];
      for (let hour = 9; hour <= 15; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const timeString = `${hour.toString().padStart(2, '0')}${minute.toString().padStart(2, '0')}`;
          const displayTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          slots.push({ value: timeString, display: displayTime });
        }
      }
      res.json({ success: true, data: slots });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({ 
        success: false, 
        error: 'Endpoint not found' 
      });
    });

    // Error handler
    this.app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Unhandled error:', err);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
      });
    });
  }

  public start() {
    this.app.listen(this.port, () => {
      console.log(`HealthCarer API Server running on http://localhost:${this.port}`);
      console.log(`Health check: http://localhost:${this.port}/health`);
      console.log(`API Documentation: http://localhost:${this.port}/api/docs`);
    });
  }
}

// Start the server
const server = new HealthCarerAPIServer(3000);
server.start();