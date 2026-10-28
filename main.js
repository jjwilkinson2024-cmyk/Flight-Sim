/* FlightDeck v0.2 — global geospatial prototype. Requires internet for CesiumJS and map layers. */
(() => {
const $=id=>document.getElementById(id), clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const airports={
 heathrow:{name:'EGLL · LONDON HEATHROW',lat:51.4700,lon:-0.4543,heading:270},
 newyork:{name:'KJFK · NEW YORK JFK',lat:40.6413,lon:-73.7781,heading:310},
 paris:{name:'LFPG · PARIS CHARLES DE GAULLE',lat:49.0097,lon:2.5479,heading:90},
 sydney:{name:'YSSY · SYDNEY',lat:-33.9399,lon:151.1753,heading:160},
 dubai:{name:'OMDB · DUBAI',lat:25.2532,lon:55.3657,heading:120},
 tokyo:{name:'RJTT · TOKYO HANEDA',lat:35.5494,lon:139.7798,heading:340}
};
const state={lat:51.4700,lon:-.4543,alt:0,speed:0,vs:0,heading:270,pitch:0,bank:0,throttle:0,flaps:0,gear:true,brakes:true,ap:false,paused:false,camera:'chase',weather:'day',onGround:true,verticalVelocity:0,orbit:0,token:'',terrain:null,buildings:null,
 apHeading:270,apAltitude:10000,destination:null,routeActive:false,traffic:[],atcMessages:[],
 selectedSpeed:180,selectedVS:0,selectedQnh:1013,ndRange:20,ils:false,terrainMode:false,waypoints:true,
 lights:{navLight:true,beacon:true,strobe:false,landing:false,taxi:false,logo:false},
 systems:{apu:false,eng1:false,eng2:false,seatbelt:true,noSmoking:true,antiIce:false},
 trim:0,com:11800,nav:11030,flaps:0,managed:{spd:false,hdg:false,alt:false},radioStandby:{com:11800,nav:11030}};
const viewer=new Cesium.Viewer('globe',{
 animation:false,timeline:false,baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,
 navigationHelpButton:false,infoBox:false,selectionIndicator:false,fullscreenButton:false,vrButton:false,
 shouldAnimate:true,requestRenderMode:false,scene3DOnly:true,baseLayer:false
});
viewer.scene.globe.enableLighting=true;viewer.scene.globe.depthTestAgainstTerrain=true;
viewer.scene.skyAtmosphere.show=true;viewer.scene.fog.enabled=true;viewer.scene.globe.showGroundAtmosphere=true;
viewer.scene.screenSpaceCameraController.minimumZoomDistance=12;
viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
 url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
 credit:'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
 maximumLevel:19
}));
viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
 url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',maximumLevel:19,alpha:0.0,
 credit:'© OpenStreetMap contributors'
}));
// Use a custom entity aircraft silhouette and local axes, georeferenced to the globe.
const aircraft=viewer.entities.add({
 name:'FlightDeck A320 prototype',
 position:Cesium.Cartesian3.fromDegrees(state.lon,state.lat,15),
 orientation:Cesium.Transforms.headingPitchRollQuaternion(Cesium.Cartesian3.fromDegrees(state.lon,state.lat,15),new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(state.heading),0,0)),
 model:undefined,
 polyline:{positions:[],width:2,material:Cesium.Color.CYAN}
});
const planeParts=[];
function addPlanePart(name,kind,opts){const e=viewer.entities.add({name,...opts});planeParts.push(e);return e}
function updateAircraftGeometry(){
 planeParts.forEach(e=>viewer.entities.remove(e));planeParts.length=0;
 const pos=Cesium.Cartesian3.fromDegrees(state.lon,state.lat,Math.max(15,state.alt*.3048+15));
 const frame=Cesium.Transforms.eastNorthUpToFixedFrame(pos);
 // ENU axes: x east/right, y north/forward, z up. Each primitive entity is an oriented 3D ellipsoid/box.
 function local(x,y,z){return Cesium.Matrix4.multiplyByPoint(frame,new Cesium.Cartesian3(x,y,z),new Cesium.Cartesian3())}
 function part(name,x,y,z,sx,sy,sz,color){return addPlanePart(name,'ellipsoid',{position:local(x,y,z),ellipsoid:{radii:new Cesium.Cartesian3(sx,sy,sz),material:Cesium.Color.fromCssColorString(color),outline:true,outlineColor:Cesium.Color.fromCssColorString('#263846')}})}
 // This is an illustrative procedural aircraft silhouette, not a detailed A320 mesh.
 part('Fuselage',0,0,0,3.7,23,3.6,'#e7edf0');
 part('Nose',0,21,0,3.1,7,2.8,'#f7f9fb');
 part('Tail cone',0,-23,0,2.8,5,2.5,'#dbe2e6');
 part('Left wing',-13,0,-1,15,4.2,.65,'#d9e1e6');
 part('Right wing',13,0,-1,15,4.2,.65,'#d9e1e6');
 part('Left engine',-9,-1,-3.1,2.1,5,2,'#687782');
 part('Right engine',9,-1,-3.1,2.1,5,2,'#687782');
 part('Tailplane left',-5,-19,1.1,6,2.5,.5,'#0e4c82');
 part('Tailplane right',5,-19,1.1,6,2.5,.5,'#0e4c82');
 part('Vertical tail',0,-19,5,2.4,3,6,'#0e4c82');
 // Cockpit view camera is a real world camera position, not a rendered cockpit interior.
 aircraft.position=pos;
 aircraft.orientation=Cesium.Transforms.headingPitchRollQuaternion(pos,new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(state.heading),Cesium.Math.toRadians(state.pitch),Cesium.Math.toRadians(state.bank)));
}
function removeTerrain(){if(state.terrain){viewer.terrainProvider=new Cesium.EllipsoidTerrainProvider();state.terrain=null}if(state.buildings){viewer.scene.primitives.remove(state.buildings);state.buildings=null}}
async function enableToken(token){
 if(!token.trim()){toast('Paste your Cesium ion token first');return}
 state.token=token.trim();Cesium.Ion.defaultAccessToken=state.token;
 try{
  viewer.terrainProvider=await Cesium.CesiumTerrainProvider.fromIonAssetId(1);
  state.terrain=viewer.terrainProvider;
  try{state.buildings=viewer.scene.primitives.add(await Cesium.createOsmBuildingsAsync())}catch(e){console.warn('Buildings layer unavailable',e)}
  $('tokenStatus').textContent='Terrain enabled. Buildings layer loaded if available.';
  toast('WORLD TERRAIN ENABLED');$('settings').classList.add('hidden');
 }catch(err){
  console.error(err);removeTerrain();$('tokenStatus').textContent='Could not load terrain. Check token permissions and asset access.';toast('Terrain setup failed — check token');
 }
}
function toast(s){const t=$('toast');t.textContent=s;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),1800)}
function setCamera(c){
 state.camera=c;document.querySelectorAll('.cam').forEach(b=>b.classList.toggle('active',b.dataset.cam===c));
 if(c==='orbit')state.orbit=0;
 updateCamera(true);toast(c.toUpperCase()+' CAMERA');
}
function updateCamera(instant=false){
 const p=Cesium.Cartesian3.fromDegrees(state.lon,state.lat,Math.max(15,state.alt*.3048+15));
 const heading=Cesium.Math.toRadians(state.heading), pitch=Cesium.Math.toRadians(state.pitch);
 let range=110,pit=Cesium.Math.toRadians(-12),head=heading;
 if(state.camera==='cockpit'){range=2;pit=Cesium.Math.toRadians(-2)}
 else if(state.camera==='wing'){range=24;head=heading+Cesium.Math.toRadians(90);pit=Cesium.Math.toRadians(-5)}
 else if(state.camera==='tower'){range=500;pit=Cesium.Math.toRadians(-8);head=heading+Cesium.Math.toRadians(140)}
 else if(state.camera==='orbit'){state.orbit+=0.0015;head=state.orbit;range=180;pit=Cesium.Math.toRadians(-18)}
 else {range=140;pit=Cesium.Math.toRadians(-13)}
 viewer.camera.lookAt(p,new Cesium.HeadingPitchRange(head,pit,range));
 if(instant)viewer.scene.requestRender();
}
function setAirport(){
 const a=airports[$('airport').value];state.lat=a.lat;state.lon=a.lon;state.heading=a.heading;state.alt=0;state.speed=0;state.vs=0;state.pitch=0;state.bank=0;state.throttle=0;state.onGround=true;state.brakes=true;
 $('location').textContent=a.name;$('throttle').value=0;$('thrText').textContent='0%';
 updateAircraftGeometry();updateCamera(true);updateUI();toast('SPAWNED AT '+a.name);
}
function reset(){setAirport();state.flaps=0;state.gear=true;state.ap=false;state.paused=false;$('flaps').value='0';$('gearBtn').querySelector('b').textContent='DOWN';$('apBtn').querySelector('b').textContent='OFF';$('pauseBtn').querySelector('b').textContent='RUNNING';$('brakeBtn').querySelector('b').textContent='ON';toast('FLIGHT RESET')}
const keys={};addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;if(e.key>='1'&&e.key<='5')setCamera(['chase','cockpit','wing','tower','orbit'][+e.key-1]);if(e.key.toLowerCase()==='p')togglePause();if(e.key.toLowerCase()==='g')toggleGear();if(e.key.toLowerCase()==='b')toggleBrakes();if([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))e.preventDefault()});
addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
function togglePause(){state.paused=!state.paused;$('pauseBtn').classList.toggle('active',state.paused);$('pauseBtn').querySelector('b').textContent=state.paused?'PAUSED':'RUNNING';toast(state.paused?'SIM PAUSED':'SIM RESUMED')}
function toggleGear(){state.gear=!state.gear;$('gearBtn').querySelector('b').textContent=state.gear?'DOWN':'UP';toast('GEAR '+(state.gear?'DOWN':'UP'))}
function toggleBrakes(){state.brakes=!state.brakes;$('brakeBtn').classList.toggle('active',state.brakes);$('brakeBtn').querySelector('b').textContent=state.brakes?'ON':'OFF';toast('BRAKES '+(state.brakes?'ON':'OFF'))}
$('settingsBtn').onclick=()=>$('settings').classList.toggle('hidden');$('closeSettings').onclick=()=>$('settings').classList.add('hidden');
$('applyToken').onclick=()=>enableToken($('token').value);
$('throttle').oninput=e=>{state.throttle=+e.target.value;$('thrText').textContent=state.throttle+'%'};
$('flaps').onchange=e=>{state.flaps=+e.target.value;toast('FLAPS '+state.flaps)};
$('gearBtn').onclick=toggleGear;$('brakeBtn').onclick=toggleBrakes;$('apBtn').onclick=()=>{state.ap=!state.ap;$('apBtn').classList.toggle('active',state.ap);$('apBtn').querySelector('b').textContent=state.ap?'ON':'OFF';toast('AUTOPILOT '+(state.ap?'ON':'OFF'))};
$('pauseBtn').onclick=togglePause;$('resetBtn').onclick=reset;$('spawnBtn').onclick=setAirport;
$('routeBtn').onclick=loadRoute;
$('setHdgBtn').onclick=()=>{state.apHeading=normHeading(state.heading);$('apHdgText').textContent=Math.round(state.apHeading)+'°';atc('CENTER: Heading bug set to '+Math.round(state.apHeading)+' degrees.')};
$('setAltBtn').onclick=()=>{state.apAltitude=state.alt>0?Math.round(state.alt/1000)*1000:10000;$('apAltText').textContent=state.apAltitude.toLocaleString()+' FT';atc('CENTER: Selected altitude '+state.apAltitude.toLocaleString()+' feet.')};
$('requestTaxi').onclick=()=>atc(state.onGround?'GROUND: Taxi request received. Taxi clearance is simulated; follow airport signage in the real world.':'GROUND: You are airborne; taxi request unavailable.');
$('requestTakeoff').onclick=()=>atc(state.onGround&&state.speed<5?'TOWER: Line up and wait (simulated). Confirm runway and conditions before takeoff.':state.onGround?'TOWER: Takeoff request received (simulated).':'TOWER: You are already airborne.');
$('requestLanding').onclick=()=>atc(state.onGround?'TOWER: Aircraft is on the ground.':'TOWER: Landing request received. Runway clearance is simulated, not real ATC.');
$('requestWeather').onclick=()=>atc('ATIS: '+state.weather.toUpperCase()+' preset selected. Live METAR/weather is not connected.');
$('fullscreenBtn').onclick=()=>!document.fullscreenElement?document.documentElement.requestFullscreen?.():document.exitFullscreen?.();
$('weather').onchange=e=>{state.weather=e.target.value;const c=viewer.scene.skyAtmosphere;
 if(state.weather==='storm'){viewer.scene.fog.density=0.00045;viewer.scene.backgroundColor=Cesium.Color.fromCssColorString('#25313c');viewer.scene.globe.enableLighting=false;toast('STORM VISIBILITY PRESET');}
 else if(state.weather==='night'){viewer.scene.fog.density=0.00002;viewer.scene.globe.enableLighting=true;viewer.clock.currentTime=Cesium.JulianDate.fromDate(new Date('2026-01-01T02:00:00Z'));viewer.clock.shouldAnimate=false;viewer.scene.backgroundColor=Cesium.Color.fromCssColorString('#030812')}else if(state.weather==='dusk'){viewer.scene.fog.density=0.00008;viewer.clock.currentTime=Cesium.JulianDate.fromDate(new Date('2026-01-01T17:00:00Z'));viewer.clock.shouldAnimate=false;viewer.scene.backgroundColor=Cesium.Color.fromCssColorString('#e1a27d')}else{viewer.scene.fog.density=0.00005;viewer.clock.currentTime=Cesium.JulianDate.fromDate(new Date());viewer.clock.shouldAnimate=true;viewer.scene.backgroundColor=Cesium.Color.BLACK}toast('LIGHTING PRESET: '+state.weather.toUpperCase())};
