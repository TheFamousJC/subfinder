const GOOGLE_SOURCE='https://developers.google.com/workspace/guides/configure-oauth-consent';
const MS_SOURCE='https://learn.microsoft.com/en-us/graph/auth-register-app-v2';
const microsoft=[
 {file:'ms-overview.png',kind:'Microsoft reference screenshot',source:MS_SOURCE,note:'Microsoft’s example app is already open. Use the App registrations breadcrumb to return to the app list. The example IDs are not yours.',marks:[[20,0,13,7,'Open App registrations']]},
 {file:'ms-register.png',kind:'Microsoft reference screenshot',source:MS_SOURCE,note:'Ignore the example’s selected account type. Choose the account type described in this wizard; leave Redirect URI blank until the SPA step.',marks:[[2,14,84,15,'Enter SubFinder Demo'],[1,49,95,5,'Choose organizational and personal accounts'],[2,94,10,4,'Register the app']]},
 {file:'ms-platform.png',kind:'Microsoft reference screenshot',source:MS_SOURCE,note:'Choose Single-page application, then enter the exact redirect address shown below this image.',marks:[[48,17,44,25,'Choose Single-page application']]},
 {file:'ms-overview.png',kind:'Microsoft reference screenshot',source:MS_SOURCE,note:'Open API permissions, then add Microsoft Graph delegated Mail.Read and User.Read. Do not copy example permissions from another app.',marks:[[1,84,26,8,'Open API permissions']]},
 {file:'ms-overview.png',kind:'Microsoft reference screenshot',source:MS_SOURCE,note:'Copy your own Application (client) ID. Microsoft’s sample ID in this image is only an example.',marks:[[29,37,31,11,'Copy Application (client) ID']]}
];
export function stepVisual(provider,index){
 if(provider==='microsoft'){if(!microsoft[index])throw Error('Missing visual');return microsoft[index];}
 if(provider!=='google'||index<0||index>7)throw Error('Missing visual');
 if(index===7)return {file:'google-connect-reference.png',kind:'SubFinder screenshot',note:'Paste your own public Client ID into the field shown here, then sign in. Screen height can affect where the button appears.',marks:[]};
 return {file:'google-step-'+(index+1)+'.svg',kind:'Illustrated click guide — not a screenshot',source:index===6?'https://developers.google.com/workspace/guides/create-credentials':GOOGLE_SOURCE,note:'This is a simplified illustration based on the official instructions, not a capture of Google Cloud Console. Follow the matching labels in your account.',marks:[]};
}
function canvas(visual){const wrap=document.createElement('span');wrap.className='wizard-image-canvas';const img=document.createElement('img');img.src=visual.file+'?v=step-images1';img.alt=visual.kind+' for this setup step';img.loading='eager';wrap.append(img);visual.marks.forEach((m,i)=>{const marker=document.createElement('span');marker.className='wizard-image-target';marker.style.cssText=`left:${m[0]}%;top:${m[1]}%;width:${m[2]}%;height:${m[3]}%`;const number=document.createElement('b');number.textContent=i+1;marker.append(number);wrap.append(marker);});return wrap;}
function legend(visual){const list=document.createElement('ol');list.className='wizard-image-legend';for(const m of visual.marks){const li=document.createElement('li');li.textContent=m[4];list.append(li);}return list;}
let viewer;
export function renderStepVisual(target,provider,index){
 const visual=stepVisual(provider,index);target.replaceChildren();
 const type=document.createElement('p');type.className='wizard-image-kind';type.textContent=visual.kind;
 const open=document.createElement('button');open.type='button';open.className='wizard-image-open';open.setAttribute('aria-label','Enlarge step image');open.append(canvas(visual));
 const caption=document.createElement('p');caption.className='wizard-image-caption';caption.textContent=visual.note;
 const enlarge=document.createElement('span');enlarge.className='wizard-image-enlarge';enlarge.textContent='View larger ↗';open.append(enlarge);
 target.append(type,open,legend(visual),caption);
 if(visual.source){const source=document.createElement('a');source.href=visual.source;source.target='_blank';source.rel='noopener noreferrer';source.className='wizard-image-source';source.textContent=provider==='microsoft'?'Screenshot source: Microsoft Learn ↗':'Read the official Google instructions ↗';target.append(source);}
 open.onclick=()=>{if(!viewer){viewer=document.createElement('dialog');viewer.id='wizard-image-viewer';viewer.setAttribute('aria-label','Enlarged step image');document.body.append(viewer);}viewer.replaceChildren();const close=document.createElement('button');close.className='secondary';close.textContent='Close image';close.onclick=()=>viewer.close();const h=document.createElement('h2');h.textContent=visual.kind;const p=document.createElement('p');p.textContent=visual.note;viewer.append(close,h,canvas(visual),legend(visual),p);viewer.showModal();};
}
