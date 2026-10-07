const DATABASE="otter-card-images";
const STORE="images";
async function database():Promise<IDBDatabase> {
  if (typeof indexedDB==="undefined") throw new Error("이 브라우저에서 이미지 저장소를 사용할 수 없어요.");
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DATABASE,1);
    req.onupgradeneeded=()=>req.result.createObjectStore(STORE);
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(new Error("이미지 저장소를 열지 못했어요."));
  });
}
export async function readImage(id:string):Promise<Blob|undefined> {
  const db=await database();
  try {return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,"readonly"),r=tx.objectStore(STORE).get(id);r.onsuccess=()=>resolve(r.result as Blob|undefined);r.onerror=()=>reject(new Error("저장된 이미지를 읽지 못했어요."));});}
  finally {db.close();}
}
export async function saveImage(id:string,blob:Blob):Promise<void> {
  const db=await database();
  try {await new Promise<void>((resolve,reject)=>{const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).put(blob,id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(new Error("이미지를 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요."));tx.onabort=()=>reject(new Error("이미지 저장이 중단됐어요."));});}
  finally {db.close();}
}
