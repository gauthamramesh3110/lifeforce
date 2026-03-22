import { NextRequest, NextResponse } from 'next/server';
import { CosmosClient } from '@azure/cosmos';

const client = new CosmosClient({
  endpoint: process.env.COSMOS_DB_ENDPOINT!,
  key: process.env.COSMOS_DB_KEY!,
});

const db = client.database('clinical');

const ALLOWED_CONTAINERS = new Set([
  'allergies', 'careplans', 'conditions', 'immunizations',
  'medications', 'observations', 'procedures',
]);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const containerName = searchParams.get('container') || '';
  const patientId = searchParams.get('patientId') || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '10', 10)));
  const dateField = searchParams.get('dateField') || 'START';

  if (!containerName || !patientId) {
    return NextResponse.json({ error: 'container and patientId are required' }, { status: 400 });
  }

  if (!ALLOWED_CONTAINERS.has(containerName)) {
    return NextResponse.json({ error: 'Invalid container name' }, { status: 400 });
  }

  const offset = (page - 1) * pageSize;

  try {
    const container = db.container(containerName);
    const { resources } = await container.items
      .query({
        query: `SELECT * FROM c WHERE c.PATIENT = @patientId ORDER BY c["${dateField}"] DESC OFFSET @offset LIMIT @limit`,
        parameters: [
          { name: '@patientId', value: patientId },
          { name: '@offset', value: offset },
          { name: '@limit', value: pageSize },
        ],
      })
      .fetchAll();

    return NextResponse.json(resources);
  } catch (error) {
    console.error('Clinical data pagination error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
