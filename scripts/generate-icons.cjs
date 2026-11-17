// Generate Windows PNG/ICO assets for the static Akta identity.
// Zero external dependencies: node scripts/generate-icons.cjs
// The in-app animated logo remains dynamic; these Windows assets remain emerald green.
const fs = require('fs')
const path = require('path')
const OUT = path.resolve(__dirname, '..', 'assets')
const clamp = (x,a=0,b=1) => Math.max(a,Math.min(b,x))
const mix = (a,b,t) => a+(b-a)*t
const colors = {
  bg:[11,20,48], g:[16,185,129], gm:[70,208,162],
  light:[134,229,186], light2:[178,241,216],
  white:[255,255,255], glow:[168,246,218]
}
const blend = (p,c,a) => [mix(p[0],c[0],a),mix(p[1],c[1],a),mix(p[2],c[2],a),p[3]+(1-p[3])*a]
const smooth = (d,r,aa=0.22) => clamp((r+aa-d)/(2*aa))
const seg = (x,y,x1,y1,x2,y2) => {
  const dx=x2-x1, dy=y2-y1
  const t=clamp(((x-x1)*dx+(y-y1)*dy)/(dx*dx+dy*dy))
  return Math.hypot(x-x1-t*dx,y-y1-t*dy)
}
const roundedRectSDF = (x,y,cx,cy,hx,hy,r) => {
  const qx=Math.abs(x-cx)-(hx-r),qy=Math.abs(y-cy)-(hy-r)
  return Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-r
}
function draw(n) {
  const out = new Uint8Array(n*n*4), scale=n/128, aa=0.56/scale
  const cy=89-Math.sqrt(45*45-36.5*36.5)
  const pulse=[[28,81],[61,81],[65,72],[70,89],[75,81],[100,81]]
  for(let py=0;py<n;py++) for(let px=0;px<n;px++) {
    const x=(px+.5)/scale,y=(py+.5)/scale
    const d=roundedRectSDF(x,y,64,64,64,64,29)
    const alpha=clamp(.5-d/aa)
    let p=[...colors.bg,alpha]
    if(alpha>0) {
      // Incomplete circular progression ring; no outer colored border.
      const angle=(Math.atan2(y-cy,x-64)*180/Math.PI+360)%360
      const radius=Math.abs(Math.hypot(x-64,y-cy)-45)
      const cap=Math.min(Math.hypot(x-27.5,y-89),Math.hypot(x-100.5,y-89))
      const arc=(angle>=144||angle<=36)?Math.min(radius,cap):cap
      const r=smooth(arc,3.8,aa)
      if(r>0) {
        const t=clamp((x+y-30)/177)
        p=blend(p,colors.g.map((v,i)=>mix(v,colors.gm[i],t)),r)
      }

      // One smoothly rounded A, orange/green/blue etc. uses the same hue on both sides.
      const left=smooth(seg(x,y,35,101,64,49),8.5,aa)
      const right=smooth(seg(x,y,64,49,93,101),8.5,aa)
      const mark=Math.max(left,right)
      if(mark>0) {
        const q=clamp((x-59)/8)
        const tint=colors.g.map((v,i)=>mix(v,colors.light[i],q))
        p=blend(p,tint,mark)
      }

      const dot=smooth(Math.hypot(x-94,y-34),5.4,aa)
      if(dot>0)p=blend(p,colors.white,dot)

      let pulseD=1e9
      for(let j=1;j<pulse.length;j++)
        pulseD=Math.min(pulseD,seg(x,y,...pulse[j-1],...pulse[j]))
      if(n>=32) {
        const halo=smooth(pulseD,4.3,aa)*.29
        if(halo>0)p=blend(p,colors.white,halo)
      }
      const core=smooth(pulseD,n<=24?2.35:1.9,aa)
      if(core>0)p=blend(p,colors.white,core)
    }
    const k=(py*n+px)*4
    out[k]=Math.round(clamp(p[0],0,255))
    out[k+1]=Math.round(clamp(p[1],0,255))
    out[k+2]=Math.round(clamp(p[2],0,255))
    out[k+3]=Math.round(clamp(p[3],0,1)*255)
  }
  return out
}
const be32=v=>[(v>>>24)&255,(v>>>16)&255,(v>>>8)&255,v&255]
const le16=v=>[v&255,(v>>>8)&255]
const le32=v=>[v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255]
const table=new Uint32Array(256)
for(let n=0;n<256;n++) {
  let c=n
  for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1)
  table[n]=c>>>0
}
function crc32(bytes) {
  let crc=0xffffffff
  for(let i=0;i<bytes.length;i++)crc=table[(crc^bytes[i])&255]^(crc>>>8)
  return (crc^0xffffffff)>>>0
}
function chunk(type,data) {
  const t=Array.from(type).map(x=>x.charCodeAt(0))
  const content=Uint8Array.from([...t,...data])
  return Uint8Array.from([...be32(data.length),...content,...be32(crc32(content))])
}
function zlibStored(raw) {
  const a=[0x78,0x01]
  for(let pos=0;pos<raw.length;) {
    const size=Math.min(65535,raw.length-pos)
    const final=(pos+size>=raw.length)?1:0
    a.push(final,size&255,(size>>>8)&255,(~size)&255,((~size)>>>8)&255)
    for(let j=0;j<size;j++)a.push(raw[pos+j])
    pos+=size
  }
  let s1=1,s2=0
  for(const v of raw){s1=(s1+v)%65521;s2=(s2+s1)%65521}
  a.push(...be32((s2<<16)|s1))
  return Uint8Array.from(a)
}
function png(n) {
  const raw=new Uint8Array(n*(n*4+1)),rgba=draw(n)
  for(let y=0;y<n;y++)raw.set(rgba.subarray(y*n*4,(y+1)*n*4),y*(n*4+1)+1)
  const parts=[
    Uint8Array.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR',Uint8Array.from([...be32(n),...be32(n),8,6,0,0,0])),
    chunk('IDAT',zlibStored(raw)),
    chunk('IEND',new Uint8Array(0))
  ]
  return Buffer.concat(parts.map(x=>Buffer.from(x)))
}
function ico(entries) {
  let offset=6+16*entries.length
  const header=[0,0,1,0,...le16(entries.length)]
  for(const [n,data] of entries) {
    header.push(n===256?0:n,n===256?0:n,0,0,1,0,32,0,...le32(data.length),...le32(offset))
    offset+=data.length
  }
  return Buffer.concat([Buffer.from(header),...entries.map(e=>e[1])])
}
fs.writeFileSync(path.join(OUT,'icon.png'),png(512))
const sizes=[16,24,32,48,64,128,256]
fs.writeFileSync(path.join(OUT,'icon.ico'),ico(sizes.map(n=>[n,png(n)])))
console.log('Generated assets/icon.png and assets/icon.ico (emerald identity)')
