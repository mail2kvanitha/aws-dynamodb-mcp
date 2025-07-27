#!/bin/bash

echo "🚀 HealthCarer API Tests with curl"
echo "=================================="

BASE_URL="http://localhost:3000/api"

echo -e "\n1. Health Check"
curl -s -X GET http://localhost:3000/health | jq '.'

echo -e "\n2. Initialize Time Slots"
curl -s -X POST $BASE_URL/initialize | jq '.'

echo -e "\n3. Get All Carers"
curl -s -X GET $BASE_URL/carers | jq '.'

echo -e "\n4. Get Available Dates"
curl -s -X GET $BASE_URL/dates | jq '.'

echo -e "\n5. Get Time Slots"
curl -s -X GET $BASE_URL/timeslots | jq '.data[0:5]'

echo -e "\n6. Get All Availability"
curl -s -X GET "$BASE_URL/availability" | jq '.data[0:3]'

echo -e "\n7. Get Carer1 Availability"
curl -s -X GET "$BASE_URL/availability?carer_id=Carer1" | jq '.data[0:3]'

echo -e "\n8. Get Availability for Today"
curl -s -X GET "$BASE_URL/availability?date=20250725" | jq '.data[0:3]'

echo -e "\n9. Get Specific Carer and Date"
curl -s -X GET "$BASE_URL/availability?carer_id=Carer1&&date=20250725" | jq '.data[0:3]'

echo -e "\n10. Book Appointment"
curl -s -X POST $BASE_URL/book \
  -H "Content-Type: application/json" \
  -d '{
    "carer_id": "Carer1",
    "date": "20250725", 
    "time_slot": "0900",
    "person_name": "John Doe"
  }' | jq '.'

echo -e "\n11. Check Booked Slot"
curl -s -X GET "$BASE_URL/availability?carer_id=Carer1&&date=20250725" | jq '.data[] | select(.time_slot=="0900")'

echo -e "\n12. Cancel Appointment"
curl -s -X DELETE $BASE_URL/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "carer_id": "Carer1",
    "date": "20250725",
    "time_slot": "0900"
  }' | jq '.'

echo -e "\n13. Verify Cancellation"
curl -s -X GET "$BASE_URL/availability?carer_id=Carer1&&date=20250725" | jq '.data[] | select(.time_slot=="0900")'

echo -e "\n🎉 Tests completed!"