document.querySelectorAll('.cam').forEach(b=>b.onclick=()=>setCamera(b.dataset.cam));

function normHeading(h){return ((h%360)+360)%360}
function bearingBetween(lat1,lon1,lat2,lon2){
 const p1=Cesium.Math.toRadians(lat1),p2=Cesium.Math.toRadians(lat2),dl=Cesium.Math.toRadians(lon2-lon1);
 const y=Math.sin(dl)*Math.cos(p2),x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);
 return normHeading(Cesium.Math.toDegrees(Math.atan2(y,x)));
}
function distanceNm(lat1,lon1,lat2,lon2){
 const r=3440.065,p1=Cesium.Math.toRadians(lat1),p2=Cesium.Math.toRadians(lat2),dp=p2-p1,dl=Cesium.Math.toRadians(lon2-lon1);
 const a=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
 return 2*r*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)));
}
function loadRoute(){
 const a=airports[$('routeAirport').value];state.destination={...a,key:$('routeAirport').value};state.routeActive=true;
 const d=distanceNm(state.lat,state.lon,a.lat,a.lon);state.apHeading=bearingBetween(state.lat,state.lon,a.lat,a.lon);
 $('destStatus').textContent=a.name.split(' · ')[0];$('distStatus').textContent=Math.round(d)+' NM';
 $('apHdgText').textContent=Math.round(state.apHeading)+'°';$('fdMode').textContent='NAV / ALT';
 atc('CENTER: Direct route loaded to '+a.name+'. Maintain terrain clearance; this is a simplified simulator.');
 toast('DIRECT ROUTE LOADED');
}
function atc(message){
 const log=$('atcLog');const stamp=new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
 state.atcMessages.push(stamp+'  '+message);if(state.atcMessages.length>4)state.atcMessages.shift();
 log.textContent=state.atcMessages.join('\n');log.scrollTop=log.scrollHeight;
}
function spawnTraffic(){
 const colors=['#ffb84d','#e9f3ff','#ff6b78'];
 for(let i=0;i<3;i++){
  const e=viewer.entities.add({name:'Simulated traffic '+(i+1),position:Cesium.Cartesian3.fromDegrees(state.lon+(i-1)*.018,state.lat+(i+1)*.012,1500+i*900),
   point:{pixelSize:7,color:Cesium.Color.fromCssColorString(colors[i]),outlineColor:Cesium.Color.BLACK,outlineWidth:1},
   label:{text:'AI '+String(i+1).padStart(2,'0'),font:'10px sans-serif',fillColor:Cesium.Color.WHITE,outlineColor:Cesium.Color.BLACK,outlineWidth:2,style:Cesium.LabelStyle.FILL_AND_OUTLINE,pixelOffset:new Cesium.Cartesian2(0,-12),showBackground:true,backgroundColor:Cesium.Color.BLACK.withAlpha(.55)}});
  state.traffic.push({entity:e,angle:i*2.1,radius:.012+i*.004,alt:1500+i*900,rate:.00015*(i+1),baseLat:state.lat,baseLon:state.lon});
 }
 $('trafficCount').textContent=String(state.traffic.length).padStart(2,'0');
}
function updateTraffic(dt){
 state.traffic.forEach((t,i)=>{t.angle+=t.rate*dt*60;const lat=t.baseLat+Math.sin(t.angle)*t.radius,lon=t.baseLon+Math.cos(t.angle)*t.radius;
  t.entity.position=Cesium.Cartesian3.fromDegrees(lon,lat,t.alt);});
}


