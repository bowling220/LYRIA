/* Small pure helpers shared by the journal renderer and its tests. */
export const categories={updates:'LYRIA Updates',community:'Community',features:'Features',announcements:'Announcements',guides:'Guides',opinion:'Opinion'};
export const categoryOf=story=>Object.hasOwn(categories,story.category)?story.category:(story.archive?'updates':'community');
export function dateValue(value){if(value==null || value==='')return null;const date=value?.toDate?.() || new Date(value);return Number.isFinite(date.getTime())?date:null}
export const readingMinutes=body=>Math.max(1,Math.ceil(String(body || '').trim().split(/\s+/u).filter(Boolean).length/200));
export function excerptOf(story){const source=story.excerpt || String(story.body || '').split(/\n\s*\n/).find(part=>part.trim() && !part.trim().startsWith('```')) || '';const text=String(source).replace(/^\s*#{1,6}\s+/gm,'').replace(/^\s*[-*>]\s+/gm,'').replace(/\s+/g,' ').trim();return text.length>200?text.slice(0,200).replace(/\s+\S*$/,'')+'…':text}

export function safeImage(value){
 if(typeof value!=='string' || value.length>2048)return '';
 if(/^assets\/[a-zA-Z0-9_./-]+$/.test(value) && !value.includes('..'))return value;
 try{const url=new URL(value);return url.protocol==='https:' && !url.username && !url.password?url.href:''}catch{return ''}
}
export function normalizeStory(id,data){return {...data,id:'member-'+id,documentId:id,title:typeof data.title==='string'?data.title:'Untitled story',body:typeof data.body==='string'?data.body:'',authorName:typeof data.authorName==='string' && data.authorName.trim()?data.authorName:'LYRIA community',category:categoryOf(data),date:data.timestamp,postId:'user-'+id,commentId:'user-'+id,archive:false}}
export const newestFirst=(a,b)=>(dateValue(b.date)?.getTime() || 0)-(dateValue(a.date)?.getTime() || 0) || a.id.localeCompare(b.id);
