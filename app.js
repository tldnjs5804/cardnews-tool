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

/* ---------- 상태 ----------
   STYLE  : 모든 슬라이드에 공통 적용되는 스타일 (템플릿/비율/색/글씨체/크기)
   COMMON : 모든 슬라이드에 공통 적용되는 텍스트 (카테고리/부제/태그/작성자)
   slides : 슬라이드별 데이터 (제목/소제목/사진/사진 위치/밝기)
   S      : 렌더링 시점에 STYLE+COMMON+해당 슬라이드를 합쳐 넣는 작업용 객체
*/
var STYLE = {
  tpl:'classic', ratio:'feed', accent:0, accentCustom:null, font:0,
  ts:76, ss:32, ty:0, format:'png',
  logo:null, logoPos:'br', logoScale:18, logoOpacity:85
};
var COMMON = { category:'', subtitle:'', tag:'', author:'' };
var S = {};

function newSlide(){
  return {
    id: 'sl_' + Math.random().toString(36).slice(2,9) + Date.now().toString(36),
    title1:'', title2:'', subhead:'',
    photo:null, focusX:50, focusY:50, dim:100
  };
}
var slides = [newSlide()];
var activeIdx = 0;

function curAccent(){
  if(S.accent === -1 && S.accentCustom) return S.accentCustom;
  return ACCENTS[S.accent] || ACCENTS[0];
}
function curRatio(){
  return RATIOS.filter(function(x){ return x.id === STYLE.ratio; })[0] || RATIOS[0];
}

/* ---------- 이미지 ---------- */
// 슬라이드 id → 디코딩된 캔버스. 사진은 최대 1600px로 축소해서 들고 있는다
var photoCanvasCache = {};

// file:// 로 열었을 때 blob URL은 캔버스를 오염시켜 저장이 막힘 → data URL로 읽는다.
// 저장용 dataURL도 같은 축소본을 재사용해서 IndexedDB 용량을 아낀다.
function loadPhotoFile(f, slide){
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
      var dataUrl = c.toDataURL('image/jpeg', 0.9);
      slide.photo = dataUrl;
      photoCanvasCache[slide.id] = {src:dataUrl, canvas:c};
      if(slide === slides[activeIdx]){
        document.getElementById('fileLabel').firstChild.nodeValue = '사진 변경하기';
      }
      scheduleAll();
      persistSoon();
    };
    im.onerror = function(){ alert('이미지를 불러오지 못했습니다.'); };
    im.src = fr.result;
  };
  fr.onerror = function(){ alert('사진을 읽지 못했습니다.'); };
  fr.readAsDataURL(f);
}
// 저장된 draft를 복원할 때, 이미 축소되어 있는 dataURL을 다시 캔버스로 디코딩만 한다
function decodePhotoToCache(slide){
  return new Promise(function(res){
    if(!slide.photo){ res(); return; }
    var im = new Image();
    im.onload = function(){
      var c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      c.getContext('2d').drawImage(im, 0, 0);
      photoCanvasCache[slide.id] = {src:slide.photo, canvas:c};
      res();
    };
    im.onerror = function(){ res(); };
    im.src = slide.photo;
  });
}

