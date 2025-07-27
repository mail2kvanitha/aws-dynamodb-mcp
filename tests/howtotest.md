# How to test Rest API

## Test with JavaScript

Run the npm start in one terminal and run in another terminal

node tests/api-tests.js

## Test with Curl

chmod +x curl-tests.sh
.curl-tests.sh

## Manual Testing with curl

### Get all availability

curl "<http://localhost:3000/api/availability>"

### Get Carer1 availability

curl "<http://localhost:3000/api/availability?carer_id=Carer1>"

### Get today's availability  

curl "<http://localhost:3000/api/availability?date=20250725>"

### Get specific carer and date

curl "<http://localhost:3000/api/availability/Carer1/20250725>"

### Book appointment

curl -X POST "<http://localhost:3000/api/book>" \
  -H "Content-Type: application/json" \
  -d '{
    "carer_id": "Carer1",
    "date": "20250725",
    "time_slot": "1400",
    "person_name": "Alice Johnson"
  }'

### Cancel appointment

curl -X DELETE "<http://localhost:3000/api/cancel>" \
  -H "Content-Type: application/json" \
  -d '{
    "carer_id": "Carer1",
    "date": "20250725",
    "time_slot": "1400"
  }'

## API Endpoints Summary

| Method  |          Endpoint               |        Description          |
|:-------:|:-------------------------------:|:---------------------------:|
| GET     | /health                         | Health check                |
| POST    | /api/initialize                 | Initialize time slots       |
| GET     | /api/availability               | Get all availability        |
| GET     | /api/availability?carer_id=X    | Get carer availability      |
| GET     | /api/availability?date=X        | Get date availability       |
| GET     | /api/availability/:carer/:date  | Get specific availability   |
| POST    | /api/book                       | Book appointment            |
| DELETE  | /api/cancel                     | Cancel appointment          |
| GET     | /api/carers                     | Get all carers              |
| GET     | /api/dates                      | Get available dates         |
| GET     | /api/timeslots                  | Get time slot options       |

## Development Mode

For development with auto-reload:

```bash
npm run dev-api 
```

This gives you a complete REST API wrapper around your MCP server that you can easily test and integrate with frontend applications!
