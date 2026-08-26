import {NextResponse} from 'next/server';
import generated from '../../data/auction-pool.generated.json';

export async function GET(request:Request){
  const era=new URL(request.url).searchParams.get('era')==='legends'?'legends':'current';
  return NextResponse.json(generated[era],{headers:{'Cache-Control':'public, max-age=3600, stale-while-revalidate=86400'}});
}