function setSwitch(name,value){
 const idMap={ap:'apState',fd:'fdState',athr:'athrState',ils:'ilsState',terrain:'terrainState',wpt:'wptState',
  navLight:'navLightState',beacon:'beaconState',strobe:'strobeState',landing:'landingState',taxi:'taxiState',logo:'logoState',
  apu:'apuState',eng1:'eng1State',eng2:'eng2State',seatbelt:'seatbeltState',noSmoking:'noSmokingState',antiIce:'antiIceState'};
 const el=$(idMap[name]);if(el){el.textContent=value?'ON':'OFF';const btn=el.closest('button');if(btn)btn.classList.toggle('on',!!value);}
}
function updateCockpitReadouts(){
 $('selSpeed').textContent=state.selectedSpeed;$('selHeading').textContent=Math.round(state.apHeading)+'°';
 $('selAltitude').textContent=Math.round(state.apAltitude).toLocaleString();$('selVS').textContent=state.selectedVS;
 $('selQnh').textContent=state.selectedQnh+' hPa';$('selRange').textContent=state.ndRange+' NM';
 $('selFlaps').textContent=state.flaps;$('selTrim').textContent=state.trim.toFixed(1);
 $('selCom').textContent=(state.com/100).toFixed(2);$('selNav').textContent=(state.nav/100).toFixed(2);
 $('gearCockpitState').textContent=state.gear?'UP':'DOWN';$('brakeCockpitState').textContent=state.brakes?'ON':'OFF';
 Object.entries(state.lights).forEach(([k,v])=>setSwitch(k,v));Object.entries(state.systems).forEach(([k,v])=>setSwitch(k,v));
 setSwitch('ap',state.ap);setSwitch('fd',!!state.fd);setSwitch('athr',!!state.athr);setSwitch('ils',state.ils);setSwitch('terrain',state.terrainMode);setSwitch('wpt',state.waypoints);
 $('navInfo').textContent=state.destination?('DIRECT TO '+state.destination.name+' · '+Math.round(distanceNm(state.lat,state.lon,state.destination.lat,state.destination.lon))+' NM'):'NAV: no destination loaded';
 $('sysReadout').textContent='ELEC: '+(state.systems.apu?'APU AVAILABLE':'BATTERY SIM')+' · ENG1: '+(state.systems.eng1?'RUN':'OFF')+' · ENG2: '+(state.systems.eng2?'RUN':'OFF')+' · FUEL: NOT MODELLED';
}
function initCockpit(){
 $('openCockpit').onclick=()=> $('cockpitPanel').classList.remove('hidden');
 $('closeCockpit').onclick=()=> $('cockpitPanel').classList.add('hidden');
 document.querySelectorAll('.cockpit-tab').forEach(btn=>btn.onclick=()=>{
  document.querySelectorAll('.cockpit-tab').forEach(x=>x.classList.toggle('active',x===btn));
  document.querySelectorAll('.cockpit-page').forEach(x=>x.classList.toggle('active',x.dataset.page===btn.dataset.tab));
 });
 document.querySelectorAll('[data-control]').forEach(btn=>btn.onclick=()=>{
  const n=Number(btn.dataset.step),k=btn.dataset.control;
  if(k==='spd')state.selectedSpeed=clamp(state.selectedSpeed+n,100,350);
  if(k==='hdg')state.apHeading=normHeading(state.apHeading+n);
  if(k==='alt')state.apAltitude=clamp(state.apAltitude+n,0,43000);
  if(k==='vs')state.selectedVS=clamp(state.selectedVS+n,-3000,3000);
  if(k==='qnh')state.selectedQnh=clamp(state.selectedQnh+n,950,1050);
  if(k==='range')state.ndRange=[10,20,40,80,160,320][clamp([10,20,40,80,160,320].indexOf(state.ndRange)+n,0,5)];
  if(k==='flaps')state.flaps=clamp(state.flaps+n,0,3);
  if(k==='trim')state.trim=clamp(state.trim+n*.1,-1,1);
  if(k==='com')state.com=clamp(state.com+n,11800,13695);
  if(k==='nav')state.nav=clamp(state.nav+n,10800,11795);
  updateCockpitReadouts();
 });
 document.querySelectorAll('[data-action]').forEach(btn=>btn.onclick=()=>{
  const a=btn.dataset.action;
  if(a==='spd-push'){state.managed.spd=!state.managed.spd;atc('FCU: Speed selector '+(state.managed.spd?'managed':'selected')+' mode.');}
  if(a==='hdg-push'){state.routeActive=!!state.destination;atc('FCU: '+(state.routeActive?'Managed navigation armed.':'Selected heading mode.'));}
  if(a==='alt-push'){state.managed.alt=!state.managed.alt;atc('FCU: Altitude mode '+(state.managed.alt?'managed':'selected')+'.');}
  if(a==='vs-push'){state.vs=state.selectedVS;atc('FCU: Vertical speed selected '+state.selectedVS+' feet/minute.');}
  if(a==='qnh')atc('EFIS: Barometric setting set to '+state.selectedQnh+' hPa.');
  if(a==='range')atc('EFIS: Navigation display range set to '+state.ndRange+' NM.');
  if(a==='com'){state.radioStandby.com=state.com;atc('RADIO: COM 1 standby tuned to '+(state.com/100).toFixed(2)+' MHz. No real transmission.');}
  if(a==='nav'){state.radioStandby.nav=state.nav;atc('RADIO: NAV 1 standby tuned to '+(state.nav/100).toFixed(2)+' MHz. No real receiver.');}
  updateCockpitReadouts();
 });
 document.querySelectorAll('[data-toggle]').forEach(btn=>btn.onclick=()=>{
  const k=btn.dataset.toggle;
  if(k==='ap')state.ap=!state.ap;
  else if(k==='fd')state.fd=!state.fd;
  else if(k==='athr')state.athr=!state.athr;
  else if(k==='ils')state.ils=!state.ils;
  else if(k==='terrain')state.terrainMode=!state.terrainMode;
  else if(k==='wpt')state.waypoints=!state.waypoints;
  else if(state.lights[k]!==undefined)state.lights[k]=!state.lights[k];
  else if(state.systems[k]!==undefined)state.systems[k]=!state.systems[k];
  if(k==='terrain'&&state.terrainMode&&!state.terrain)atc('EFIS: Terrain display selected; detailed terrain service is not configured.');
  if(k==='apu'&&state.systems.apu)atc('SYSTEM: APU available (simulated).');
  if((k==='eng1'||k==='eng2')&&state.systems[k])atc('SYSTEM: Engine '+(k==='eng1'?'1':'2')+' running (simulated).');
  updateCockpitReadouts();
 });
 $('gearCockpit').onclick=()=>{state.gear=!state.gear;updateCockpitReadouts();atc('SYSTEM: Landing gear '+(state.gear?'UP':'DOWN')+' (simulated).');};
 $('brakeCockpit').onclick=()=>{state.brakes=!state.brakes;updateCockpitReadouts();atc('SYSTEM: Parking brake '+(state.brakes?'SET':'RELEASED')+'.');};
 $('radioGround').onclick=()=>atc('GROUND: FlightDeck, radio check acknowledged (simulated).');
 $('radioTower').onclick=()=>atc('TOWER: FlightDeck, tower frequency selected (simulated).');
 $('radioAtis').onclick=()=>atc('ATIS: '+state.weather.toUpperCase()+' visual preset. No live weather feed.');
 updateCockpitReadouts();
}

