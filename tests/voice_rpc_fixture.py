"""Small Firestore REST fixture for the production voice-presence adapter."""
import datetime
BASE='projects/voice-fixture/databases/(default)/documents'
VERSIONS={}
def version(room,uid):return '2026-01-01T00:00:00.'+str(VERSIONS.get((room,uid),0)).zfill(6)+'Z'
def encode(v,key=''):
 if isinstance(v,bool):return {'booleanValue':v}
 if key=='updatedAt' and isinstance(v,(float,int)):return {'timestampValue':datetime.datetime.fromtimestamp(v/1000,datetime.timezone.utc).isoformat().replace('+00:00','Z')}
 if isinstance(v,str):return {'stringValue':v}
 if isinstance(v,(float,int)):return {'doubleValue':v}
 if isinstance(v,list):return {'arrayValue':{'values':[encode(x) for x in v]}}
 if isinstance(v,dict):return {'mapValue':{'fields':{k:encode(x,k) for k,x in v.items()}}}
 return {'nullValue':None}
def decode(v):
 for key in ['stringValue','booleanValue','doubleValue']: 
  if key in v:return v[key]
 if 'integerValue' in v:return int(v['integerValue'])
 if 'mapValue' in v:return {k:decode(x) for k,x in v['mapValue'].get('fields',{}).items()}
 return None
def document(room,uid,data):return {'name':BASE+'/channels/'+room+'/typingStatus/'+uid,'fields':{k:encode(v,k) for k,v in data.items()},'updateTime':version(room,uid)}
def serve(path,body,state,now):
 suffix=path.split('/documents',1)[1]
 if body is None:
  if suffix.startswith(('/users/','/profiles/')):return 404,{'error':{'message':'No test profile'}}
  parts=suffix.strip('/').split('/');
  if len(parts)!=4 or parts[0]!='channels' or parts[2]!='typingStatus':return 404,{'error':{'message':'Not found'}}
  room,uid=parts[1],parts[3];value=state.get(room,{}).get(uid)
  return (200,document(room,uid,value)) if value is not None else (404,{'error':{'message':'Not found'}})
 if suffix.endswith(':runQuery'):
  room=suffix.split('/channels/',1)[1].split(':')[0]
  return 200,[{'document':document(room,uid,value)} for uid,value in state.get(room,{}).items()]
 if suffix==':commit':
  for write in body['writes']:
   parts=write['update']['name'].split('/documents/',1)[1].split('/');room,uid=parts[1],parts[3]
   expected=write.get('currentDocument',{}).get('updateTime')
   if expected and expected!=version(room,uid):return 400,{'error':{'status':'FAILED_PRECONDITION','message':'Stale document'}}
  for write in body['writes']:
   parts=write['update']['name'].split('/documents/',1)[1].split('/');room,uid=parts[1],parts[3]
   target=state.setdefault(room,{}).setdefault(uid,{})
   fields={k:decode(v) for k,v in write['update'].get('fields',{}).items()}
   for field in write.get('updateMask',{}).get('fieldPaths',list(fields)):
    keys=field.split('.');value=fields
    for key in keys:value=value.get(key) if isinstance(value,dict) else None
    parent=target
    for key in keys[:-1]:parent=parent.setdefault(key,{})
    if value is None:parent.pop(keys[-1],None)
    else:parent[keys[-1]]=value
   for transform in write.get('updateTransforms',[]):
    keys=transform['fieldPath'].split('.');parent=target
    for key in keys[:-1]:parent=parent.setdefault(key,{})
    parent[keys[-1]]=now
   VERSIONS[(room,uid)]=VERSIONS.get((room,uid),0)+1
  return 200,{'writeResults':[{} for _ in body['writes']]}
 return 400,{'error':{'message':'Unsupported test request'}}
