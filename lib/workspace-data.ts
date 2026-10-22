import { Recycle, Monitor, BatteryCharging, CarFront, Droplets } from 'lucide-react';
export type WasteStream = 'plastic' | 'ewaste' | 'battery' | 'elv' | 'oil';
export const streams = [
 { id:'plastic', name:'Plastic Waste', icon:Recycle, description:'Manage PIBOs and PWPs under Plastic Waste Management Rules.', available:true, image:'/images/workspace-plastic.webp', tone:'green' },
 { id:'ewaste', name:'E-Waste', icon:Monitor, description:'End-to-end electronic waste recycling and compliance.', available:true, image:'/images/workspace-ewaste.webp', tone:'blue' },
 { id:'battery', name:'Battery Waste', icon:BatteryCharging, description:'Compliance for Battery Waste Management Rules.', available:false, image:'/images/workspace-battery.webp', tone:'amber' },
 { id:'elv', name:'End of Life (ELV)', icon:CarFront, description:'Manage end-of-life vehicles and automotive waste.', available:false, image:'/images/workspace-elv.webp', tone:'violet' },
 { id:'oil', name:'Used Oil', icon:Droplets, description:'Manage used oil recovery, recycling and compliance.', available:false, image:'/images/workspace-oil.webp', tone:'orange' },
] as const;
export const registrationCategories = {
 plastic: [
  {id:'pibo',name:'PIBO',subtitle:'Producer, Importer & Brand Owner',roles:['Producers','Importers','Brand Owners','Extended Producer Responsibility'],image:'/images/category-pibo.webp'},
  {id:'pwp',name:'PWP',subtitle:'Plastic Waste Processor',roles:['Recyclers','Waste Processors','Co-processors','Waste Management Agencies'],image:'/images/category-pwp.webp'},
  {id:'paper',name:'Paper',subtitle:'Paper Waste Management',roles:['Recyclers','Manufacturers','Waste Collectors','Pulp Mills'],image:'/images/category-paper.webp'},
  {id:'metal',name:'Metal',subtitle:'Metal Waste Management',roles:['Scrap Dealers','Foundries','Recyclers','Smelters'],image:'/images/category-metal.webp'},
  {id:'glass',name:'Glass',subtitle:'Glass Waste Management',roles:['Cullet Suppliers','Glass Manufacturers','Recyclers','Bottling Plants'],image:'/images/category-glass.webp'},
  {id:'sanitary',name:'Sanitary Waste',subtitle:'Sanitary Waste Management',roles:['Incinerators','Collection Agencies','Disposal Facilities','Treatment Plants'],image:'/images/category-sanitary.webp'},
 ],
 ewaste: [
  {id:'producer',name:'Producer',subtitle:'Producers of electrical and electronic equipment (EEE).',roles:[],image:'/images/category-producer.webp'},
  {id:'recycler',name:'Recycler',subtitle:'Authorized recyclers for dismantling and recycling e-waste.',roles:[],image:'/images/category-recycler.webp'},
  {id:'manufacturer',name:'Manufacturer',subtitle:'Manufacturers of electronic components and assemblies.',roles:[],image:'/images/category-manufacturer.webp'},
  {id:'refurbisher',name:'Refurbisher',subtitle:'Refurbishers extending the life of used electronics.',roles:[],image:'/images/category-refurbisher.webp'},
 ],
};
export type Summary = { total:number; draft:number; submitted:number; streams:Record<string,number>; categories:Record<string,number> };
