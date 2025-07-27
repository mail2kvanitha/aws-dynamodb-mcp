const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { ListTablesCommand } = require('@aws-sdk/client-dynamodb');

async function testAWS() {
  const client = new DynamoDBClient({ region: 'us-east-1' });
  try {
    const result = await client.send(new ListTablesCommand({}));
    console.log('AWS connection successful!', result.TableNames);
  } catch (error) {
    console.error('AWS connection failed:', error.message);
  }
}

testAWS();
