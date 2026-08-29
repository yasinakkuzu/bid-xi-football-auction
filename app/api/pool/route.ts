import {NextResponse} from 'next/server';
import generated from '../../data/auction-pool.generated.json';
import {sanitizePool} from '../../../lib/media-rights';

export async function GET(request:Request){
  const era=new URL(request.url).searchParams.get('era')==='legends'?'legends':'current';
  const safe=Object.fromEntries(Object.entries(generated[era]).map(([slot,players])=>[slot,sanitizePool(players)]));
  return NextResponse.json(safe,{headers:{'Cache-Control':'public, max-age=3600, stale-while-revalidate=86400'}});
}
