(function(){
'use strict';

// 기기에 설치된 글꼴만 쓴다(외부 CDN 금지). 없는 글꼴은 뒤쪽 후보로 자동 대체된다
var FONTS = [
  {name:'고딕', f:"'Apple SD Gothic Neo',-apple-system,BlinkMacSystemFont,'Malgun Gothic','Noto Sans KR',sans-serif"},
  {name:'명조', f:"'AppleMyungjo','Nanum Myeongjo','Batang','Noto Serif KR',serif"},
  {name:'굴림', f:"'Gulim','굴림','AppleGothic','Apple SD Gothic Neo',sans-serif"},
  {name:'영문', f:"'Helvetica Neue','Segoe UI',Arial,sans-serif"}
];
var cv = document.getElementById('cv');
var ctx = cv.getContext('2d');

// 순서를 바꾸면 저장된 accent 인덱스가 다른 색을 가리킨다 → 새 색은 뒤에만 추가할 것
var ACCENTS = [
  {name:'핑크',   c:'#FF3D7F', on:'#ffffff'},
  {name:'옐로우', c:'#FFD400', on:'#141414'},
  {name:'블루',   c:'#2F6BFF', on:'#ffffff'},
  {name:'그린',   c:'#00C08B', on:'#0b241d'},
  {name:'화이트', c:'#FFFFFF', on:'#141414'},
  {name:'레드',   c:'#FF3B30', on:'#ffffff'},
  {name:'오렌지', c:'#FF7A00', on:'#ffffff'},
  {name:'라임',   c:'#A8E10C', on:'#16240a'},
  {name:'민트',   c:'#2ED9C3', on:'#06231f'},
  {name:'스카이', c:'#38B6FF', on:'#05213a'},
  {name:'퍼플',   c:'#8B5CF6', on:'#ffffff'},
  {name:'네이비', c:'#1B2A6B', on:'#ffffff'},
  {name:'블랙',   c:'#141414', on:'#ffffff'}
];
var TEMPLATES = [
  {id:'classic',  name:'클래식'},
  {id:'center',   name:'센터'},
  {id:'band',     name:'하단밴드'},
  {id:'minimal',  name:'미니멀'},
  {id:'magazine', name:'매거진'},
  {id:'quote',    name:'인용'},
  {id:'solid',    name:'단색', text:true},
  {id:'gradient', name:'그라디언트', text:true},
  {id:'stat',     name:'숫자강조', text:true}
];
function isTextTpl(id){
  for(var i=0;i<TEMPLATES.length;i++) if(TEMPLATES[i].id === id) return !!TEMPLATES[i].text;
  return false;
}
var RATIOS = [{id:'feed',name:'피드 4:5',w:1080,h:1350},{id:'story',name:'스토리 9:16',w:1080,h:1920}];

var S = {
  tpl:'classic', ratio:'feed', accent:0, font:0,
  focus:50, dim:100, ts:76, ss:32, ty:0,
  category:'', subtitle:'', tag:'', title1:'', title2:'', subhead:'', author:''
};

/* ---------- 이미지 ---------- */
var srcCanvas = null;      // 업로드 사진(최대 1600px로 축소)

// file:// 로 열었을 때 blob URL은 캔버스를 오염시켜 저장이 막힘 → data URL로 읽는다
function loadFile(f){
  if(!f) return;
  var fr = new FileReader();
  fr.onload = function(){
    var im = new Image();
    im.onload = function(){
      var MAX = 1600;
      var r = Math.min(1, MAX/Math.max(im.width, im.height));
      var w = Math.max(1, Math.round(im.width*r)), h = Math.max(1, Math.round(im.height*r));
      var c = document.createElement('canvas'); c.width=w; c.height=h;
      var g = c.getContext('2d');
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(im, 0, 0, w, h);
      srcCanvas = c;
      document.getElementById('fileLabel').firstChild.nodeValue = '사진 변경하기';
      schedule();
    };
    im.onerror = function(){ alert('이미지를 불러오지 못했습니다.'); };
    im.src = fr.result;
  };
  fr.onerror = function(){ alert('사진을 읽지 못했습니다.'); };
  fr.readAsDataURL(f);
}

/* ---------- 그리기 유틸 ---------- */
function rr(g, x, y, w, h, r){
  r = Math.min(r, w/2, h/2);
  g.beginPath();
  g.moveTo(x+r,y); g.lineTo(x+w-r,y); g.quadraticCurveTo(x+w,y,x+w,y+r);
  g.lineTo(x+w,y+h-r); g.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  g.lineTo(x+r,y+h); g.quadraticCurveTo(x,y+h,x,y+h-r);
  g.lineTo(x,y+r); g.quadraticCurveTo(x,y,x+r,y); g.closePath();
}
function font(weight, size){ return weight + ' ' + size + 'px ' + (FONTS[S.font] || FONTS[0]).f; }
// 사진 위 글씨엔 그림자가 필요하지만, 단색 배경에선 지저분해져서 템플릿이 끈다
var TEXT_SHADOW = true;
function shadow(g, on){
  if(on && TEXT_SHADOW){ g.shadowColor='rgba(0,0,0,0.42)'; g.shadowBlur=18; g.shadowOffsetY=2; }
  else { g.shadowColor='transparent'; g.shadowBlur=0; g.shadowOffsetY=0; }
}
function hex2rgb(h){
  h = String(h).replace('#','');
  if(h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
function mix(a, b, t){
  var A = hex2rgb(a), B = hex2rgb(b);
  return 'rgb(' + A.map(function(v,i){ return Math.round(v + (B[i]-v)*t); }).join(',') + ')';
}
function isLight(c){
  var r = hex2rgb(c);
  return (0.299*r[0] + 0.587*r[1] + 0.114*r[2])/255 > 0.6;
}
// "[강조] 나머지" → 세그먼트
function segs(text){
  var out=[], i=0, re=/\[([^\]]*)\]/g, m;
  while((m = re.exec(text)) !== null){
    if(m.index > i) out.push({t:text.slice(i,m.index), h:false});
    out.push({t:m[1], h:true});
    i = m.index + m[0].length;
  }
  if(i < text.length) out.push({t:text.slice(i), h:false});
  return out.filter(function(s){ return s.t !== ''; });
}
function segWidth(g, ss, size){
  var w = 0;
  for(var i=0;i<ss.length;i++){
    w += g.measureText(ss[i].t).width;
    if(ss[i].h) w += size*0.18;
  }
  return w;
}
// baseline 기준으로 그리기. align: 'left' | 'center'
function drawSegs(g, ss, x, baseline, size, accent, onAccent, color, align, maxW){
  g.textAlign = 'left';   // 세그먼트는 좌측 기준으로 직접 배치
  var total = segWidth(g, ss, size);
  var cx = align === 'center' ? x - total/2 : x;
  for(var i=0;i<ss.length;i++){
    var s = ss[i], w = g.measureText(s.t).width;
    if(s.h){
      // 형광펜 박스는 좌우 여백이 같아야 한다. 어긋나면 줄 전체의 가운데 정렬까지 틀어진다
      var pad = size*0.09;
      shadow(g, false);
      g.fillStyle = accent;
      rr(g, cx, baseline - size*0.84, w + pad*2, size*1.12, size*0.14);
      g.fill();
      g.fillStyle = onAccent;
      g.fillText(s.t, cx + pad, baseline);
      cx += w + pad*2;
    }else{
      shadow(g, true);
      g.fillStyle = color;
      g.fillText(s.t, cx, baseline);
      cx += w;
    }
  }
  shadow(g, false);
  return total;
}
// maxW 안에 들어가도록 폰트 크기 자동 축소
function fitSize(g, ss, weight, size, maxW){
  var s = size;
  while(s > 14){
    g.font = font(weight, s);
    if(segWidth(g, ss, s) <= maxW) break;
    s -= 2;
  }
  g.font = font(weight, s);
  return s;
}
// 글자 블록 상하 이동량. 각 템플릿의 텍스트 시작 y에만 더한다 (배경/상단줄은 고정)
function ty(k){ return S.ty*k; }
function lines(text, max){
  var a = String(text||'').split('\n').map(function(x){return x.trim();}).filter(function(x){return x!=='';});
  return a.slice(0, max);
}

/* ---------- 배경 ---------- */
function drawPhoto(g, W, H){
  var src = srcCanvas;
  if(!src){
    var pg = g.createLinearGradient(0,0,W,H);
    pg.addColorStop(0,'#2b3040'); pg.addColorStop(1,'#12141b');
    g.fillStyle = pg; g.fillRect(0,0,W,H);
    g.fillStyle = 'rgba(255,255,255,0.30)';
    g.font = font(700, 34); g.textAlign='center';
    g.fillText('사진을 선택하세요', W/2, H/2);
    g.textAlign='left';
    return;
  }
  // cover (레터박스 없이 꽉 채움)
  var sr = src.width/src.height, dr = W/H, dw, dh;
  if(sr > dr){ dh = H; dw = H*sr; } else { dw = W; dh = W/sr; }
  var dx = (W - dw)/2;
  var dy = (H - dh) * (S.focus/100);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality='high';
  g.drawImage(src, dx, dy, dw, dh);
}
function grad(g, W, H, stops){
  var lg = g.createLinearGradient(0,0,0,H);
  for(var i=0;i<stops.length;i++) lg.addColorStop(stops[i][0], 'rgba(0,0,0,'+ (stops[i][1]*S.dim/100).toFixed(3) +')');
  g.fillStyle = lg; g.fillRect(0,0,W,H);
}

/* ---------- 공통 파트 ---------- */
// opt: {dim, tagBg, tagFg} — 단색 배경 템플릿에서 색을 갈아끼우기 위한 것
function topRow(g, W, k, color, align, opt){
  var y = 96*k, x = 72*k, size = 30*k;
  color = color || '#fff';
  opt = opt || {};
  var dimColor = opt.dim || (isLight(color) ? 'rgba(255,255,255,0.78)' : 'rgba(0,0,0,0.55)');
  g.textBaseline = 'alphabetic';
  shadow(g, true);
  if(align === 'center'){
    g.textAlign = 'center';
    var parts = [];
    if(S.category) parts.push(S.category);
    if(S.subtitle) parts.push('· ' + S.subtitle);
    g.font = font(800, size); g.fillStyle = color;
    g.fillText(parts.join('  '), W/2, y);
    g.textAlign = 'left';
  }else{
    var cx = x;
    if(S.category){
      g.font = font(800, size); g.fillStyle = color;
      g.fillText(S.category, cx, y); cx += g.measureText(S.category).width;
    }
    if(S.subtitle){
      g.font = font(500, size); g.fillStyle = dimColor;
      g.fillText('  · ' + S.subtitle, cx, y);
    }
  }
  if(S.tag){
    g.font = font(700, 25*k);
    g.textAlign = 'right';
    var acc = ACCENTS[S.accent];
    var tw = g.measureText(S.tag).width;
    // 알약 안에서 글자를 정확히 가운데 두려면 알약 사각형을 기준으로 좌표를 잡아야 한다
    var padX = 22*k, ph = 44*k;
    var px = W - 72*k - tw - padX*2, py = y - 27*k;
    shadow(g, false);
    g.fillStyle = opt.tagBg || acc.c;
    rr(g, px, py, tw + padX*2, ph, ph/2);
    g.fill();
    g.fillStyle = opt.tagFg || acc.on;
    g.textBaseline = 'middle';
    g.fillText(S.tag, px + padX + tw, py + ph/2);
    g.textBaseline = 'alphabetic';
    g.textAlign = 'left';
  }
  shadow(g, false);
}
function authorLine(g, x, baseline, k, color, align){
  if(!S.author) return;
  var size = 26*k;
  g.font = font(600, size);
  g.textAlign = align === 'center' ? 'center' : 'left';
  shadow(g, true);
  g.fillStyle = color;
  var t = '—  ' + S.author;
  g.fillText(t, x, baseline);
  shadow(g, false);
  g.textAlign = 'left';
}

/* ---------- 템플릿 ---------- */
function tplClassic(g, W, H, k){
  drawPhoto(g, W, H);
  grad(g, W, H, [[0,0.46],[0.30,0.10],[0.58,0.34],[1,0.88]]);
  topRow(g, W, k, '#fff', 'left');

  var acc = ACCENTS[S.accent];
  var pad = 72*k, maxW = W - pad*2;
  var y = H - 92*k + ty(k);

  if(S.author){ authorLine(g, pad, y, k, 'rgba(255,255,255,0.85)'); y -= 52*k; }

  var sub = lines(S.subhead, 2), ssz = S.ss*k;
  for(var i=sub.length-1;i>=0;i--){
    g.font = font(500, ssz);
    shadow(g, true); g.fillStyle = 'rgba(255,255,255,0.86)';
    g.fillText(sub[i], pad, y);
    shadow(g, false);
    y -= ssz*1.45;
  }
  if(sub.length) y -= 18*k;

  var t2 = segs(S.title2), t1 = segs(S.title1);
  if(t2.length){
    var s2 = fitSize(g, t2, 800, S.ts*k, maxW);
    drawSegs(g, t2, pad, y, s2, acc.c, acc.on, '#fff', 'left');
    y -= s2*1.24;
  }
  if(t1.length){
    var s1 = fitSize(g, t1, 800, S.ts*k, maxW);
    drawSegs(g, t1, pad, y, s1, acc.c, acc.on, '#fff', 'left');
  }
}

function tplCenter(g, W, H, k){
  drawPhoto(g, W, H);
  grad(g, W, H, [[0,0.50],[0.32,0.22],[0.62,0.42],[1,0.80]]);
  topRow(g, W, k, '#fff', 'center');

  var acc = ACCENTS[S.accent];
  var maxW = W - 130*k;
  var t1 = segs(S.title1), t2 = segs(S.title2), sub = lines(S.subhead, 2);
  var ssz = S.ss*k;
  var s1 = t1.length ? fitSize(g, t1, 800, S.ts*k, maxW) : 0;
  var s2 = t2.length ? fitSize(g, t2, 800, S.ts*k, maxW) : 0;
  var blockH = (s1?s1*1.22:0) + (s2?s2*1.22:0) + (sub.length? 40*k + sub.length*ssz*1.45 : 0);
  var y = H*0.54 - blockH/2 + (s1||s2)*0.86 + ty(k);

  if(t1.length){ g.font = font(800, s1); drawSegs(g, t1, W/2, y, s1, acc.c, acc.on, '#fff', 'center'); y += s1*1.22; }
  if(t2.length){ g.font = font(800, s2); drawSegs(g, t2, W/2, y, s2, acc.c, acc.on, '#fff', 'center'); y += s2*1.22; }

  if(sub.length){
    y += 16*k;
    g.strokeStyle = acc.c; g.lineWidth = 4*k;
    g.beginPath(); g.moveTo(W/2 - 30*k, y - ssz*0.55); g.lineTo(W/2 + 30*k, y - ssz*0.55); g.stroke();
    y += 26*k;
    g.textAlign = 'center';
    for(var i=0;i<sub.length;i++){
      g.font = font(500, ssz);
      shadow(g, true); g.fillStyle = 'rgba(255,255,255,0.88)';
      g.fillText(sub[i], W/2, y);
      shadow(g, false);
      y += ssz*1.45;
    }
    g.textAlign = 'left';
  }
  authorLine(g, W/2, H - 92*k, k, 'rgba(255,255,255,0.85)', 'center');
}

function tplBand(g, W, H, k){
  var acc = ACCENTS[S.accent];
  var bandTop = H*0.60;
  drawPhoto(g, W, H);
  grad(g, W, H, [[0,0.42],[0.35,0.06],[1,0.10]]);
  topRow(g, W, k, '#fff', 'left');

  g.fillStyle = '#ffffff';
  g.fillRect(0, bandTop, W, H - bandTop);
  g.fillStyle = acc.c;
  g.fillRect(0, bandTop, W, 10*k);

  var pad = 72*k, maxW = W - pad*2;
  var y = bandTop + 92*k + ty(k);
  var t1 = segs(S.title1), t2 = segs(S.title2);
  if(t1.length){
    var s1 = fitSize(g, t1, 800, S.ts*k, maxW);
    drawSegs(g, t1, pad, y, s1, acc.c, acc.on, '#111318', 'left'); y += s1*1.22;
  }
  if(t2.length){
    var s2 = fitSize(g, t2, 800, S.ts*k, maxW);
    drawSegs(g, t2, pad, y, s2, acc.c, acc.on, '#111318', 'left'); y += s2*1.22;
  }
  var sub = lines(S.subhead, 2), ssz = S.ss*k;
  if(sub.length){
    y += 12*k;
    for(var i=0;i<sub.length;i++){
      g.font = font(500, ssz); g.fillStyle = 'rgba(20,22,28,0.66)';
      g.fillText(sub[i], pad, y); y += ssz*1.45;
    }
  }
  if(S.author){
    g.font = font(600, 26*k); g.fillStyle = 'rgba(20,22,28,0.55)';
    g.fillText('—  ' + S.author, pad, H - 72*k);
  }
}

function tplMinimal(g, W, H, k){
  drawPhoto(g, W, H);
  grad(g, W, H, [[0,0.62],[0.55,0.26],[1,0.62]]);
  var acc = ACCENTS[S.accent];
  var pad = 78*k, maxW = W - pad*2;

  topRow(g, W, k, '#fff', 'left');

  var y = 210*k + ty(k);
  g.fillStyle = acc.c; g.fillRect(pad, y - 40*k, 88*k, 6*k);
  y += 52*k;

  var t1 = segs(S.title1), t2 = segs(S.title2);
  if(t1.length){
    var s1 = fitSize(g, t1, 300, S.ts*k, maxW);
    drawSegs(g, t1, pad, y, s1, acc.c, acc.on, '#fff', 'left'); y += s1*1.26;
  }
  if(t2.length){
    var s2 = fitSize(g, t2, 800, S.ts*k, maxW);
    drawSegs(g, t2, pad, y, s2, acc.c, acc.on, '#fff', 'left'); y += s2*1.26;
  }
  var sub = lines(S.subhead, 2), ssz = S.ss*k;
  if(sub.length){
    y += 18*k;
    for(var i=0;i<sub.length;i++){
      g.font = font(400, ssz);
      shadow(g, true); g.fillStyle = 'rgba(255,255,255,0.82)';
      g.fillText(sub[i], pad, y); shadow(g, false);
      y += ssz*1.5;
    }
  }
  authorLine(g, pad, H - 92*k, k, 'rgba(255,255,255,0.8)');
}

function tplMagazine(g, W, H, k){
  drawPhoto(g, W, H);
  grad(g, W, H, [[0,0.40],[0.28,0.08],[0.55,0.36],[1,0.92]]);
  topRow(g, W, k, '#fff', 'left');

  var acc = ACCENTS[S.accent];
  var barX = 72*k, pad = barX + 34*k, maxW = W - pad - 72*k;
  var y = H - 92*k + ty(k);

  if(S.author){ authorLine(g, pad, y, k, 'rgba(255,255,255,0.85)'); y -= 54*k; }

  var sub = lines(S.subhead, 2), ssz = S.ss*k;
  for(var i=sub.length-1;i>=0;i--){
    g.font = font(500, ssz);
    shadow(g, true); g.fillStyle='rgba(255,255,255,0.85)';
    g.fillText(sub[i], pad, y); shadow(g, false);
    y -= ssz*1.45;
  }
  if(sub.length) y -= 20*k;

  var bottomOfTitle = y + 12*k;
  var t2 = segs(S.title2), t1 = segs(S.title1);
  if(t2.length){
    var s2 = fitSize(g, t2, 900, S.ts*k, maxW);
    drawSegs(g, t2, pad, y, s2, acc.c, acc.on, '#fff', 'left'); y -= s2*1.2;
  }
  if(t1.length){
    var s1 = fitSize(g, t1, 900, S.ts*k, maxW);
    drawSegs(g, t1, pad, y, s1, acc.c, acc.on, '#fff', 'left'); y -= s1*0.94;
  }
  g.fillStyle = acc.c;
  g.fillRect(barX, y + 6*k, 8*k, bottomOfTitle - y - 6*k);
}

function tplQuote(g, W, H, k){
  drawPhoto(g, W, H);
  grad(g, W, H, [[0,0.66],[0.5,0.58],[1,0.78]]);
  topRow(g, W, k, '#fff', 'center');

  var acc = ACCENTS[S.accent];
  var maxW = W - 150*k;
  var t1 = segs(S.title1), t2 = segs(S.title2), sub = lines(S.subhead, 2);
  var ssz = S.ss*k;
  var s1 = t1.length ? fitSize(g, t1, 700, S.ts*k, maxW) : 0;
  var s2 = t2.length ? fitSize(g, t2, 700, S.ts*k, maxW) : 0;
  var blockH = (s1?s1*1.3:0) + (s2?s2*1.3:0) + (sub.length? 46*k + sub.length*ssz*1.5 : 0);
  var top = H*0.52 - blockH/2 + ty(k);

  g.textAlign='center';
  g.font = font(800, 150*k);
  g.fillStyle = acc.c;
  g.fillText('\u201C', W/2, top - 40*k);
  g.textAlign = 'left';

  var y = top + (s1||s2)*0.86;
  if(t1.length){ g.font = font(700, s1); drawSegs(g, t1, W/2, y, s1, acc.c, acc.on, '#fff', 'center'); y += s1*1.3; }
  if(t2.length){ g.font = font(700, s2); drawSegs(g, t2, W/2, y, s2, acc.c, acc.on, '#fff', 'center'); y += s2*1.3; }
  if(sub.length){
    y += 30*k;
    g.textAlign='center';
    for(var i=0;i<sub.length;i++){
      g.font = font(400, ssz);
      shadow(g, true); g.fillStyle='rgba(255,255,255,0.8)';
      g.fillText(sub[i], W/2, y); shadow(g, false);
      y += ssz*1.5;
    }
  }
  g.textAlign='left';
  authorLine(g, W/2, H - 92*k, k, 'rgba(255,255,255,0.88)', 'center');
}

/* ---------- 텍스트 전용 템플릿 (사진 없이) ---------- */
// 단색 배경 + 큰 제목
function tplSolid(g, W, H, k){
  TEXT_SHADOW = false;
  var acc = ACCENTS[S.accent];
  var bg = acc.c, fg = acc.on;
  var dim = isLight(bg) ? 'rgba(20,22,28,0.60)' : 'rgba(255,255,255,0.72)';
  g.fillStyle = bg; g.fillRect(0,0,W,H);

  topRow(g, W, k, fg, 'left', {dim:dim, tagBg:fg, tagFg:bg});

  var pad = 78*k, maxW = W - pad*2;
  var t1 = segs(S.title1), t2 = segs(S.title2), sub = lines(S.subhead, 2), ssz = S.ss*k;
  var s1 = t1.length ? fitSize(g, t1, 800, S.ts*k*1.15, maxW) : 0;
  var s2 = t2.length ? fitSize(g, t2, 800, S.ts*k*1.15, maxW) : 0;
  var blockH = (s1?s1*1.24:0) + (s2?s2*1.24:0) + (sub.length? 34*k + sub.length*ssz*1.5 : 0);
  var y = H*0.50 - blockH/2 + (s1||s2)*0.86 + ty(k);

  // 강조는 배경과 반대로 뒤집어야 보인다
  if(t1.length){ g.font = font(800, s1); drawSegs(g, t1, pad, y, s1, fg, bg, fg, 'left'); y += s1*1.24; }
  if(t2.length){ g.font = font(800, s2); drawSegs(g, t2, pad, y, s2, fg, bg, fg, 'left'); y += s2*1.24; }
  if(sub.length){
    y += 34*k;
    for(var i=0;i<sub.length;i++){
      g.font = font(500, ssz); g.fillStyle = dim;
      g.fillText(sub[i], pad, y); y += ssz*1.5;
    }
  }
  g.fillStyle = fg; g.globalAlpha = 0.35;
  g.fillRect(pad, H - 150*k, 74*k, 5*k);
  g.globalAlpha = 1;
  authorLine(g, pad, H - 92*k, k, dim);
}

// 그라디에이션 배경
function tplGradient(g, W, H, k){
  TEXT_SHADOW = false;
  var acc = ACCENTS[S.accent];
  var deep = isLight(acc.c) ? mix(acc.c, '#1a1c22', 0.86) : mix(acc.c, '#07080b', 0.78);
  var lg = g.createLinearGradient(0, 0, W*0.35, H);
  lg.addColorStop(0, mix(acc.c, '#ffffff', isLight(acc.c) ? 0.05 : 0.18));
  lg.addColorStop(0.55, acc.c);
  lg.addColorStop(1, deep);
  g.fillStyle = lg; g.fillRect(0,0,W,H);

  var fg = isLight(acc.c) ? '#141414' : '#ffffff';
  var dim = isLight(acc.c) ? 'rgba(20,22,28,0.62)' : 'rgba(255,255,255,0.74)';
  topRow(g, W, k, fg, 'center', {dim:dim, tagBg:fg, tagFg:deep});

  var maxW = W - 140*k;
  var t1 = segs(S.title1), t2 = segs(S.title2), sub = lines(S.subhead, 2), ssz = S.ss*k;
  var s1 = t1.length ? fitSize(g, t1, 800, S.ts*k*1.1, maxW) : 0;
  var s2 = t2.length ? fitSize(g, t2, 800, S.ts*k*1.1, maxW) : 0;
  var blockH = (s1?s1*1.24:0) + (s2?s2*1.24:0) + (sub.length? 44*k + sub.length*ssz*1.5 : 0);
  var y = H*0.50 - blockH/2 + (s1||s2)*0.86 + ty(k);

  if(t1.length){ g.font = font(800, s1); drawSegs(g, t1, W/2, y, s1, fg, deep, fg, 'center'); y += s1*1.24; }
  if(t2.length){ g.font = font(800, s2); drawSegs(g, t2, W/2, y, s2, fg, deep, fg, 'center'); y += s2*1.24; }
  if(sub.length){
    y += 20*k;
    g.strokeStyle = fg; g.globalAlpha = 0.4; g.lineWidth = 4*k;
    g.beginPath(); g.moveTo(W/2-34*k, y-ssz*0.6); g.lineTo(W/2+34*k, y-ssz*0.6); g.stroke();
    g.globalAlpha = 1;
    y += 30*k;
    g.textAlign = 'center';
    for(var i=0;i<sub.length;i++){
      g.font = font(500, ssz); g.fillStyle = dim;
      g.fillText(sub[i], W/2, y); y += ssz*1.5;
    }
    g.textAlign = 'left';
  }
  authorLine(g, W/2, H - 92*k, k, dim, 'center');
}

// 숫자/통계 강조 — 제목 1행에 숫자, 2행에 설명
function tplStat(g, W, H, k){
  TEXT_SHADOW = false;
  var acc = ACCENTS[S.accent];
  var bg = '#0d0f14';
  g.fillStyle = bg; g.fillRect(0,0,W,H);
  // 은은한 방사형 포인트
  var rg = g.createRadialGradient(W*0.5, H*0.42, 0, W*0.5, H*0.42, W*0.72);
  rg.addColorStop(0, mix(acc.c, bg, 0.82));
  rg.addColorStop(1, bg);
  g.fillStyle = rg; g.fillRect(0,0,W,H);

  topRow(g, W, k, '#fff', 'center', {dim:'rgba(255,255,255,0.62)'});

  var maxW = W - 120*k;
  var num = segs(S.title1), desc = segs(S.title2), sub = lines(S.subhead, 2), ssz = S.ss*k;
  var ns = num.length ? fitSize(g, num, 900, S.ts*k*3.4, maxW) : 0;   // ts 76 → 258 (기존 값)
  var ds = desc.length ? fitSize(g, desc, 700, S.ts*k*0.72, maxW) : 0;
  var blockH = (ns?ns*1.06:0) + (ds? 34*k + ds*1.2 : 0) + (sub.length? 40*k + sub.length*ssz*1.5 : 0);
  var y = H*0.47 - blockH/2 + ns*0.78 + ty(k);

  if(num.length){
    g.font = font(900, ns);
    drawSegs(g, num, W/2, y, ns, '#ffffff', bg, acc.c, 'center');
    y += ns*0.30;
  }
  if(desc.length){
    y += 34*k;
    g.font = font(700, ds);
    drawSegs(g, desc, W/2, y, ds, acc.c, acc.on, '#ffffff', 'center');
    y += ds*0.34;
  }
  if(sub.length){
    y += 52*k;
    g.textAlign = 'center';
    for(var i=0;i<sub.length;i++){
      g.font = font(400, ssz); g.fillStyle = 'rgba(255,255,255,0.66)';
      g.fillText(sub[i], W/2, y); y += ssz*1.5;
    }
    g.textAlign = 'left';
  }
  g.fillStyle = acc.c;
  rr(g, W/2 - 36*k, H - 150*k, 72*k, 5*k, 3*k); g.fill();
  authorLine(g, W/2, H - 92*k, k, 'rgba(255,255,255,0.66)', 'center');
}

var DRAW = {classic:tplClassic, center:tplCenter, band:tplBand, minimal:tplMinimal, magazine:tplMagazine, quote:tplQuote,
            solid:tplSolid, gradient:tplGradient, stat:tplStat};

/* ---------- 렌더 ---------- */
var rafId = 0;
function schedule(){
  if(rafId) return;
  rafId = requestAnimationFrame(function(){ rafId = 0; render(); });
}
function render(){
  var r = RATIOS.filter(function(x){return x.id===S.ratio;})[0];
  if(cv.width !== r.w || cv.height !== r.h){ cv.width = r.w; cv.height = r.h; }
  var W = cv.width, H = cv.height, k = W/1080;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,W,H);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
  TEXT_SHADOW = true;   // 사진 템플릿 기본값. 텍스트 템플릿이 각자 끈다
  (DRAW[S.tpl] || tplClassic)(ctx, W, H, k);
}

/* ---------- 저장 ---------- */
function fileName(){
  var t = (S.title1 + ' ' + S.title2).replace(/[\[\]]/g,'').replace(/[\\/:*?"<>|]/g,'').trim();
  return (t ? t.slice(0,30) : 'cardnews') + '.png';
}
function toBlob(){
  return new Promise(function(res){
    if(cv.toBlob) cv.toBlob(function(b){ res(b); }, 'image/png');
    else res(null);
  });
}
function isIOS(){
  return /iP(hone|ad|od)/.test(navigator.platform || '') ||
         /iPhone|iPad|iPod/.test(navigator.userAgent) ||
         (/Mac/.test(navigator.userAgent) && navigator.maxTouchPoints > 1); // iPadOS
}
function showLongPress(){
  try{
    document.getElementById('ovImg').src = cv.toDataURL('image/png');
    document.getElementById('saveOverlay').style.display = 'flex';
  }catch(e){ alert('이미지 생성에 실패했습니다.'); }
}
async function save(){
  var name = fileName();
  var blob = await toBlob();

  // 1) Web Share API — 모바일에서만. (데스크톱 크롬/윈도우는 OS 공유창이 떠서 오히려 불편)
  var isMobile = (navigator.maxTouchPoints > 1) &&
                 (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  if(isMobile && blob && navigator.canShare && window.File){
    try{
      var f = new File([blob], name, {type:'image/png'});
      if(navigator.canShare({files:[f]})){
        await navigator.share({files:[f]});
        return;
      }
    }catch(e){
      if(e && e.name === 'AbortError') return; // 사용자가 취소
    }
  }
  // 2) <a download> — iOS 사파리는 'download' 속성이 있어도 실제로 저장이 안 되므로 건너뛴다
  if(blob && !isIOS()){
    try{
      var a = document.createElement('a');
      if('download' in a){
        var url = URL.createObjectURL(blob);
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
        return;
      }
    }catch(e){}
  }
  // 3) 길게 눌러 저장 (최후의 보루 — 어디서든 작동)
  showLongPress();
}

/* ---------- localStorage ---------- */
var KEEP = ['category','subtitle','tag','author','tpl','accent','font'];
var LS = 'cardnews.v1';
function saveKeep(){
  try{
    var o = {};
    KEEP.forEach(function(k){ o[k] = S[k]; });
    localStorage.setItem(LS, JSON.stringify(o));
  }catch(e){}
}
function loadKeep(){
  try{
    var o = JSON.parse(localStorage.getItem(LS) || '{}');
    KEEP.forEach(function(k){ if(o[k] !== undefined && o[k] !== null) S[k] = o[k]; });
  }catch(e){}
}

/* ---------- UI 바인딩 ---------- */
function bindText(id, key, keep){
  var el = document.getElementById(id);
  el.value = S[key];
  el.addEventListener('input', function(){
    S[key] = el.value;
    if(keep) saveKeep();
    schedule();
  });
}
function bindRange(id, key, valId){
  var el = document.getElementById(id), out = document.getElementById(valId);
  el.value = S[key]; out.textContent = S[key];
  el.addEventListener('input', function(){
    S[key] = +el.value; out.textContent = el.value; schedule();
  });
}
function syncPhotoCard(){
  var textOnly = isTextTpl(S.tpl);
  document.getElementById('photoCard').style.display = textOnly ? 'none' : '';
  document.getElementById('titleHint').textContent = (S.tpl === 'stat')
    ? '숫자가 들어갑니다 (예: 92%)'
    : '';
}
function buildOpts(hostId, items, key, onPick){
  var host = document.getElementById(hostId);
  host.innerHTML = '';
  items.forEach(function(it){
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'opt' + (S[key] === it.id ? ' on' : '');
    b.textContent = it.name;
    b.addEventListener('click', function(){
      S[key] = it.id;
      Array.prototype.forEach.call(host.children, function(c){ c.classList.remove('on'); });
      b.classList.add('on');
      if(onPick) onPick();
      schedule();
    });
    host.appendChild(b);
  });
}

loadKeep();

buildOpts('tpl', TEMPLATES, 'tpl', function(){ saveKeep(); syncPhotoCard(); });
buildOpts('ratio', RATIOS.map(function(r){return {id:r.id, name:r.name};}), 'ratio');
buildOpts('fontOpts', FONTS.map(function(f, i){ return {id:i, name:f.name}; }), 'font', saveKeep);
// 버튼 글씨도 실제 글꼴로 보여줘야 고르기 쉽다
Array.prototype.forEach.call(document.getElementById('fontOpts').children, function(b, i){
  b.style.fontFamily = FONTS[i].f;
});

var accHost = document.getElementById('acc');
ACCENTS.forEach(function(a, i){
  var b = document.createElement('button');
  b.type='button'; b.className = 'sw' + (S.accent === i ? ' on' : '');
  b.style.background = a.c; b.title = a.name;
  b.addEventListener('click', function(){
    S.accent = i;
    Array.prototype.forEach.call(accHost.children, function(c){ c.classList.remove('on'); });
    b.classList.add('on');
    saveKeep(); schedule();
  });
  accHost.appendChild(b);
});

bindText('category','category',true);
bindText('subtitle','subtitle',true);
bindText('tag','tag',true);
bindText('author','author',true);
bindText('title1','title1');
bindText('title2','title2');
bindText('subhead','subhead');

bindRange('focus','focus','vFocus');
bindRange('dim','dim','vDim');
bindRange('ts','ts','vTs');
bindRange('ss','ss','vSs');
bindRange('ty','ty','vTy');

document.getElementById('file').addEventListener('change', function(e){
  loadFile(e.target.files && e.target.files[0]);
});
document.getElementById('btnSave').addEventListener('click', save);
document.getElementById('btnLong').addEventListener('click', showLongPress);
document.getElementById('ovClose').addEventListener('click', function(){
  document.getElementById('saveOverlay').style.display = 'none';
  document.getElementById('ovImg').src = '';
});

/* ---------- 초기 실행 ---------- */
// 원본에는 블로그방 공유용 비밀번호 게이트가 있었지만,
// 이 디벨롭 버전은 그 잠금을 제거하고 바로 사용 가능하게 열어둔다.
syncPhotoCard();
render();
})();
