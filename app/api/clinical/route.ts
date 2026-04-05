import { NextRequest, NextResponse } from 'next/server';
import { getCosmosClient } from '@/lib/cosmos';
import { randomUUID } from 'crypto';

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
    const db = getCosmosClient().database('clinical');
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { container: containerName, patientId, record } = body as {
      container: string;
      patientId: string;
      record: Record<string, unknown>;
    };

    if (!containerName || !patientId || !record) {
      return NextResponse.json(
        { error: 'container, patientId, and record are required' },
        { status: 400 }
      );
    }

    if (!ALLOWED_CONTAINERS.has(containerName)) {
      return NextResponse.json({ error: 'Invalid container name' }, { status: 400 });
    }

    const db = getCosmosClient().database('clinical');
    const container = db.container(containerName);

    // Auto-resolve CODE from DESCRIPTION and REASONCODE from REASONDESCRIPTION
    if (containerName === 'careplans') {
      if (record.DESCRIPTION && !record.CODE) {
        const { resources } = await container.items
          .query({
            query: 'SELECT TOP 1 c.CODE FROM c WHERE c.DESCRIPTION = @desc AND IS_DEFINED(c.CODE) AND c.CODE != ""',
            parameters: [{ name: '@desc', value: String(record.DESCRIPTION) }],
          })
          .fetchAll();
        if (resources.length > 0) {
          record.CODE = resources[0].CODE;
        }
      }
      if (record.REASONDESCRIPTION && !record.REASONCODE) {
        const { resources } = await container.items
          .query({
            query: 'SELECT TOP 1 c.REASONCODE FROM c WHERE c.REASONDESCRIPTION = @reason AND IS_DEFINED(c.REASONCODE) AND c.REASONCODE != ""',
            parameters: [{ name: '@reason', value: String(record.REASONDESCRIPTION) }],
          })
          .fetchAll();
        if (resources.length > 0) {
          record.REASONCODE = resources[0].REASONCODE;
        }
      }
    }

    const item = {
      id: randomUUID(),
      PATIENT: patientId,
      ...record,
    };

    const { resource } = await container.items.create(item);
    return NextResponse.json(resource, { status: 201 });
  } catch (error) {
    console.error('Clinical data create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
