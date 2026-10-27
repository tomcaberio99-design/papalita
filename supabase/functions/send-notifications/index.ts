// Server-only sender. Deploy with JWT verification disabled ONLY if using the secret below.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
const env=(k:string)=>Deno.env.get(k)||'';
Deno.serve(async req=>{
 if(req.method!=='POST')return new Response('POST only',{status:405});
 if(!env('PAPALITA_NOTIFICATION_SECRET')||req.headers.get('x-papalita-secret')!==env('PAPALITA_NOTIFICATION_SECRET'))return new Response('Unauthorized',{status:401});
 try{
  const input=await req.json();const userId=String(input.user_id||'');
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(userId))return new Response('Valid user_id required',{status:400});
  const title=String(input.title||'Papalita').slice(0,100),body=String(input.body||'').slice(0,350);
  const url=String(input.url||'#/notifications');if(!/^#\/[a-z0-9/?=&_-]*$/i.test(url))return new Response('Invalid internal URL',{status:400});
  const db=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'));
  const {data:note,error:noteError}=await db.from('customer_notifications').insert({user_id:userId,title,body,type:String(input.type||'general').slice(0,40),url}).select('id').single();
  if(noteError)throw noteError;
  const {data:subs,error}=await db.from('push_subscriptions').select('endpoint,p256dh,auth').eq('user_id',userId);if(error)throw error;
  webpush.setVapidDetails(env('VAPID_SUBJECT'),env('VAPID_PUBLIC_KEY'),env('VAPID_PRIVATE_KEY'));
  let sent=0,failed=0;
  for(const s of subs||[]){try{await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify({title,body,url,tag:note.id}));sent++;}
   catch(e){failed++;const status=(e as {statusCode?:number}).statusCode;if(status===404||status===410)await db.from('push_subscriptions').delete().eq('endpoint',s.endpoint);console.error('Push delivery failed',status);}}
  return Response.json({notification_id:note.id,subscriptions:(subs||[]).length,sent,failed});
 }catch(e){console.error(e);return Response.json({error:'Notification delivery failed'},{status:500});}
});
