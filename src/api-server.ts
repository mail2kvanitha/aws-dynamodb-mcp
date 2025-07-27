import express from 'express';
import { HealthCarerDynamoDB } from './dynamodb-client';
import { BookingRequest, AvailabilityQuery } from './types';
import path from 'path';

const app = express();
const db = new HealthCarerDynamoDB();
const port = 3000;

// Basic middleware
app.use(express.json());

app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Initialize time slots
app.post('/api/initialize', async (req, res) => {
  try {
    await db.initializeTimeSlots();
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

//frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

// Get availability
app.get('/api/availability', async (req, res) => {
  try {
    const { carer_id, date } = req.query;
    
    const query: AvailabilityQuery = {
      carer_id: carer_id as string,
      date: date as string
    };

    const availability = await db.getAvailability(query);
    res.json({ success: true, data: availability });
  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Book appointment
app.post('/api/book', async (req, res) => {
  try {
    const { carer_id, date, time_slot, person_name } = req.body;

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

    const result = await db.bookAppointment(booking);
    
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
app.delete('/api/cancel', async (req, res) => {
  try {
    const { carer_id, date, time_slot } = req.body;

    if (!carer_id || !date || !time_slot) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: carer_id, date, time_slot'
      });
    }

    const result = await db.cancelAppointment(carer_id, date, time_slot);
    
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

// Get carers
app.get('/api/carers', (req, res) => {
  res.json({
    success: true,
    data: ['Carer1', 'Carer2', 'Carer3']
  });
});

// Start server
app.listen(port, () => {
  console.log(`HealthCarer API Server running on http://localhost:${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`Test with: curl http://localhost:${port}/health`);
});