/* ---------- 로고 / 워터마크 (모든 슬라이드 공통) ---------- */
var logoCanvas = null;
function loadLogoFile(f){
  if(!f) return;
  var fr = new FileReader();
  fr.onload = function(){
    var im = new Image();
    im.onload = function(){
      var MAX = 500; // 로고는 작게만 그려지므로 원본을 그대로 들고 있을 필요가 없다
      var r = Math.min(1, MAX/Math.max(im.width, im.height));
      var w = Math.max(1, Math.round(im.width*r)), h = Math.max(1, Math.round(im.height*r));
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var g = c.getContext('2d');
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(im, 0, 0, w, h);
      STYLE.logo = c.toDataURL('image/png'); // 투명 배경을 유지해야 하므로 PNG로 저장
      logoCanvas = c;
      syncLogoUI();
      scheduleAll();
      persistSoon();
    };
    im.onerror = function(){ alert('로고 이미지를 불러오지 못했습니다.'); };
    im.src = fr.result;
  };
  fr.onerror = function(){ alert('로고 파일을 읽지 못했습니다.'); };
  fr.readAsDataURL(f);
}
function decodeLogoToCache(){
  return new Promise(function(res){
    if(!STYLE.logo){ res(); return; }
    var im = new Image();
    im.onload = function(){
      var c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      c.getContext('2d').drawImage(im, 0, 0);
      logoCanvas = c;
      res();
    };
    im.onerror = function(){ res(); };
    im.src = STYLE.logo;
  });
}
function removeLogo(){
  STYLE.logo = null; logoCanvas = null;
  syncLogoUI();
  scheduleAll();
  persistSoon();
}
// 어떤 템플릿이든 상관없이 다 그린 뒤 맨 위에 얹는다 — 배경마다 대비 로직을 따로 짤 필요가 없다
function drawLogoWatermark(g, W, H, k){
  if(!logoCanvas) return;
  var targetW = W * (STYLE.logoScale/100);
  var scale = targetW / logoCanvas.width;
  var dw = logoCanvas.width * scale, dh = logoCanvas.height * scale;
  var margin = 56*k, x, y;
  switch(STYLE.logoPos){
    case 'tl': x = margin; y = margin; break;
    case 'tr': x = W - margin - dw; y = margin; break;
    case 'bl': x = margin; y = H - margin - dh; break;
    default:   x = W - margin - dw; y = H - margin - dh; break; // 'br'
  }
  g.save();
  g.globalAlpha = STYLE.logoOpacity/100;
  g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 10*k; g.shadowOffsetY = 1*k;
  g.drawImage(logoCanvas, x, y, dw, dh);
  g.restore();
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
  // 실제로 잘려나가는 축(가로 또는 세로)에만 포커스 슬라이더가 의미를 갖는다
  var dx = (dw > W) ? (W - dw) * (S.focusX/100) : (W - dw)/2;
  var dy = (dh > H) ? (H - dh) * (S.focusY/100) : (H - dh)/2;
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
    var acc = curAccent();
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

  var acc = curAccent();
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

  var acc = curAccent();
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
  var acc = curAccent();
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
  var acc = curAccent();
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

  var acc = curAccent();
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

  var acc = curAccent();
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
  g.fillText('“', W/2, top - 40*k);
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
  var acc = curAccent();
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
  var acc = curAccent();
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
  var acc = curAccent();
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

/* ---------- 렌더 ----------
   메인 캔버스뿐 아니라 슬라이드 스트립 썸네일, 일괄 저장용 오프스크린 캔버스도
   전부 이 renderInto() 하나로 그린다. */
var srcCanvas = null; // 현재 그리는 슬라이드의 디코딩된 사진 캔버스
function applySlideToS(slide){
  S.tpl = STYLE.tpl; S.ratio = STYLE.ratio; S.accent = STYLE.accent; S.accentCustom = STYLE.accentCustom;
  S.font = STYLE.font; S.ts = STYLE.ts; S.ss = STYLE.ss; S.ty = STYLE.ty;
  S.category = COMMON.category; S.subtitle = COMMON.subtitle; S.tag = COMMON.tag; S.author = COMMON.author;
  S.title1 = slide.title1; S.title2 = slide.title2; S.subhead = slide.subhead;
  S.dim = slide.dim; S.focusX = slide.focusX; S.focusY = slide.focusY;
  srcCanvas = (photoCanvasCache[slide.id] && photoCanvasCache[slide.id].canvas) || null;
}
function renderInto(g, cvEl, slide, W, H){
  if(cvEl.width !== W || cvEl.height !== H){ cvEl.width = W; cvEl.height = H; }
  var k = W/1080;
  g.setTransform(1,0,0,1,0,0);
  g.clearRect(0,0,W,H);
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.globalAlpha = 1;
  TEXT_SHADOW = true; // 사진 템플릿 기본값. 텍스트 템플릿이 각자 끈다
  applySlideToS(slide);
  (DRAW[S.tpl] || tplClassic)(g, W, H, k);
  drawLogoWatermark(g, W, H, k);
}

var rafId = 0;
function schedule(){
  if(rafId) return;
  rafId = requestAnimationFrame(function(){ rafId = 0; render(); });
}
function render(){
  var r = curRatio();
  renderInto(ctx, cv, slides[activeIdx], r.w, r.h);
  refreshActiveThumb();
}

/* ---------- 슬라이드 스트립 (썸네일) ---------- */
var THUMB_W = 220;
function renderThumb(slide){
  if(!slide._thumbCanvas) return;
  var r = curRatio();
  var w = THUMB_W, h = Math.round(THUMB_W * r.h / r.w);
  var g = slide._thumbCanvas.getContext('2d');
  renderInto(g, slide._thumbCanvas, slide, w, h);
}
function refreshActiveThumb(){
  renderThumb(slides[activeIdx]);
}
var thumbTimer = 0;
function scheduleAllThumbs(){
  clearTimeout(thumbTimer);
  thumbTimer = setTimeout(function(){ slides.forEach(renderThumb); }, 300);
}
function scheduleAll(){ schedule(); scheduleAllThumbs(); }

function buildStrip(){
  var host = document.getElementById('strip');
  host.innerHTML = '';
  slides.forEach(function(slide, i){
    var d = document.createElement('div');
    d.className = 'thumb' + (i === activeIdx ? ' on' : '');
    var cvv = document.createElement('canvas');
    d.appendChild(cvv);
    var n = document.createElement('div'); n.className = 'n'; n.textContent = i + 1;
    d.appendChild(n);
    d.addEventListener('click', function(){ setActive(i); });
    host.appendChild(d);
    slide._thumbCanvas = cvv;
    renderThumb(slide);
  });
  var add = document.createElement('div');
  add.className = 'thumbAdd'; add.textContent = '+'; add.title = '슬라이드 추가';
  add.addEventListener('click', addSlide);
  host.appendChild(add);
  document.getElementById('slideCount').textContent = slides.length;
}

/* ---------- 슬라이드 관리 ---------- */
function setActive(i){
  activeIdx = Math.max(0, Math.min(slides.length - 1, i));
  syncActiveFieldsToUI();
  buildStrip();
  schedule();
}
function addSlide(){
  slides.push(newSlide());
  activeIdx = slides.length - 1;
  syncActiveFieldsToUI();
  buildStrip();
  schedule();
  persistSoon();
}
function duplicateActive(){
  var s = slides[activeIdx];
  var copy = {
    id: 'sl_' + Math.random().toString(36).slice(2,9) + Date.now().toString(36),
    title1:s.title1, title2:s.title2, subhead:s.subhead,
    photo:s.photo, focusX:s.focusX, focusY:s.focusY, dim:s.dim
  };
  if(s.photo && photoCanvasCache[s.id]) photoCanvasCache[copy.id] = photoCanvasCache[s.id];
  slides.splice(activeIdx + 1, 0, copy);
  activeIdx += 1;
  syncActiveFieldsToUI();
  buildStrip();
  schedule();
  persistSoon();
}
function deleteActive(){
  if(slides.length <= 1){ alert('마지막 슬라이드는 삭제할 수 없습니다.'); return; }
  slides.splice(activeIdx, 1);
  activeIdx = Math.min(activeIdx, slides.length - 1);
  syncActiveFieldsToUI();
  buildStrip();
  schedule();
  persistSoon();
}
function moveActive(dir){
  var j = activeIdx + dir;
  if(j < 0 || j >= slides.length) return;
  var tmp = slides[activeIdx]; slides[activeIdx] = slides[j]; slides[j] = tmp;
  activeIdx = j;
  buildStrip();
  schedule();
  persistSoon();
}

/* ---------- 예시로 시작: 완성된 스타일+문구 프리셋 ---------- */
// 사진 없이도(placeholder 배경) 바로 완성도 있게 보이도록 사진 템플릿과 텍스트 전용 템플릿을 섞어뒀다
var PRESETS = [
  {id:'cafe', label:'카페 무드', tpl:'classic', accent:6, font:0,
    common:{category:'Coffee', subtitle:'월간커피', tag:'Article', author:'편집팀'},
    slides:[
      {title1:'오늘의 원두는', title2:'[에티오피아] 예가체프', subhead:'산미와 플로럴 향이 매력적인\n싱글오리진 원두를 소개합니다'},
      {title1:'브루잉 가이드', title2:'[물 온도] 92도가 포인트', subhead:'쓴맛은 줄이고 단맛은 살리는\n핸드드립 온도 공식'}
    ]},
  {id:'stat', label:'인사이트 통계', tpl:'stat', accent:9, font:0,
    common:{category:'Report', subtitle:'2026 Q3', tag:'Data', author:''},
    slides:[
      {title1:'73%', title2:'재구매 의사 있음', subhead:'이번 분기 고객 만족도 조사 결과'},
      {title1:'4.6', title2:'평균 별점 (5점 만점)', subhead:'응답자 1,204명 기준'}
    ]},
  {id:'quote', label:'감성 인용구', tpl:'quote', accent:4, font:1,
    common:{category:'', subtitle:'', tag:'Quote', author:''},
    slides:[
      {title1:'오늘도', title2:'[충분히] 잘 해내고 있어요', subhead:'지친 하루의 끝에 건네는\n작은 위로'},
      {title1:'완벽하지 않아도', title2:'[괜찮아요]', subhead:'모두가 각자의 속도로 걷고 있으니까'}
    ]},
  {id:'brand', label:'브랜드 소개', tpl:'solid', accent:3, font:0,
    common:{category:'Brand', subtitle:'2026', tag:'', author:''},
    slides:[
      {title1:'새로운 시작', title2:'[지속가능한] 라이프스타일', subhead:'우리가 만드는 변화, 함께해요'},
      {title1:'우리의 약속', title2:'[100%] 재생 소재 사용', subhead:'포장부터 배송까지, 환경을 생각합니다'}
    ]},
  {id:'magazine', label:'매거진 커버', tpl:'magazine', accent:1, font:0,
    common:{category:'Feature', subtitle:'', tag:'Cover', author:''},
    slides:[
      {title1:'이번 호 특집', title2:'[디지털 노마드]로 살기', subhead:'어디서나 일할 수 있는 시대,\n진짜 자유란 무엇일까'},
      {title1:'오늘의 인터뷰', title2:'[퇴사 후] 1년, 그들의 이야기', subhead:'안정보다 자유를 택한 사람들'}
    ]},
  {id:'gradient', label:'그라디언트 카드', tpl:'gradient', accent:10, font:0,
    common:{category:'', subtitle:'', tag:'', author:''},
    slides:[
      {title1:'생각을 바꾸면', title2:'[삶이] 달라집니다', subhead:'작은 습관 하나가 만드는 큰 변화'},
      {title1:'매일 5분', title2:'[명상이] 주는 변화', subhead:'바쁜 일상 속 나를 위한 시간'}
    ]}
];
function hasAnyContent(){
  return slides.some(function(s){ return s.title1 || s.title2 || s.subhead || s.photo; }) ||
         !!(COMMON.category || COMMON.subtitle || COMMON.tag || COMMON.author);
}
function applyPreset(p){
  if(hasAnyContent() && !confirm('예시 "' + p.label + '"로 지금 내용을 바꿀까요? (사진은 유지되지 않아요)')) return;
  STYLE.tpl = p.tpl; STYLE.accent = p.accent; STYLE.accentCustom = null; STYLE.font = p.font;
  Object.assign(COMMON, p.common);
  slides = p.slides.map(function(s){ return Object.assign(newSlide(), s); });
  activeIdx = 0;
  buildTplOpts(); buildFontOpts(); refreshAccentUI();
  ['category','subtitle','tag','author'].forEach(function(k){ document.getElementById(k).value = COMMON[k]; });
  syncActiveFieldsToUI();
  buildStrip();
  schedule();
  persistSoon();
}

/* ---------- 빠른 생성: 텍스트 붙여넣기 → 여러 슬라이드 ---------- */
// 형식: 슬라이드는 --- 로 구분. 블록의 첫 줄은 제목1행, ">"로 시작하는 줄은 제목2행,
// 그 다음 최대 두 줄은 소제목으로 들어간다.
function parseBulk(text){
  var blocks = String(text).split(/\n[ \t]*-{3,}[ \t]*\n/);
  var out = [];
  blocks.forEach(function(block){
    var ls = block.split('\n').map(function(x){ return x.replace(/\r$/, ''); })
                  .filter(function(x){ return x.trim() !== ''; });
    if(!ls.length) return;
    var sl = newSlide();
    sl.title1 = ls[0].trim();
    var idx = 1;
    if(ls[idx] && /^>\s*/.test(ls[idx])){
      sl.title2 = ls[idx].replace(/^>\s*/, '').trim();
      idx++;
    }
    sl.subhead = ls.slice(idx, idx + 2).join('\n');
    out.push(sl);
  });
  return out;
}

/* ---------- 저장 (현재 슬라이드 1장) ---------- */
function fileBaseName(slide){
  var t = (slide.title1 + ' ' + slide.title2).replace(/[\[\]]/g,'').replace(/[\\/:*?"<>|]/g,'').trim();
  return t ? t.slice(0,30) : 'cardnews';
}
function curExt(){ return STYLE.format === 'jpeg' ? 'jpg' : 'png'; }
function curMime(){ return STYLE.format === 'jpeg' ? 'image/jpeg' : 'image/png'; }
function fileName(){ return fileBaseName(slides[activeIdx]) + '.' + curExt(); }
function toBlob(){
  return new Promise(function(res){
    if(cv.toBlob) cv.toBlob(function(b){ res(b); }, curMime(), 0.92);
    else res(null);
  });
}
function isIOS(){
  return /iP(hone|ad|od)/.test(navigator.platform || '') ||
         /iPhone|iPad|iPod/.test(navigator.userAgent) ||
         (/Mac/.test(navigator.userAgent) && navigator.maxTouchPoints > 1); // iPadOS
}
function isMobileTouch(){
  return (navigator.maxTouchPoints > 1) &&
         (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
}
function showLongPress(){
  try{
    document.getElementById('ovImg').src = cv.toDataURL(curMime(), 0.92);
    document.getElementById('saveOverlay').style.display = 'flex';
  }catch(e){ alert('이미지 생성에 실패했습니다.'); }
}
async function save(){
  var name = fileName();
  var blob = await toBlob();

  // 1) Web Share API — 모바일에서만. (데스크톱 크롬/윈도우는 OS 공유창이 떠서 오히려 불편)
  if(isMobileTouch() && blob && navigator.canShare && window.File){
    try{
      var f = new File([blob], name, {type: curMime()});
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

/* ---------- 저장 (전체 슬라이드 일괄) ---------- */
/* 압축 없는(STORE) 최소 ZIP writer. PNG/JPEG는 이미 압축되어 있어 재압축 이득이 없고,
   외부 라이브러리를 쓰지 않기 위해 CRC32+ZIP 헤더를 직접 만든다. */
var CRC_TABLE = (function(){
  var t = [];
  for(var n=0;n<256;n++){
    var c = n;
    for(var k=0;k<8;k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes){
  var c = 0xFFFFFFFF;
  for(var i=0;i<bytes.length;i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function dosDateTime(){
  var d = new Date();
  var dosTime = ((d.getHours()&31)<<11) | ((d.getMinutes()&63)<<5) | (Math.floor(d.getSeconds()/2)&31);
  var dosDate = (((d.getFullYear()-1980)&127)<<9) | (((d.getMonth()+1)&15)<<5) | (d.getDate()&31);
  return {time:dosTime, date:dosDate};
}
function u16(v){ return [v & 0xFF, (v >> 8) & 0xFF]; }
function u32(v){ return [v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >> 24) & 0xFF]; }
// 한글 파일명이 CP437로 깨지지 않도록 UTF-8로 인코딩하고, 각 헤더의 general purpose
// flag에 UTF-8 플래그(bit 11 = 0x0800)를 켜서 압축 해제 프로그램에 알려준다
function strBytes(s){ return Array.prototype.slice.call(new TextEncoder().encode(s)); }
var UTF8_FLAG = 0x0800;
function makeZip(files){ // files: [{name, data:Uint8Array}]
  var chunks = [], centralChunks = [], offset = 0;
  var dt = dosDateTime();
  files.forEach(function(f){
    var nameBytes = strBytes(f.name);
    var data = f.data;
    var crc = crc32(data);
    var local = new Uint8Array([].concat(
      u32(0x04034b50), u16(20), u16(UTF8_FLAG), u16(0), u16(dt.time), u16(dt.date),
      u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), nameBytes
    ));
    chunks.push(local, data);
    var central = new Uint8Array([].concat(
      u32(0x02014b50), u16(20), u16(20), u16(UTF8_FLAG), u16(0), u16(dt.time), u16(dt.date),
      u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0),
      u32(offset), nameBytes
    ));
    centralChunks.push(central);
    offset += local.length + data.length;
  });
  var centralStart = offset, centralSize = 0;
  centralChunks.forEach(function(c){ centralSize += c.length; });
  var end = new Uint8Array([].concat(
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(centralSize), u32(centralStart), u16(0)
  ));
  return new Blob(chunks.concat(centralChunks, [end]), {type:'application/zip'});
}
function slidePngBytes(slide, W, H){
  return new Promise(function(res){
    var c = document.createElement('canvas');
    var g = c.getContext('2d');
    renderInto(g, c, slide, W, H);
    c.toBlob(function(b){
      if(!b){ res(null); return; }
      b.arrayBuffer().then(function(buf){ res(new Uint8Array(buf)); });
    }, curMime(), 0.92);
  });
}
async function collectAllFiles(){
  var r = curRatio(), ext = curExt();
  var out = [];
  for(var i=0;i<slides.length;i++){
    var bytes = await slidePngBytes(slides[i], r.w, r.h);
    if(bytes) out.push({name: String(i+1).padStart(2,'0') + '_' + fileBaseName(slides[i]) + '.' + ext, data:bytes});
  }
  return out;
}
async function saveAll(){
  if(slides.length === 1) return save();
  var files = await collectAllFiles();
  if(!files.length){ alert('저장할 슬라이드가 없습니다.'); return; }

  if(isMobileTouch() && navigator.canShare && window.File){
    try{
      var fileObjs = files.map(function(f){ return new File([f.data], f.name, {type: curMime()}); });
      if(navigator.canShare({files: fileObjs})){
        await navigator.share({files: fileObjs});
        return;
      }
    }catch(e){
      if(e && e.name === 'AbortError') return;
    }
  }
  if(!isIOS()){
    try{
      var blob = makeZip(files);
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'cardnews.zip';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
      return;
    }catch(e){}
  }
  alert('이 브라우저에서는 한 번에 전체 저장이 어려워요. 슬라이드를 하나씩 선택한 뒤 "현재 슬라이드 저장"을 눌러주세요.');
}

/* ---------- IndexedDB 임시저장 ---------- */
// localStorage는 사진 dataURL을 담기엔 용량(5~10MB)이 부족해 IndexedDB를 쓴다.
var DB_NAME = 'cardnews-db', DB_VER = 1, STORE_NAME = 'draft', DRAFT_KEY = 'current';
function idbOpen(){
  return new Promise(function(res, rej){
    if(!('indexedDB' in window)){ rej(new Error('no indexedDB')); return; }
    var req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = function(){ req.result.createObjectStore(STORE_NAME); };
    req.onsuccess = function(){ res(req.result); };
    req.onerror = function(){ rej(req.error); };
  });
}
function idbSet(key, val){
  return idbOpen().then(function(db){
    return new Promise(function(res, rej){
      var tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(val, key);
      tx.oncomplete = function(){ res(); };
      tx.onerror = function(){ rej(tx.error); };
    });
  });
}
function idbGet(key){
  return idbOpen().then(function(db){
    return new Promise(function(res, rej){
      var tx = db.transaction(STORE_NAME, 'readonly');
      var rq = tx.objectStore(STORE_NAME).get(key);
      rq.onsuccess = function(){ res(rq.result); };
      rq.onerror = function(){ rej(rq.error); };
    });
  });
}
var persistTimer = 0;
function persistSoon(){
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persistNow, 500);
}
function persistNow(){
  var snapshot = {
    common: COMMON,
    style: {tpl:STYLE.tpl, ratio:STYLE.ratio, accent:STYLE.accent, accentCustom:STYLE.accentCustom,
      font:STYLE.font, ts:STYLE.ts, ss:STYLE.ss, ty:STYLE.ty, format:STYLE.format,
      logo:STYLE.logo, logoPos:STYLE.logoPos, logoScale:STYLE.logoScale, logoOpacity:STYLE.logoOpacity},
    activeIdx: activeIdx,
    slides: slides.map(function(s){
      return {id:s.id, title1:s.title1, title2:s.title2, subhead:s.subhead, photo:s.photo,
        focusX:s.focusX, focusY:s.focusY, dim:s.dim};
    })
  };
  idbSet(DRAFT_KEY, snapshot).catch(function(){});
}
function restoreDraft(){
  return idbGet(DRAFT_KEY).then(function(saved){
    if(!saved) return;
    if(saved.common) Object.assign(COMMON, saved.common);
    if(saved.style) Object.assign(STYLE, saved.style);
    if(saved.slides && saved.slides.length){
      slides = saved.slides.map(function(s){ return Object.assign(newSlide(), s); });
      activeIdx = Math.max(0, Math.min(slides.length - 1, saved.activeIdx || 0));
    }
    return Promise.all(slides.map(decodePhotoToCache).concat([decodeLogoToCache()]));
  });
}

/* ---------- UI 바인딩 ---------- */
function setRangeUI(id, valId, val){
  document.getElementById(id).value = val;
  document.getElementById(valId).textContent = val;
}
function syncPhotoCard(){
  var textOnly = isTextTpl(STYLE.tpl);
  document.getElementById('photoCard').style.display = textOnly ? 'none' : '';
  document.getElementById('titleHint').textContent = (STYLE.tpl === 'stat')
    ? '숫자가 들어갑니다 (예: 92%)'
    : '';
}
function syncActiveFieldsToUI(){
  var s = slides[activeIdx];
  document.getElementById('title1').value = s.title1;
  document.getElementById('title2').value = s.title2;
  document.getElementById('subhead').value = s.subhead;
  setRangeUI('focusX', 'vFocusX', s.focusX);
  setRangeUI('focusY', 'vFocusY', s.focusY);
  setRangeUI('dim', 'vDim', s.dim);
  document.getElementById('fileLabel').firstChild.nodeValue = s.photo ? '사진 변경하기' : '사진 선택하기';
  syncPhotoCard();
}
function bindCommonText(id, key){
  var el = document.getElementById(id);
  el.value = COMMON[key];
  el.addEventListener('input', function(){
    COMMON[key] = el.value;
    scheduleAll();
    persistSoon();
  });
}
function bindSlideText(id, key){
  var el = document.getElementById(id);
  el.addEventListener('input', function(){
    slides[activeIdx][key] = el.value;
    schedule();
    persistSoon();
  });
}
function bindSlideRange(id, key, valId){
  var el = document.getElementById(id), out = document.getElementById(valId);
  el.addEventListener('input', function(){
    slides[activeIdx][key] = +el.value; out.textContent = el.value;
    schedule();
    persistSoon();
  });
}
function bindStyleRange(id, key, valId){
  var el = document.getElementById(id), out = document.getElementById(valId);
  el.value = STYLE[key]; out.textContent = STYLE[key];
  el.addEventListener('input', function(){
    STYLE[key] = +el.value; out.textContent = el.value;
    scheduleAll();
    persistSoon();
  });
}
function buildOpts(hostId, items, styleKey, onPick){
  var host = document.getElementById(hostId);
  host.innerHTML = '';
  items.forEach(function(it){
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'opt' + (STYLE[styleKey] === it.id ? ' on' : '');
    b.textContent = it.name;
    b.addEventListener('click', function(){
      STYLE[styleKey] = it.id;
      Array.prototype.forEach.call(host.children, function(c){ c.classList.remove('on'); });
      b.classList.add('on');
      if(onPick) onPick();
      scheduleAll();
      persistSoon();
    });
    host.appendChild(b);
  });
}
var accHost, accCustomInput, accSwatchEls = [];
function refreshAccentUI(){
  accSwatchEls.forEach(function(c){ c.classList.remove('on'); });
  if(STYLE.accent >= 0 && accSwatchEls[STYLE.accent]) accSwatchEls[STYLE.accent].classList.add('on');
}
function buildAccentSwatches(){
  accHost = document.getElementById('acc');
  accCustomInput = document.getElementById('accCustom');
  accSwatchEls = [];
  ACCENTS.forEach(function(a, i){
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'sw';
    b.style.background = a.c; b.title = a.name;
    b.setAttribute('aria-label', '강조색: ' + a.name);
    b.addEventListener('click', function(){
      STYLE.accent = i; STYLE.accentCustom = null;
      refreshAccentUI();
      scheduleAll(); persistSoon();
    });
    accHost.insertBefore(b, accCustomInput);
    accSwatchEls[i] = b;
  });
  if(STYLE.accentCustom) accCustomInput.value = STYLE.accentCustom.c;
  accCustomInput.addEventListener('input', function(){
    var c = accCustomInput.value;
    STYLE.accentCustom = {name:'커스텀', c:c, on:(isLight(c) ? '#141414' : '#ffffff')};
    STYLE.accent = -1;
    refreshAccentUI();
    scheduleAll(); persistSoon();
  });
  refreshAccentUI();
}
// 프리셋 적용 후에도 버튼의 'on' 표시를 다시 맞춰야 하므로 이름 있는 함수로 분리해둔다
function buildTplOpts(){ buildOpts('tpl', TEMPLATES, 'tpl', function(){ syncPhotoCard(); }); }
function buildRatioOpts(){ buildOpts('ratio', RATIOS.map(function(r){ return {id:r.id, name:r.name}; }), 'ratio'); }
function buildFontOpts(){
  buildOpts('fontOpts', FONTS.map(function(f, i){ return {id:i, name:f.name}; }), 'font');
  // 버튼 글씨도 실제 글꼴로 보여줘야 고르기 쉽다
  Array.prototype.forEach.call(document.getElementById('fontOpts').children, function(b, i){
    b.style.fontFamily = FONTS[i].f;
  });
}
function buildFmtOpts(){ buildOpts('fmt', [{id:'png', name:'PNG'}, {id:'jpeg', name:'JPEG'}], 'format'); }
function buildLogoPosOpts(){
  buildOpts('logoPos', [
    {id:'tl', name:'좌상단'}, {id:'tr', name:'우상단'},
    {id:'bl', name:'좌하단'}, {id:'br', name:'우하단'}
  ], 'logoPos');
}
function buildPresetChips(){
  var host = document.getElementById('presets');
  host.innerHTML = '';
  PRESETS.forEach(function(p){
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'opt';
    b.textContent = p.label;
    b.addEventListener('click', function(){ applyPreset(p); });
    host.appendChild(b);
  });
}
function syncLogoUI(){
  var label = document.getElementById('logoFileLabel');
  if(label.firstChild) label.firstChild.nodeValue = STYLE.logo ? '로고 변경하기' : '로고 이미지 선택하기';
}

function initUI(){
  buildTplOpts();
  buildRatioOpts();
  buildFontOpts();
  buildAccentSwatches();
  buildFmtOpts();
  buildLogoPosOpts();
  buildPresetChips();

  bindCommonText('category', 'category');
  bindCommonText('subtitle', 'subtitle');
  bindCommonText('tag', 'tag');
  bindCommonText('author', 'author');

  bindSlideText('title1', 'title1');
  bindSlideText('title2', 'title2');
  bindSlideText('subhead', 'subhead');
  bindSlideRange('focusX', 'focusX', 'vFocusX');
  bindSlideRange('focusY', 'focusY', 'vFocusY');
  bindSlideRange('dim', 'dim', 'vDim');

  bindStyleRange('ts', 'ts', 'vTs');
  bindStyleRange('ss', 'ss', 'vSs');
  bindStyleRange('ty', 'ty', 'vTy');
  bindStyleRange('logoScale', 'logoScale', 'vLogoScale');
  bindStyleRange('logoOpacity', 'logoOpacity', 'vLogoOpacity');

  document.getElementById('file').addEventListener('change', function(e){
    var f = e.target.files && e.target.files[0];
    if(f) loadPhotoFile(f, slides[activeIdx]);
  });
  document.getElementById('logoFile').addEventListener('change', function(e){
    var f = e.target.files && e.target.files[0];
    if(f) loadLogoFile(f);
  });
  document.getElementById('btnLogoRemove').addEventListener('click', removeLogo);
  document.getElementById('btnSave').addEventListener('click', save);
  document.getElementById('btnSaveAll').addEventListener('click', saveAll);
  document.getElementById('btnLong').addEventListener('click', showLongPress);
  document.getElementById('ovClose').addEventListener('click', function(){
    document.getElementById('saveOverlay').style.display = 'none';
    document.getElementById('ovImg').src = '';
  });
  document.getElementById('btnDup').addEventListener('click', duplicateActive);
  document.getElementById('btnLeft').addEventListener('click', function(){ moveActive(-1); });
  document.getElementById('btnRight').addEventListener('click', function(){ moveActive(1); });
  document.getElementById('btnDel').addEventListener('click', deleteActive);
  document.getElementById('btnBulk').addEventListener('click', function(){
    var text = document.getElementById('bulk').value;
    var parsed = parseBulk(text);
    if(!parsed.length){ alert('생성할 텍스트를 입력해주세요.'); return; }
    var hasContent = slides.some(function(s){ return s.title1 || s.title2 || s.subhead || s.photo; });
    if(hasContent && !confirm(parsed.length + '장의 슬라이드로 기존 슬라이드를 교체할까요?')) return;
    slides = parsed;
    activeIdx = 0;
    syncActiveFieldsToUI();
    buildStrip();
    schedule();
    persistSoon();
  });
  document.getElementById('btnAutoAccent').addEventListener('click', function(){
    var slide = slides[activeIdx];
    var cache = photoCanvasCache[slide.id];
    if(!cache){ alert('먼저 사진을 선택해주세요.'); return; }
    try{
      var tmp = document.createElement('canvas'); tmp.width = 32; tmp.height = 32;
      var tg = tmp.getContext('2d');
      tg.drawImage(cache.canvas, 0, 0, 32, 32);
      var data = tg.getImageData(0, 0, 32, 32).data;
      var r=0,g=0,b=0,n=0;
      for(var i=0;i<data.length;i+=4){ r+=data[i]; g+=data[i+1]; b+=data[i+2]; n++; }
      r = Math.round(r/n); g = Math.round(g/n); b = Math.round(b/n);
      var hex = '#' + [r,g,b].map(function(v){ return v.toString(16).padStart(2,'0'); }).join('');
      STYLE.accentCustom = {name:'사진색', c:hex, on:(isLight(hex) ? '#141414' : '#ffffff')};
      STYLE.accent = -1;
      accCustomInput.value = hex;
      refreshAccentUI();
      scheduleAll(); persistSoon();
    }catch(e){ alert('색상을 추출하지 못했습니다. (외부 이미지 URL 등 보안 제한일 수 있어요)'); }
  });

  syncActiveFieldsToUI();
  buildStrip();
  syncPhotoCard();
  syncLogoUI();
  render();
}

/* ---------- 초기 실행 ----------
   원본에는 블로그방 공유용 비밀번호 게이트가 있었지만,
   이 디벨롭 버전은 그 잠금을 제거하고 바로 사용 가능하게 열어둔다. */
// 디바운스 중 탭을 닫거나 앱을 백그라운드로 보내면 마지막 편집(최대 500ms치)이 씹힐 수 있어
// 숨겨지는 시점에 곧바로 저장을 시작한다 (완료 보장은 못 하지만 지연을 없애준다)
function flushPersist(){ clearTimeout(persistTimer); persistNow(); }
document.addEventListener('visibilitychange', function(){
  if(document.visibilityState === 'hidden') flushPersist();
});
window.addEventListener('pagehide', flushPersist);

restoreDraft().catch(function(){}).then(initUI);
})();
