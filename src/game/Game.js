import Phaser from 'phaser';
import { WIDTH as W, HEIGHT as H, parallaxY } from './physics.js';
import { createChallenge, endRun, spawnAhead, stepChallenge, summary, stageFor, STAGES, STEP } from './challenge.js';
import { createPracticeAt } from './debug.js';
import { jumpFrame } from './animation.js';
const iconFrame = { coin: 0, time: 1, points: 2, skill: 3 };
function blendColor(from, to, amount) {
  const channel = shift => Math.round(((from >> shift) & 255) + (((to >> shift) & 255) - ((from >> shift) & 255)) * amount);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}
export function createGame(parent, notify, steering) {
  class Climb extends Phaser.Scene {
    preload() {
      for (const stage of STAGES) this.load.image(`stage-${stage.floor}`, `assets/stage-${stage.floor}-v2.png`);
      this.load.image('temple-pillar', 'assets/temple-pillar-v1.png');
      this.load.image('tower-modules', 'assets/tower-roofs-v5.png');
      this.load.image('rewards', 'assets/rewards-v1.png');
      this.load.image('platform-atlas', 'assets/platform-atlas-v2.png');
      this.load.spritesheet('swordsman-jump', 'assets/swordsman-jump.png', { frameWidth: 256, frameHeight: 256, startFrame: 0, endFrame: 32 });
    }
    create() {
      this.sky = this.add.rectangle(W / 2, H / 2, W, H, 0xc9deed).setDepth(-10);
      // Adapt Capple Hop's opaque periodic crossfade: constant brightness, no hard sky seam.
      this.backdrops = STAGES.map((stage,index) => {
        const overlap = 160, period = H, paintHeight = period + overlap, source = this.textures.get(`stage-${stage.floor}`).getSourceImage();
        const texture = this.textures.createCanvas(`loop-${stage.floor}`, W, period), ctx = texture.getContext();
        const row = (sy,dy) => ctx.drawImage(source,0,sy / paintHeight * source.height,source.width,source.height / paintHeight,0,dy,W,1);
        for (let y=0;y<period;y++) { ctx.globalAlpha=1; if(y<overlap) {row(period+y,y);const t=y/(overlap-1);ctx.globalAlpha=t*t*(3-2*t);} row(y,y); }
        ctx.globalAlpha=1;
        const softened=document.createElement('canvas');softened.width=W;softened.height=H;
        const soft=softened.getContext('2d');soft.filter='blur(1px)';
        for(const dy of [-H,0,H]) soft.drawImage(texture.getSourceImage(),-8,dy-1,W+16,H+2);
        ctx.clearRect(0,0,W,H);ctx.drawImage(softened,0,0);texture.refresh();
        return this.add.tileSprite(W/2,H/2,W,H,`loop-${stage.floor}`).setDepth(-9+index*.01).setAlpha(index===0 ? 1 : 0);
      });
      this.stageWeights = STAGES.map((_,i) => i===0 ? 1 : 0);
      this.midLayers = Array.from({ length: 4 }, (_, i) => this.add.image(i % 2 ? W - 38 : 38, 0, 'temple-pillar').setDisplaySize(165, 285).setAlpha(.48).setFlipX(i % 2 === 1).setDepth(-5));
      // Continuous posts join each repeat; projecting tiled eaves retain their silhouette.
      const towerImage=this.textures.get('tower-modules').getSourceImage();
      this.sideLayers=STAGES.map((stage,index)=>{
        const cellW=towerImage.width/3,cellH=towerImage.height/2,period=180,overlap=18;
        const tile=this.textures.createCanvas('side-'+stage.floor,68,period),ctx=tile.getContext();
        const row=(sy,dy)=>ctx.drawImage(towerImage,(index%3)*cellW,Math.floor(index/3)*cellH+sy/(period+overlap)*cellH,cellW,cellH/(period+overlap),0,dy,68,1);
        for(let y=0;y<period;y++){ctx.globalAlpha=1;if(y<overlap){row(period+y,y);const t=y/(overlap-1);ctx.globalAlpha=t*t*(3-2*t);}row(y,y);}
        ctx.globalAlpha=1;tile.refresh();
        return [0,1].map(side=>this.add.tileSprite(side?W:0,0,68,H,'side-'+stage.floor).setOrigin(side?1:0,0).setFlipX(!!side).setDepth(-3+index*.01));
      });
      const rewards = this.textures.get('rewards'), img = rewards.getSourceImage(), cw = Math.floor(img.width / 2), ch = Math.floor(img.height / 2);
      for (let i = 0; i < 4; i++) rewards.add(i, 0, (i % 2) * cw, Math.floor(i / 2) * ch, cw, ch);
      const decks = this.textures.get('platform-atlas'), deckImage = decks.getSourceImage(), dw = Math.floor(deckImage.width/2), dh = Math.floor(deckImage.height/2);
      for(let i=0;i<4;i++) decks.add(i,0,(i%2)*dw,Math.floor(i/2)*dh,dw,dh);
      // Pre-render the color treatment; Canvas fallback ignores sprite tint.
      for(const [key,color,shadow] of [['summit-platforms','#52778d',false],['platform-shadow','#101d37',true]]) {
        const texture=this.textures.createCanvas(key,deckImage.width,deckImage.height),ctx=texture.getContext();
        ctx.drawImage(deckImage,0,0);ctx.globalCompositeOperation=shadow?'source-in':'multiply';ctx.fillStyle=color;ctx.fillRect(0,0,deckImage.width,deckImage.height);
        if(!shadow){ctx.globalCompositeOperation='destination-in';ctx.drawImage(deckImage,0,0);}ctx.globalCompositeOperation='source-over';texture.refresh();
        for(let i=0;i<4;i++)texture.add(i,0,(i%2)*dw,Math.floor(i/2)*dh,dw,dh);
      }
      this.g = this.add.graphics().setDepth(2); this.ambient = this.add.graphics().setDepth(-7);
      // Bake colours into soft textures for both Canvas and WebGL rendering.
      for (const [key,core,edge] of [['cloud-poof','rgba(250,254,255,.95)','rgba(163,214,242,.35)'],['boost-poof','rgba(255,237,184,.95)','rgba(243,146,67,.4)']]) {
        const texture=this.textures.createCanvas(key,64,64),ctx=texture.getContext();
        const gradient=ctx.createRadialGradient(32,32,0,32,32,32);
        gradient.addColorStop(0,core);gradient.addColorStop(.35,core);gradient.addColorStop(.65,edge);gradient.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);texture.refresh();
      }
      this.pickupLabel = this.add.text(0, 0, '', { fontFamily: 'Georgia', fontSize: '20px', color: '#fff2ae', stroke: '#382615', strokeThickness: 4 }).setOrigin(.5).setDepth(6);
      this.qi=this.add.graphics().setDepth(4);
      this.hero = this.add.sprite(240, 636, 'swordsman-jump', 0).setOrigin(.5, .9).setDisplaySize(102, 102).setDepth(3);
      this.platformShadows = new Map(); this.platformSprites = new Map(); this.rewardSprites = new Map(); this.clock = 0; this.particles = []; this.theme = { ...stageFor(0) };
      this.preset = 'relaxed'; this.viewCamera = 0; this.inputs = []; this.lastInput = null; this.publishedAt = 0; this.uiStage = null; this.night = 0;
      this.keys = this.input.keyboard.addKeys('LEFT,RIGHT,A,D'); this.input.keyboard.addCapture(['LEFT', 'RIGHT', 'SPACE', 'UP', 'DOWN']);
      this.input.keyboard.on('keydown-SPACE', () => { if (this.run.phase !== 'playing') this.game.events.emit('request-start'); });
      this.command = (name, value) => {
        if(name==='typing') this.input.keyboard.enabled=!value;
        if (name === 'start') this.start(value);
        if (name === 'home') this.ready();
        if (name === 'debug-floor' && new URLSearchParams(location.search).get('debug') === '1') {
          this.start(null);this.run=createPracticeAt(value,this.preset);this.viewCamera=this.run.camera;this.publish();
        }
        
        if (name === 'preview-stage' && this.run.phase !== 'playing' && STAGES.some(stage => stage.floor === value)) { this.uiStage = value; this.publish(); }
        if (name === 'debug-end' && this.run.debug && this.run.phase==='playing') {
          endRun(this.run,'fall');this.publish();this.game.events.emit('run-ended',{session:null,result:summary(this.run)});
        }
        if(name==='debug-qi' && this.run.debug && this.run.phase==='playing') {this.run.charge=1;this.publish();}
        if(name==='debug-poof' && new URLSearchParams(location.search).get('debug')==='1' && ['cloud','fragile'].includes(value)) this.platformPoof({x:this.run.player.x,y:this.run.player.y+18,width:90,platformType:value});
        if (name === 'recenter') steering?.recenter();
      };
      this.game.events.on('command', this.command);
      this.blur = () => { this.input.keyboard.resetKeys(); this.input.manager.pointers.forEach(pointer => { pointer.isDown = false; }); };
      window.addEventListener('blur', this.blur);
      this.events.once('shutdown', () => { window.removeEventListener('blur', this.blur); this.game.events.off('command', this.command); });
      this.ready();
    }
    clearParticles() { for(const a of this.particles) a.sprite?.destroy(); this.particles=[]; }
    platformPoof(event) {
      const cloud=event.platformType==='cloud',width=event.width || 70;
      for(let i=0;i<16;i++) {
        const life=.65+Math.random()*.4,angle=Math.PI*2*i/16,speed=25+Math.random()*55;
        const sprite=this.add.image(event.x,event.y,cloud?'cloud-poof':'boost-poof').setDepth(2.4);
        this.particles.push({x:event.x+(Math.random()-.5)*width*.85,y:event.y+Math.random()*9,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed*.45-22,life,total:life,size:18+Math.random()*15,type:'poof',sprite});
      }
      if(!cloud) for(let i=0;i<9;i++) this.particles.push({x:event.x+(Math.random()-.5)*width*.7,y:event.y,vx:(Math.random()-.5)*130,vy:15+Math.random()*65,life:.5+Math.random()*.2,type:'debris'});
    }
    ready() { this.run = createChallenge(this.preset, 1234); spawnAhead(this.run); this.run.phase = 'ready'; this.uiStage = null; this.session = null; this.viewCamera = 0; this.clearParticles(); this.publish(); }
    start(session) {
      this.session = session || null; this.run = createChallenge(this.preset, session?.seed ?? crypto.getRandomValues(new Uint32Array(1))[0]);
      this.uiStage = null; this.inputs = []; this.lastInput = null; this.clearParticles(); this.startedAt = performance.now(); this.viewCamera = 0; this.publish();
    }
    publish() { notify({ ...summary(this.run), stage: this.uiStage ?? stageFor(this.run.floor).floor, practice: !this.session, debugPractice: !!this.run.debug }); }
    inputValue() {
      let direction = (this.keys.RIGHT.isDown || this.keys.D.isDown ? 1 : 0) - (this.keys.LEFT.isDown || this.keys.A.isDown ? 1 : 0);
      if (!direction) direction = steering?.direction() || 0;
      const pointers = this.input.manager.pointers.filter(pointer => pointer.isDown);
      if (pointers.length) direction = pointers.at(-1).x < W / 2 ? -1 : 1;
      return Math.round(direction * 100);
    }
    update(_, delta) {
      if (!this.run) return;
      const dt = Math.min(delta / 1000, .05); this.clock += dt;
      if (this.run.phase === 'playing') {
        // Catch up wall time after backgrounding. Time attack cannot be paused by hiding a tab.
        const targetTicks = Math.min(240000, Math.floor((performance.now() - this.startedAt) / 1000 / STEP));
        const input = this.inputValue(); let count = 0;
        while (this.run.ticks < targetTicks && this.run.phase === 'playing' && count++ < 720) {
          if (this.lastInput !== input) { this.inputs.push([this.run.ticks, input]); this.lastInput = input; }
          stepChallenge(this.run, input);
          for (const event of this.run.events) {
            if (event.type === 'landing') {
              if(['cloud','fragile'].includes(event.platformType)) this.platformPoof(event);
              else for (let i = 0; i < 8; i++) this.particles.push({ x: event.x, y: event.y, vx: (Math.random() - .5) * 110, vy: -Math.random() * 65, life: .4, type: 'dust' });
            }
          }
          if (this.run.player.vy < 0 && this.run.ticks % 6 === 0) this.particles.push({ x: this.run.player.x, y: this.run.player.y + 18, vx: (Math.random() - .5) * 45, vy: 55, life: .32, type: this.run.boostActive ? 'boost' : 'wind' });
        }
        if (this.run.phase !== 'playing') {
          this.publish(); this.game.events.emit('run-ended', { session: this.session, record: { inputs: this.inputs, ticks: this.run.ticks }, result: summary(this.run) });
        } else if (this.clock - this.publishedAt > .08) { this.publish(); this.publishedAt = this.clock; }
      }
      this.viewCamera += (this.run.camera - this.viewCamera) * (1 - Math.exp(-dt * 14));
      for (const a of this.particles) { a.x += a.vx * dt; a.y += a.vy * dt; a.life -= dt; if(a.type==='debris')a.vy+=120*dt; if(a.life<=0)a.sprite?.destroy(); }
      this.particles = this.particles.filter(a => a.life > 0); this.draw(dt);
    }
    draw(dt) {
      const r = this.run, cam = this.viewCamera, g = this.g, ambient = this.ambient; g.clear(); ambient.clear();
      const target = stageFor(this.uiStage ?? r.floor), mix = 1 - Math.exp(-dt * 1.5);
      for (const key of ['sky', 'tint', 'tower']) this.theme[key] = blendColor(this.theme[key], target[key], mix);
      this.night += ((target.floor >= 500 ? 1 : 0) - this.night) * mix;
      this.sky.setFillStyle(this.theme.sky);
      let accumulatedWeight = 0;
      this.backdrops.forEach((layer,index) => {
        this.stageWeights[index] += ((STAGES[index].floor===target.floor ? 1 : 0)-this.stageWeights[index])*mix;
        const weight=this.stageWeights[index]; accumulatedWeight+=weight;
        // Alpha-over with cumulative weights preserves brightness during either direction of a crossfade.
        layer.setAlpha(accumulatedWeight>0 ? weight/accumulatedWeight : 0).setVisible(weight>.0001);
        layer.tilePositionY=cam*.12;
      });
      const grounded=this.stageWeights[0]+this.stageWeights[1], celestial=1-grounded;
      this.midLayers.forEach((layer, i) => layer.setY(parallaxY(i * 350 - 100, cam, .38, 1400)).setTint(this.theme.tint).setAlpha(.22*grounded));
      let sideWeight=0;
      this.sideLayers.forEach((pair,index)=>{const weight=this.stageWeights[index];sideWeight+=weight;
        pair.forEach(layer=>{layer.setAlpha(sideWeight>0?weight/sideWeight:0).setVisible(weight>.0001);layer.tilePositionY=cam*.72;});});
      if (this.night > .01) {
        ambient.fillStyle(0xfff1d8, .65 * this.night); for (let i = 0; i < 45; i++) ambient.fillCircle(60 + i * 79 % 360, ((i * 113 - cam * .04) % H + H) % H, i % 4 === 0 ? 1.8 : .9);
      }
      const visible = new Set(), pickups = new Set();
      for (const q of r.platforms) {
        const y = q.y - cam;
        if (q.spent || y < -100 || y > H + 60) continue;
        visible.add(q.id);
        {
          const frame=q.type==='cloud' ? 1 : q.type==='fragile' ? 2 : target.floor>=300 ? 3 : 0;
          let sprite = this.platformSprites.get(q.id);
          if (!sprite) { sprite = this.add.image(q.x, y, 'platform-atlas',frame).setOrigin(.5,.36).setDepth(1); this.platformSprites.set(q.id, sprite); }
          const size=q.width/.85;
          // Clouds keep their white/blue curls; only solid summit decks are darkened.
          sprite.setTexture(target.floor>=900 && q.type!=='cloud'?'summit-platforms':'platform-atlas',frame).setOrigin(.5,frame<2 ? .48 : .35).setPosition(q.x,y).setDisplaySize(size,size).setTint(0xffffff);
          let shadow=this.platformShadows.get(q.id);
          if(!shadow){shadow=this.add.image(q.x,y,'platform-shadow',frame).setDepth(.9);this.platformShadows.set(q.id,shadow);}
          shadow.setFrame(frame).setOrigin(.5,frame<2?.48:.35).setPosition(q.x,y+3).setDisplaySize(size+7,size+7).setTint(0xffffff).setAlpha(target.floor>=900?(q.type==='cloud'?.45:.7):0);
          g.lineStyle(2, q.type === 'cloud' ? 0xe9faff : q.amplitude ? 0x9eeaff : q.type === 'fragile' ? 0xffb46f : 0xffd889, .9); g.lineBetween(q.x - q.width * .43, y, q.x + q.width * .43, y);
          if (q.type === 'fragile') { g.lineStyle(2, 0xffd990); g.lineBetween(q.x - 10, y - 7, q.x, y - 14); g.lineBetween(q.x, y - 14, q.x + 10, y - 7); }
          if (q.amplitude) { g.lineStyle(1.5, 0xdefcff); for (const sign of [-1, 1]) { g.lineBetween(q.x, y + 12, q.x + sign * 13, y + 12); g.lineBetween(q.x + sign * 13, y + 12, q.x + sign * 9, y + 8); } }
        }
        if (q.pickup && !q.collected) {
          pickups.add(q.id); let item = this.rewardSprites.get(q.id);
          if (!item) { item = this.add.image(q.x, y - 38, 'rewards', iconFrame[q.pickup]).setDisplaySize(32, 32).setDepth(2); this.rewardSprites.set(q.id, item); }
          item.setPosition(q.x, y - 38); g.fillStyle(q.pickup === 'time' || q.pickup === 'skill' ? 0x73e7ff : 0xffdf73, .12); g.fillCircle(q.x, y - 38, 21);
        }
      }
      for (const [key, sprite] of this.platformSprites) if (!visible.has(key)) { sprite.destroy(); this.platformSprites.delete(key); }
      for(const [key,sprite] of this.platformShadows) if(!visible.has(key)){sprite.destroy();this.platformShadows.delete(key);}
      for (const [key, sprite] of this.rewardSprites) if (!pickups.has(key)) { sprite.destroy(); this.rewardSprites.delete(key); }
      for (const shot of r.weapons) {
        const y = shot.y - cam;
        if (shot.warning > 0) {
          const top=110;
          g.fillStyle(0xff4c36,.65+Math.sin(this.clock*18)*.2);g.fillTriangle(shot.x-9,top,shot.x+9,top,shot.x,top+15);
          g.lineStyle(2,0xff8b71,.42);g.lineBetween(shot.x,top+18,shot.x,H);
        } else {
          g.lineStyle(3,0xc8eaff);g.lineBetween(shot.x,y-30,shot.x,y);
          g.fillStyle(0xf7faff);g.fillTriangle(shot.x,y+12,shot.x-6,y-2,shot.x+6,y-2);
          g.lineStyle(2,0xc59a62);g.lineBetween(shot.x-5,y-29,shot.x,y-23);g.lineBetween(shot.x+5,y-29,shot.x,y-23);
        }
      }
      for (const a of this.particles) {
        if(a.type==='poof') {const progress=1-a.life/a.total;a.sprite.setPosition(a.x,a.y-cam).setAlpha((1-progress)**1.4*.8).setDisplaySize(a.size*(.75+progress*1.7),a.size*(.6+progress*1.1));continue;}
        const alpha = Math.max(0, a.life / .4);
        if (a.type === 'wind' || a.type === 'boost') { g.lineStyle(a.type === 'boost' ? 2 : 1, a.type === 'boost' ? 0x8cffff : 0xf6fcff, alpha); g.strokeEllipse(a.x, a.y - cam, 10 + (1 - alpha) * 18, 3 + (1 - alpha) * 4); }
        else { g.fillStyle(a.type === 'debris' ? 0xc38c58 : 0xffe6ac, alpha); g.fillRect(a.x, a.y - cam, 3, 3); }
      }
      const qi=this.qi;qi.clear();const active=r.phase==='playing' && r.boostActive;
      const hx=r.player.x,hy=r.player.y+12-cam;
      if(active){
        // Soft foot-level ripples and drifting sparks, with no rigid side streaks.
        for(let i=3;i>0;i--){qi.fillStyle(0x80f4e3,.025);qi.fillEllipse(hx,hy-8,32+i*12,30+i*14);}
        for(let i=0;i<2;i++){const t=(this.clock*1.6+i/2)%1;qi.lineStyle(2.5,0xb9ffeb,(1-t)*.75);qi.strokeEllipse(hx,hy+6+t*22,30+t*45,7+t*10);}
        for(let i=0;i<8;i++){const t=(this.clock*1.25+i/8)%1,angle=i*2.4+this.clock;qi.fillStyle(i%2?0xffedbd:0xb4ffe8,(1-t)*.8);qi.fillCircle(hx+Math.sin(angle)*(12+t*16),hy+8+t*35,1.4*(1-t)+.4);}
      }else if(r.charge>0 && r.phase==='playing'){qi.lineStyle(2,0xb5fbea,.45+Math.sin(this.clock*5)*.15);qi.strokeEllipse(hx,hy,42,10);}
      const flash = r.pickupFlash;
      this.pickupLabel.setVisible(!!flash && flash.life > 0);
      if (flash) this.pickupLabel.setText(flash.kind === 'skill' ? '↑ ×2' : flash.kind === 'time' ? `+${flash.amount}s` : `+${flash.amount}`).setPosition(flash.x, flash.y - cam - (1 - flash.life / .85) * 35).setAlpha(Math.max(0, flash.life / .85));
      this.hero.setPosition(r.player.x, r.player.y + 18 - cam).setFrame(jumpFrame(r.player.vy, r.sinceLanding, r.phase, r.lastJumpSpeed)).setDisplaySize(102, 102);
      if (Math.abs(r.player.lean) > .15) this.hero.setFlipX(r.player.lean < 0); this.hero.setAngle(r.player.lean * 3);
    }
  }
  return new Phaser.Game({ type: Phaser.AUTO, parent, width: W, height: H, backgroundColor: '#c9deed', antialias: true, scene: Climb, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, input: { activePointers: 2 }, banner: false });
}
