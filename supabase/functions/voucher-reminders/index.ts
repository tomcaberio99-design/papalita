// Call every hour from Supabase Cron / external scheduler with x-papalita-secret.
import {createClient} from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
const env=(k:string)=>Deno.env.get(k)||'';
Deno.serve(async req=>{
 if(req.method!=='POST')return new Response('POST only',{status:405});
 if(!env('PAPALITA_NOTIFICATION_SECRET')||req.headers.get('x-papalita-secret')!==env('PAPALITA_NOTIFICATION_SECRET'))return new Response('Unauthorized',{status:401});
 try{
  const db=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'));
  const now=new Date(),tomorrow=new Date(now.getTime()+24*3600000);
  const {data,error}=await db.from('customer_vouchers').select('id,user_id,code,expires_at').is('reminder_sent_at',null).gt('expires_at',now.toISOString()).lte('expires_at',tomorrow.toISOString()).limit(100);
  if(error)throw error;
  webpush.setVapidDetails(env('VAPID_SUBJECT'),env('VAPID_PUBLIC_KEY'),env('VAPID_PRIVATE_KEY'));
  let processed=0,sent=0;
  for(const v of data||[]){
   // Claim the voucher first so a repeated scheduler run does not duplicate reminders.
   const {data:claim,error:claimError}=await db.from('customer_vouchers').update({reminder_sent_at:new Date().toISOString()}).eq('id',v.id).is('reminder_sent_at',null).select('id');
   if(claimError||!claim?.length)continue;
   const title='🎟️ Your Papalita voucher expires soon!';const body=`Voucher ${v.code} expires within 24 hours. Use it before it’s gone!`;
   const {error:ne}=await db.from('customer_notifications').insert({user_id:v.user_id,title,body,type:'voucher',url:'#/promos',dedupe_key:`voucher-expiry:${v.id}`});if(ne){console.error(ne);continue;}
   const {data:subs}=await db.from('push_subscriptions').select('endpoint,p256dh,auth').eq('user_id',v.user_id);
   for(const s of subs||[]){try{await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify({title,body,url:'#/promos',tag:`voucher-${v.id}`}));sent++;}
   catch(e){const status=(e as {statusCode?:number}).statusCode;if(status===404||status===410)await db.from('push_subscriptions').delete().eq('endpoint',s.endpoint);console.error('Push failed',status);}}
   processed++;
  }
  return Response.json({processed,push_sent:sent});
 }catch(e){console.error(e);return Response.json({error:'Reminder job failed'},{status:500});}
});