function updateUI(){
 $('ias').textContent=String(Math.round(state.speed)).padStart(3,'0');$('alt').textContent=String(Math.round(state.alt)).padStart(5,'0');
 $('vs').textContent=(state.vs>=0?'+':'')+String(Math.round(state.vs)).padStart(3,'0');$('hdg').textContent=String(Math.round(state.heading)).padStart(3,'0')+'°';
 $('pitch').textContent=(state.pitch>=0?'+':'')+state.pitch.toFixed(1)+'°';$('bank').textContent=(state.bank>=0?'+':'')+state.bank.toFixed(1)+'°';
 $('eng1').style.width=state.throttle+'%';$('eng2').style.width=state.throttle+'%';$('eng1v').textContent=Math.round(state.throttle)+'%';$('eng2v').textContent=Math.round(state.throttle)+'%';
 $('flapStatus').textContent=state.flaps;$('gearStatus').textContent=state.gear?'DOWN':'UP';$('apStatus').textContent=state.ap?'ON':'OFF';
 $('lat').textContent=Math.abs(state.lat).toFixed(4)+'° '+(state.lat>=0?'N':'S');$('lon').textContent=Math.abs(state.lon).toFixed(4)+'° '+(state.lon>=0?'E':'W');
 $('phase').textContent=state.onGround?(state.speed>5?'TAXI':'PARKED'):(state.alt<50?'TAKEOFF':'AIRBORNE');
 $('pfdIas').textContent=String(Math.round(state.speed)).padStart(3,'0');
 $('pfdAlt').textContent=String(Math.round(state.alt)).padStart(5,'0');
 $('pfdVs').textContent=(state.vs>=0?'+':'')+String(Math.round(state.vs)).padStart(3,'0');
 $('horizonSky').style.transform='rotate('+(-state.bank)+'deg) translateY('+(state.pitch*1.3)+'px)';
 $('fdMode').textContent=state.ap?(state.routeActive?'NAV / ALT':'HDG / ALT'):(state.fd?'FD ON':'FD OFF');
 updateCockpitReadouts();
 $('apHdgText').textContent=Math.round(state.apHeading)+'°';$('apAltText').textContent=Math.round(state.apAltitude).toLocaleString()+' FT';
 if(state.destination){$('destStatus').textContent=state.destination.name.split(' · ')[0];$('distStatus').textContent=Math.round(distanceNm(state.lat,state.lon,state.destination.lat,state.destination.lon))+' NM';}
}
let last=performance.now(),geomClock=0;
function tick(now){
 requestAnimationFrame(tick);const dt=Math.min((now-last)/1000,.04);last=now;
 if(!state.paused){
  if(keys.shift)state.throttle=clamp(state.throttle+dt*24,0,100);
  if(keys.control)state.throttle=clamp(state.throttle-dt*24,0,100);
  if(state.ap){
   if(state.routeActive&&state.destination)state.apHeading=bearingBetween(state.lat,state.lon,state.destination.lat,state.destination.lon);
   const hdgErr=((state.apHeading-state.heading+540)%360)-180;
   state.bank=clamp(hdgErr*.7,-25,25);
  }
  const pitchIn=state.ap?(state.selectedVS!==0?clamp(state.selectedVS/1500,-1,1):clamp((state.apAltitude-state.alt)*.0025-state.pitch*.12,-1,1)): ((keys.w||keys.arrowup?1:0)-(keys.s||keys.arrowdown?1:0));
  const rollIn=state.ap?clamp((state.bank-state.bank)*.08,-.3,.3):((keys.d?1:0)-(keys.a?1:0));
  const yawIn=(keys.e?1:0)-(keys.q?1:0);
  if(state.ap){const hdgErr=((state.apHeading-state.heading+540)%360)-180;state.bank=clamp(hdgErr*.65,-25,25);}
  else state.bank=clamp(state.bank+rollIn*35*clamp(state.speed/90,.08,1.2)*dt-state.bank*dt*.12,-65,65);
  state.pitch=clamp(state.pitch+pitchIn*15*clamp(state.speed/90,.08,1.2)*dt-state.pitch*dt*.1,-20,25);
  const drag=.018+state.speed*.00014+state.flaps*.004+(state.gear?.02:0);
  state.speed=clamp(state.speed+(state.throttle/100*30-drag*state.speed-(state.brakes&&state.onGround?state.speed*.7:0))*dt,0,340);
  state.heading=(state.heading+Math.sin(Cesium.Math.toRadians(state.bank))*state.speed*.01*dt+yawIn*15*dt+360)%360;
  const lift=state.speed*state.speed*.00068*(1+state.flaps*.12)+Math.sin(Cesium.Math.toRadians(state.pitch))*state.speed*.13-1.2;
  if(state.onGround){state.alt=0;state.verticalVelocity=0;if(state.speed>78&&!state.brakes&&state.pitch>3){state.onGround=false;toast('LIFTOFF')}}else{
   state.verticalVelocity+=(lift-state.verticalVelocity*.5)*dt;state.alt+=state.verticalVelocity*dt*3.2;
   if(state.alt<=0){state.alt=0;state.onGround=true;state.speed*=.7;state.pitch=0;toast('LANDING')}
  }
  state.vs=state.onGround?0:state.verticalVelocity*196;
  const distance=state.speed*.514444*dt/111320;
  const hr=Cesium.Math.toRadians(state.heading);
  state.lat+=Math.cos(hr)*distance;state.lon+=Math.sin(hr)*distance/Math.max(.05,Math.cos(Cesium.Math.toRadians(state.lat)));
  state.lat=clamp(state.lat,-85,85);state.lon=((state.lon+540)%360)-180;
  $('throttle').value=state.throttle;$('thrText').textContent=Math.round(state.throttle)+'%';
  geomClock+=dt;if(geomClock>.15){updateAircraftGeometry();geomClock=0}
  updateUI();updateTraffic(dt);
  if(state.destination&&distanceNm(state.lat,state.lon,state.destination.lat,state.destination.lon)<3&&state.alt<15000&&!state.onGround){state.routeActive=false;atc('CENTER: Approaching destination area. Route complete (simulated).');state.destination=null;}
 }
 updateCamera(false);
}
setAirport();spawnTraffic();initCockpit();requestAnimationFrame(tick);
addEventListener('resize',()=>viewer.resize());
})();