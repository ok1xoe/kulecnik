// Testy Kulečníku: stabilita fyziky, stavový automat, AI vs AI dohrání, screenshoty.
const H = require('/Users/hyman/EngetoAcademy/TizenOS/_kit/headless.js');
const path = require('path');
const root = path.join(__dirname, '..');
const out = process.argv[2] || '/tmp';
function load() { return H.load([root + '/js/speccy.js', root + '/js/game.js']); }
let fails = 0;
function ok(c, m) { if (!c) { fails++; console.log('CHYBA:', m); } }

// 1) Fyzika: náhodné údery, energie, NaN, stěny
{
    const g = load(), S = g.sandbox, GM = S.GAME;
    GM.setSilent();
    let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    let maxOut = 0, nan = 0, grow = 0, shots = 0, pocketed = 0, ticksMax = 0;
    for (let s = 0; s < 300; s++) {
        GM.setupBalls(rnd);
        const bs = GM.balls, c = bs[0];
        const a = rnd() * 6.283, v = 0.9 + rnd() * 8.1;
        c.vx = Math.cos(a) * v; c.vy = Math.sin(a) * v;
        let prevE = Infinity, t = 0;
        do {
            GM.physTick(); t++;
            let e = 0;
            for (const b of bs) {
                if (!isFinite(b.x) || !isFinite(b.y) || !isFinite(b.vx) || !isFinite(b.vy)) { nan++; }
                if (b.on) {
                    e += b.vx * b.vx + b.vy * b.vy;
                    const B = GM.bounds;
                    const o = Math.max(B.L + B.BR - b.x, b.x - (B.R - B.BR), B.T + B.BR - b.y, b.y - (B.B - B.BR));
                    if (o > maxOut && !GM.nearGap(b.x, b.y)) { maxOut = o; }
                    if (o > 4) { console.log('mimo stůl', b.id, b.x, b.y); fails++; }
                }
            }
            if (e > prevE + 1e-6) { grow++; }
            prevE = e;
        } while (GM.moving() && t < 20000);
        ticksMax = Math.max(ticksMax, t);
        shots++; pocketed += 16 - bs.filter(b => b.on).length;
    }
    console.log(`fyzika: ${shots} úderů, NaN=${nan}, růst energie=${grow}, max přesah stěny=${maxOut.toFixed(3)}, nejdelší=${ticksMax} ticků, zapadlo celkem ${pocketed}`);
    ok(nan === 0, 'NaN'); ok(grow === 0, 'energie roste'); ok(maxOut < 0.01, 'přesah stěny'); ok(ticksMax < 20000, 'neskončí');
}

// 2) Stavy a dohrání hry AI vs AI (obě strany řízeny AI přes přepsání isAI není možné -> hrajeme člověka botem přes plans)
{
    const g = load(), S = g.sandbox, GM = S.GAME, Z = g.Z;
    GM.setSilent();
    ok(GM.mode === 'title', 'start na titulu');
    g.step(3);
    g.png(out + '/kul_title.png', 3);
    g.key(32, true); g.step(2); g.key(32, false); g.step(2);
    ok(GM.mode === 'play', 'play po startu');
    // ruční úder: zaměřit, nabít, vystřelit klávesami
    g.key(39, true); g.step(10); g.key(39, false);
    g.step(60);
    g.key(32, true); g.step(40); g.png(out + '/kul_aim.png', 3); g.key(32, false);
    g.step(5);
    ok(GM.G.phase === 'roll', 'úder -> roll, je ' + GM.G.phase);
    let t = 0; while (GM.G.phase === 'roll' && t++ < 20000) { g.step(1); }
    g.png(out + '/kul_after.png', 3);
    ok(GM.G.phase !== 'roll', 'po úderu se zastaví');
    // celá hra: lidský hráč = bot (stejná logika plans), soupeř = vestavěná AI
    const wins = [0, 0, 0];
    for (let lv = 1; lv <= 3; lv++) {
        for (let game = 0; game < 4; game++) {
            const g2 = load(), G2 = g2.sandbox.GAME;
            G2.setSilent(); g2.Z.pauseOk = true; const realDraw = null; g2.Z.setGame({ tick: G2.tick, draw() {} });
            G2.newGame(true, lv, 100 + game * 13 + lv);
            let ticks = 0, nanSeen = false, shotsH = 0;
            while (G2.mode === 'play' && ticks < 400000) {
                const GG = G2.G;
                if (GG.phase !== 'roll' && GG.cur === 0 && GG.wait <= 0) {
                    if (GG.phase === 'place') { // položit na nejlepší místo
                        const c = G2.balls[0]; let best = null;
                        for (let y = 50; y < 145; y += 8) for (let x = 24; x < 232; x += 8) if (G2.validPlace(x, y)) { const p = G2.plans(x, y); const s = p.length ? p[0].score : -99; if (!best || s > best.s) best = { x, y, s }; }
                        c.x = best.x; c.y = best.y; GG.phase = 'aim'; GG.hand = false; GG.wait = 5;
                    } else {
                        const c = G2.balls[0];
                        const pl = G2.plans(c.x, c.y);
                        const an = GG.shotNo === 0 ? 0 : (pl.length ? pl[0].angle : Math.random() * 6.28);
                        G2.shoot(an + (Math.random() - 0.5) * 0.03, GG.shotNo === 0 ? 1 : (pl.length ? pl[0].power : 0.5)); shotsH++;
                    }
                }
                g2.step(1); ticks++;
                if (g2.hasNaN(G2.balls)) { nanSeen = true; break; }
            }
            ok(!nanSeen, 'NaN ve hře');
            ok(G2.mode === 'over', `hra lv${lv} #${game} dohrána (ticků ${ticks}, tahů hráče ${shotsH}, stav ${G2.G.phase})`);
            if (G2.mode === 'over') { wins[lv - 1] += G2.G.winner === 0 ? 1 : 0; console.log(`lv${lv} hra${game}: vítěz ${G2.G.winner} (${G2.G.reason}), ticků ${ticks}, tahů ${G2.G.shotNo}`);
                if (lv === 3 && game === 0) { g2.Z.setGame({ tick: G2.tick, draw: G2.draw }); g2.step(1); g2.png(out + '/kul_over.png', 3); }
                if (G2.G.winner === 0) { ok(g2.Z.hi.get('kulecnik') >= 1, 'rekord'); }
                g2.step(100); g2.key(32, true); g2.step(2); g2.key(32, false); g2.step(2);
                ok(G2.mode === 'title', 'návrat na titul');
            }
        }
    }
    console.log('výhry bota-člověka podle úrovně AI:', wins);
}
console.log(fails ? 'SELHÁNÍ ' + fails : 'VŠE OK');
process.exit(fails ? 1 : 0);
