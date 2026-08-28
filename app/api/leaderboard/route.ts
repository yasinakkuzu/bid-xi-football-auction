import {NextResponse} from 'next/server';
import {digest,leaderboard,rateLimit,RoomError} from '../../../lib/rooms';

export async function GET(request:Request){
  try{
    const ip=request.headers.get('cf-connecting-ip')||'unknown';
    await rateLimit(`leaderboard:${await digest(ip)}`,30);
    return NextResponse.json({entries:await leaderboard(10)},{headers:{'Cache-Control':'public, max-age=30'}});
  }catch(error){
    const known=error instanceof RoomError;
    return NextResponse.json({error:(error as Error).message},{status:known?error.status:500});
  }
}
