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