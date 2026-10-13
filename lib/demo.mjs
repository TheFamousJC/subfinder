import { detect } from './detect.mjs';
export function demo() {
  const items = [['Netflix',15.49,'monthly',2],['Spotify',10.99,'monthly',5],['Adobe Creative Cloud',59.99,'monthly',7],['Notion',96,'yearly',11],['iCloud+',2.99,'monthly',14],['Headspace',69.99,'yearly',18],['Dropbox',11.99,'monthly',22],['The New York Times',4,'monthly',25]];
  return detect(items.flatMap(([provider,amount,cycle,days],i)=>[0,1].map(p=>({from:`${provider} <billing@service${i}.example>`,subject:`Your ${provider} subscription receipt`,date:new Date(Date.now()-(days+p* (cycle==='yearly'?365:30))*86400000).toISOString(),body:`Your ${cycle} subscription has renewed.\nTotal charged: USD ${amount.toFixed(2)}\nThank you for your membership.`}))));
}
