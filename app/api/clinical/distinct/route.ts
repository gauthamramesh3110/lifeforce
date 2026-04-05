import { NextRequest, NextResponse } from 'next/server';
import { getCosmosClient } from '@/lib/cosmos';

const ALLOWED_CONTAINERS = new Set([
  'allergies', 'careplans', 'conditions', 'immunizations',
  'medications', 'observations', 'procedures',
]);

const ALLOWED_FIELDS = new Set([
  'DESCRIPTION', 'REASONDESCRIPTION', 'CATEGORY', 'SEVERITY1',
]);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const containerName = searchParams.get('container') || '';
  const field = searchParams.get('field') || '';

  if (!containerName || !field) {
    return NextResponse.json({ error: 'container and field are required' }, { status: 400 });
  }

  if (!ALLOWED_CONTAINERS.has(containerName)) {
    return NextResponse.json({ error: 'Invalid container name' }, { status: 400 });
  }

  if (!ALLOWED_FIELDS.has(field)) {
    return NextResponse.json({ error: 'Invalid field name' }, { status: 400 });
  }

  const filterField = searchParams.get('filterField') || '';
  const filterValue = searchParams.get('filterValue') || '';

  if (filterField && !ALLOWED_FIELDS.has(filterField)) {
    return NextResponse.json({ error: 'Invalid filter field name' }, { status: 400 });
  }

  try {
    const db = getCosmosClient().database('clinical');
    const container = db.container(containerName);

    let query = `SELECT DISTINCT VALUE c["${field}"] FROM c WHERE IS_DEFINED(c["${field}"]) AND c["${field}"] != ""`;
    const parameters: { name: string; value: string }[] = [];

    if (filterField && filterValue) {
      query += ` AND c["${filterField}"] = @filterValue`;
      parameters.push({ name: '@filterValue', value: filterValue });
    }

    const { resources } = await container.items
      .query({ query, parameters })
      .fetchAll();

    const sorted = (resources as string[]).sort((a, b) => a.localeCompare(b));
    return NextResponse.json(sorted);
  } catch (error) {
    console.error('Distinct values error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
