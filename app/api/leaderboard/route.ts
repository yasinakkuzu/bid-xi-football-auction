import {NextResponse} from 'next/server';
import {deleteLeaderboardEntry,digest,leaderboard,rateLimit,RoomError} from '../../../lib/rooms';

export async function GET(request:Request){
  try{
    const ip=request.headers.get('cf-connecting-ip')||'unknown';
    await rateLimit(`leaderboard:${await digest(ip)}`,30);
    const filter=new URL(request.url).searchParams.get('filter')==='all'?'all':'standard';
    return NextResponse.json({entries:await leaderboard(10,filter),filter},{headers:{'Cache-Control':'public, max-age=30'}});
  }catch(error){
    const known=error instanceof RoomError;
    return NextResponse.json({error:(error as Error).message},{status:known?error.status:500});
  }
}

export async function DELETE(request:Request){
  try{
    const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'')||'';
    const body=await request.json() as {roomCode?:string;entryId?:string};
    const roomCode=String(body.roomCode||'').toUpperCase(),entryId=String(body.entryId||'');
    if(!token||!/^[A-Z2-9]{6}$/.test(roomCode)||!entryId)throw new RoomError('INVALID_DELETE','Silme isteği eksik',400);
    await rateLimit(`leaderboard-delete:${roomCode}:${(await digest(token)).slice(0,16)}`,10);
    return NextResponse.json(await deleteLeaderboardEntry(roomCode,token,entryId));
  }catch(error){
    const known=error instanceof RoomError;
    return NextResponse.json({error:(error as Error).message,code:known?error.code:'DELETE_FAILED'},{status:known?error.status:500});
  }
}
