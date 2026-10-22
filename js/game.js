// Kulečník – osmička, pohled shora. Fyzika: 2D koule, odrazy od mantinelů, srážky s přenosem hybnosti, tření, kapsy.
(function () {
    'use strict';
    var Zx = window.Z;

    // ---- Stůl
    var L = 16, R = 240, T = 40, B = 152;       // plocha sukna
    var BR = 3, D = 2 * BR;                      // poloměr koule
    var HEADX = L + 56;                          // hlavová čára
    var FOOTX = L + 160;                         // špička trojúhelníku
    var CY = (T + B) / 2;
    var E_BALL = 0.95, E_WALL = 0.74;
    var POCKETS = [
        { x: L - 1, y: T - 1, c: 7.5, g: 10 }, { x: 128, y: T - 3, c: 7, g: 9 }, { x: R + 1, y: T - 1, c: 7.5, g: 10 },
        { x: L - 1, y: B + 1, c: 7.5, g: 10 }, { x: 128, y: B + 3, c: 7, g: 9 }, { x: R + 1, y: B + 1, c: 7.5, g: 10 }
    ];
    var COLS = [15, 14, 9, 10, 11, 12, 13, 2, 0];   // barvy 0..8 (9..15 = pruhy s barvou id-8)

    // ---- Fyzika (nezávislá na hře, testovatelná)
    var balls = [];
    var res = { first: null, pocketed: [], cue: false, rail: false };
    var onPocket = null, onSound = null;

    function nearGap(x, y) {
        for (var i = 0; i < 6; i++) {
            var dx = x - POCKETS[i].x, dy = y - POCKETS[i].y;
            if (dx * dx + dy * dy < POCKETS[i].g * POCKETS[i].g) { return true; }
        }
        return false;
    }
    function rail(b, nx, ny) {
        var vn = b.vx * nx + b.vy * ny;       // záporné = do stěny
        if (vn < 0) {
            b.vx -= (1 + E_WALL) * vn * nx; b.vy -= (1 + E_WALL) * vn * ny;
            if (-vn > 0.25) { if (res.first !== null) { res.rail = true; } if (onSound) { onSound('rail', -vn); } }
        }
    }
    function wall(b) {
        if (nearGap(b.x, b.y)) { return; }
        if (b.x < L + BR) { b.x = L + BR; rail(b, 1, 0); }
        else if (b.x > R - BR) { b.x = R - BR; rail(b, -1, 0); }
        if (b.y < T + BR) { b.y = T + BR; rail(b, 0, 1); }
        else if (b.y > B - BR) { b.y = B - BR; rail(b, 0, -1); }
    }
    function collide(a, b) {
        var dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 >= D * D) { return; }
        var d = Math.sqrt(d2) || 0.0001, nx = dx / d, ny = dy / d;
        var ov = (D - d) / 2;
        a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
        var rv = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (rv > 0) {
            var j = (1 + E_BALL) * rv / 2;
            a.vx -= j * nx; a.vy -= j * ny; b.vx += j * nx; b.vy += j * ny;
            if (onSound) { onSound('ball', rv); }
        }
        if (res.first === null && (a.id === 0 || b.id === 0)) { res.first = a.id === 0 ? b.id : a.id; }
    }
    function subStep(f) {
        var i, j, b;
        for (i = 0; i < balls.length; i++) { b = balls[i]; if (b.on) { b.x += b.vx * f; b.y += b.vy * f; } }
        for (i = 0; i < balls.length; i++) { if (balls[i].on) { wall(balls[i]); } }
        for (i = 0; i < balls.length; i++) {
            if (!balls[i].on) { continue; }
            for (j = i + 1; j < balls.length; j++) { if (balls[j].on) { collide(balls[i], balls[j]); } }
        }
        for (i = 0; i < balls.length; i++) { if (balls[i].on) { wall(balls[i]); } }
        for (i = 0; i < balls.length; i++) {
            b = balls[i];
            if (!b.on) { continue; }
            for (j = 0; j < 6; j++) {
                var dx = b.x - POCKETS[j].x, dy = b.y - POCKETS[j].y;
                var lost = b.x < L || b.x > R || b.y < T || b.y > B;       // střed přešel okraj sukna ústím kapsy
                if (lost || dx * dx + dy * dy < POCKETS[j].c * POCKETS[j].c) {
                    b.on = false; b.vx = b.vy = 0;
                    if (b.id === 0) { res.cue = true; } else { res.pocketed.push(b.id); }
                    if (onPocket) { onPocket(b); }
                    break;
                }
            }
        }
    }
    function friction() {
        for (var i = 0; i < balls.length; i++) {
            var b = balls[i];
            if (!b.on) { continue; }
            var v = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
            if (v === 0) { continue; }
            var nv = (v - 0.012) * 0.9935;
            if (nv < 0.03) { b.vx = b.vy = 0; } else { b.vx *= nv / v; b.vy *= nv / v; }
        }
    }
    function moving() {
        for (var i = 0; i < balls.length; i++) { if (balls[i].on && (balls[i].vx || balls[i].vy)) { return true; } }
        return false;
    }
    function physTick() {
        var mv = 0;
        for (var i = 0; i < balls.length; i++) {
            if (balls[i].on) { mv = Math.max(mv, Math.sqrt(balls[i].vx * balls[i].vx + balls[i].vy * balls[i].vy)); }
        }
        var n = Math.max(1, Math.ceil(mv / 1.2));
        for (var s = 0; s < n; s++) { subStep(1 / n); }
        friction();
    }
    function speedAfter(v0, dist) {            // rychlost po ujetí dist (stejné tření jako ve fyzice)
        var v = v0, d = 0;
        while (v > 0.03 && d < dist) { d += v; v = (v - 0.012) * 0.9935; }
        return d >= dist ? v : 0;
    }
    function travel(v0) { var v = v0, d = 0; while (v > 0.03) { d += v; v = (v - 0.012) * 0.9935; } return d; }
    function speedOf(p) { return 0.9 + p * 8.1; }

    function setupBalls(rnd) {
        balls = [];
        for (var i = 0; i < 16; i++) { balls.push({ id: i, x: 0, y: 0, vx: 0, vy: 0, on: true }); }
        balls[0].x = HEADX - 16; balls[0].y = CY;
        var ids = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];
        for (var k = ids.length - 1; k > 0; k--) { var m = Math.floor(rnd() * (k + 1)), t = ids[k]; ids[k] = ids[m]; ids[m] = t; }
        // osmička uprostřed (index 4), protilehlé rohy různé skupiny
        var order = [], idx = 0;
        for (var p = 0; p < 15; p++) { order.push(p === 4 ? 8 : ids[idx++]); }
        var pos = 0, dx = D * 0.866 + 0.15;
        for (var c = 0; c < 5; c++) {
            for (var r = 0; r <= c; r++) {
                var b = balls[order[pos++]];
                b.x = FOOTX + c * dx; b.y = CY + (r - c / 2) * (D + 0.15);
            }
        }
    }

    // ---- Stav hry
    var mode = 'title', menu = 0, vsAI = true, level = 1;
    var G = null;
    var CAPT = ['LEHKÁ', 'STŘEDNÍ', 'TĚŽKÁ'];

    function groupOf(id) { return id === 8 ? 'eight' : id === 0 ? 'cue' : id < 8 ? 'solid' : 'stripe'; }
    function remaining(g) { var n = 0; for (var i = 1; i < 16; i++) { if (balls[i].on && groupOf(i) === g) { n++; } } return n; }
    function isAI(p) { return G.vsAI && p === 1; }
    function pname(p) { return G.vsAI ? (p ? 'POČÍTAČ' : 'HRÁČ') : 'HRÁČ ' + (p + 1); }
    function gname(g) { return g === 'solid' ? 'PUNTÍKY' : g === 'stripe' ? 'PRUHY' : '---'; }
    function say(s, t) { G.msg = s; G.msgT = t || 200; }

    function newGame(ai, lv, seed) {
        var rnd = Zx.rng(seed || (Date.now() & 0xffffff));
        setupBalls(rnd);
        res = { first: null, pocketed: [], cue: false, rail: false };
        G = { vsAI: ai, level: lv, cur: 0, groups: [null, null], phase: 'aim', shotNo: 0, angle: 0, power: 0, charging: false,
            hand: false, msg: '', msgT: 0, winner: -1, reason: '', ai: null, wait: 40, t: 0, remBefore: 0, rnd: rnd, overT: 0, won: false };
        say('ROZEHRA: ' + pname(0), 150);
        Zx.pauseOk = true;
        mode = 'play';
        beginTurn();
    }

    function beginTurn() { G.ai = isAI(G.cur) ? { ph: 'think', t: 0, plan: null } : null; G.charging = false; G.power = 0; }

    function shoot(angle, power) {
        var c = balls[0], v = speedOf(power);
        c.vx = Math.cos(angle) * v; c.vy = Math.sin(angle) * v;
        res = { first: null, pocketed: [], cue: false, rail: false };
        G.remBefore = G.groups[G.cur] ? remaining(G.groups[G.cur]) : 99;
        G.phase = 'roll'; G.charging = false; G.hand = false;
        Zx.snd.beep(180, 0.05, 90, 0.3);
    }

    function endGame(winner, reason) {
        G.winner = winner; G.reason = reason; G.phase = 'over'; G.overT = 0; mode = 'over'; Zx.pauseOk = false;
        if (G.vsAI && winner === 0) { Zx.hi.set('kulecnik', Zx.hi.get('kulecnik') + 1); G.won = true; Zx.snd.win(); } else { Zx.snd.over(); }
    }

    function respot8() {
        var b = balls[8], x = FOOTX, ok = false;
        while (!ok) {
            ok = true;
            for (var i = 0; i < 16; i++) {
                if (i !== 8 && balls[i].on && Math.hypot(balls[i].x - x, balls[i].y - CY) < D + 0.2) { ok = false; x += 1; break; }
            }
        }
        b.on = true; b.x = x; b.y = CY; b.vx = b.vy = 0;
    }

    function resolve() {
        var p = G.cur, o = 1 - p, r = res, foul = false, why = '';
        var mg = G.groups[p];
        if (r.cue) { foul = true; why = 'BÍLÁ V KAPSE'; }
        else if (r.first === null) { foul = true; why = 'MINUL JSI'; }
        else {
            var fg = groupOf(r.first), ok;
            if (!mg) { ok = fg !== 'eight'; } else if (G.remBefore > 0) { ok = fg === mg; } else { ok = fg === 'eight'; }
            if (!ok) { foul = true; why = 'ŠPATNÁ KOULE'; }
            else if (!r.pocketed.length && !r.rail) { foul = true; why = 'ŽÁDNÝ MANTINEL'; }
        }
        if (r.pocketed.indexOf(8) >= 0) {
            if (G.shotNo === 0) { respot8(); r.pocketed.splice(r.pocketed.indexOf(8), 1); }
            else {
                var win = !foul && mg && G.remBefore === 0;
                if (win) { endGame(p, pname(p) + ' ZAHRÁL OSMIČKU'); }
                else { endGame(o, pname(p) + ': OSMIČKA ' + (foul ? 'PŘI FAULU' : 'PŘEDČASNĚ')); }
                return;
            }
        }
        if (!mg && !foul && G.shotNo > 0) {
            var first = r.pocketed.filter(function (i) { return i !== 8; })[0];
            if (first) {
                G.groups[p] = groupOf(first); G.groups[o] = G.groups[p] === 'solid' ? 'stripe' : 'solid';
                mg = G.groups[p];
            }
        }
        var own = r.pocketed.some(function (i) { return i !== 8 && (!mg || groupOf(i) === mg); });
        var next = p;
        if (foul) { next = o; } else if (!own) { next = o; }
        G.shotNo++;
        G.cur = next;
        if (r.cue || !balls[0].on) { balls[0].on = true; balls[0].x = HEADX - 16; balls[0].y = CY; balls[0].vx = balls[0].vy = 0; }
        if (foul) {
            G.hand = true; G.phase = 'place';
            say('FAUL: ' + why + ' - ' + pname(next) + ': BÍLÁ V RUCE', 220);
            Zx.snd.hit();
        } else {
            G.hand = false; G.phase = 'aim';
            say(own ? pname(p) + ' POKRAČUJE' + (G.shotNo === 1 ? '' : '') : 'TAH: ' + pname(next), 140);
            if (own) { Zx.snd.coin(); }
        }
        G.wait = 45;
        if (G.hand && isAI(G.cur)) { balls[0].x = HEADX - 16; }
        beginTurn();
    }

    // ---- Zaměřování
    function rayInfo(x, y, ang) {
        var dx = Math.cos(ang), dy = Math.sin(ang), best = 1e9, hit = null;
        for (var i = 1; i < 16; i++) {
            var b = balls[i];
            if (!b.on) { continue; }
            var fx = b.x - x, fy = b.y - y, pr = fx * dx + fy * dy;
            if (pr <= 0) { continue; }
            var perp2 = fx * fx + fy * fy - pr * pr;
            if (perp2 >= D * D) { continue; }
            var t = pr - Math.sqrt(D * D - perp2);
            if (t < best) { best = t; hit = b; }
        }
        var tw = 1e9;
        if (dx > 0) { tw = Math.min(tw, (R - BR - x) / dx); } else if (dx < 0) { tw = Math.min(tw, (L + BR - x) / dx); }
        if (dy > 0) { tw = Math.min(tw, (B - BR - y) / dy); } else if (dy < 0) { tw = Math.min(tw, (T + BR - y) / dy); }
        if (tw < best) { return { t: tw, ball: null, dx: dx, dy: dy }; }
        return { t: best, ball: hit, dx: dx, dy: dy };
    }

    function validPlace(x, y) {
        if (x < L + BR || x > R - BR || y < T + BR || y > B - BR || nearGap(x, y)) { return false; }
        for (var i = 1; i < 16; i++) { if (balls[i].on && Math.hypot(balls[i].x - x, balls[i].y - y) < D + 0.3) { return false; } }
        return true;
    }

    // ---- AI
    function legalTargets() {
        var g = G.groups[G.cur], list = [], i;
        for (i = 1; i < 16; i++) {
            if (!balls[i].on) { continue; }
            var gr = groupOf(i);
            if (!g) { if (gr !== 'eight') { list.push(i); } }
            else if (remaining(g) > 0) { if (gr === g) { list.push(i); } }
            else if (gr === 'eight') { list.push(i); }
        }
        return list;
    }
    function segDist(px, py, ax, ay, bx, by) {
        var vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy, t = l2 ? ((px - ax) * vx + (py - ay) * vy) / l2 : 0;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
    }
    // Seznam kandidátů tahu z pozice (cx,cy)
    function plans(cx, cy) {
        var out = [], tg = legalTargets();
        tg.forEach(function (id) {
            var t = balls[id];
            POCKETS.forEach(function (pk) {
                var ex = pk.x, ey = pk.y;
                if (pk.x < 128) { ex += 1.5; } else if (pk.x > 128) { ex -= 1.5; }
                if (pk.y < CY) { ey += 1.5; } else { ey -= 1.5; }
                var d2 = Math.hypot(ex - t.x, ey - t.y), ux = (ex - t.x) / d2, uy = (ey - t.y) / d2;
                var gx = t.x - ux * D, gy = t.y - uy * D;
                if (!validPlaceGhost(gx, gy)) { return; }
                var d1 = Math.hypot(gx - cx, gy - cy), cvx = (gx - cx) / d1, cvy = (gy - cy) / d1;
                var cs = cvx * ux + cvy * uy;
                if (cs < 0.3 || d1 < 1) { return; }
                for (var i = 1; i < 16; i++) {
                    if (i === id || !balls[i].on) { continue; }
                    if (segDist(balls[i].x, balls[i].y, cx, cy, gx, gy) < D + 0.6) { return; }
                    if (segDist(balls[i].x, balls[i].y, t.x, t.y, ex, ey) < D + 0.6) { return; }
                }
                // rychlost: cíl musí dojet ke kapse, bílá k bodu dotyku
                var need = d2 * 1.15 + 14, vt = 0.5;
                while (travel(vt) < need && vt < 12) { vt += 0.1; }
                var vimp = vt / Math.max(cs, 0.35), v0 = 0.9;
                while (speedAfter(v0, d1) < vimp && v0 < 9) { v0 += 0.1; }
                out.push({ angle: Math.atan2(cvy, cvx), power: Math.min(1, (v0 - 0.9) / 8.1), score: cs * 100 - (d1 + d2) * 0.12 - (pk.x === 128 ? 6 : 0), id: id });
            });
        });
        out.sort(function (a, b) { return b.score - a.score; });
        return out;
    }
    function validPlaceGhost(x, y) { return x > L + 1 && x < R - 1 && y > T + 1 && y < B - 1; }
    function noise(s) { return (G.rnd() + G.rnd() + G.rnd() - 1.5) * 2 * s; }
    function aiShot(cx, cy) {
        var lv = G.level, sig = [0.05, 0.02, 0.005][lv - 1], psig = [0.18, 0.09, 0.03][lv - 1];
        if (G.shotNo === 0) {
            return { angle: Math.atan2(CY - cy, FOOTX - cx) + noise(0.01), power: Math.min(1, 0.85 + G.rnd() * 0.15) };
        }
        var list = plans(cx, cy), pl;
        if (list.length) {
            pl = list[lv === 1 ? Math.min(list.length - 1, Math.floor(G.rnd() * Math.min(3, list.length))) : 0];
        } else {
            var tg = legalTargets(), bi = tg[0], bd = 1e9;
            tg.forEach(function (i) { var d = Math.hypot(balls[i].x - cx, balls[i].y - cy); if (d < bd) { bd = d; bi = i; } });
            pl = { angle: Math.atan2(balls[bi].y - cy, balls[bi].x - cx), power: 0.45 + G.rnd() * 0.2, score: -100 };
            pl.bank = true;
        }
        return { angle: pl.angle + noise(sig), power: Zx.clamp(pl.power * (1 + noise(psig)) + (pl.bank ? 0 : 0.03), 0.12, 1), score: pl.score };
    }
    function aiChooseHand() {
        var bestS = -1e9, bx = HEADX - 16, by = CY;
        for (var y = T + 8; y < B - 6; y += 10) {
            for (var x = L + 8; x < R - 6; x += 10) {
                if (!validPlace(x, y)) { continue; }
                var pl = plans(x, y), s = pl.length ? pl[0].score + G.rnd() * 3 : -50 + G.rnd();
                if (s > bestS) { bestS = s; bx = x; by = y; }
            }
        }
        return { x: bx, y: by };
    }
    function angDiff(a, b) { var d = b - a; while (d > Math.PI) { d -= 2 * Math.PI; } while (d < -Math.PI) { d += 2 * Math.PI; } return d; }

    function aiTick() {
        var a = G.ai, c = balls[0];
        if (G.phase === 'place') {
            if (a.t++ > 30) {
                var h = aiChooseHand(); c.x = h.x; c.y = h.y; G.hand = false; G.phase = 'aim'; G.wait = 20; beginTurn(); Zx.snd.tick();
            }
            return;
        }
        if (a.ph === 'think') {
            if (++a.t > 40) { a.plan = aiShot(c.x, c.y); a.ph = 'turn'; }
        } else if (a.ph === 'turn') {
            var d = angDiff(G.angle, a.plan.angle);
            if (Math.abs(d) < 0.02) { G.angle = a.plan.angle; a.ph = 'charge'; } else { G.angle += Math.sign(d) * Math.min(Math.abs(d), 0.03); }
        } else if (a.ph === 'charge') {
            G.power = Math.min(a.plan.power, G.power + 0.02); G.charging = true;
            if (G.power >= a.plan.power) { a.ph = 'hold'; a.t = 0; }
        } else if (a.ph === 'hold') {
            if (++a.t > 12) { shoot(G.angle, G.power); }
        }
    }

    // ---- Tik hry
    function humanTick() {
        var c = balls[0], fine = Zx.input.down('alt');
        if (G.phase === 'place') {
            var sp = fine ? 0.5 : 1.6;
            if (Zx.input.down('left')) { c.x -= sp; } if (Zx.input.down('right')) { c.x += sp; }
            if (Zx.input.down('up')) { c.y -= sp; } if (Zx.input.down('down')) { c.y += sp; }
            c.x = Zx.clamp(c.x, L + BR, R - BR); c.y = Zx.clamp(c.y, T + BR, B - BR);
            if (Zx.input.hit('fire') && validPlace(c.x, c.y)) { G.hand = false; G.phase = 'aim'; Zx.snd.tick(); G.wait = 10; }
            return;
        }
        var rs = fine ? 0.0035 : 0.024;
        if (Zx.input.down('left')) { G.angle -= rs; }
        if (Zx.input.down('right')) { G.angle += rs; }
        if (G.angle > Math.PI) { G.angle -= 2 * Math.PI; } else if (G.angle < -Math.PI) { G.angle += 2 * Math.PI; }
        if (!G.charging) { if (Zx.input.hit('fire')) { G.charging = true; G.power = 0; } }
        else if (Zx.input.down('fire')) { G.power = Math.min(1, G.power + 0.013); }
        else { if (G.power > 0.04) { shoot(G.angle, G.power); } else { G.charging = false; G.power = 0; } }
    }

    function tick() {
        if (mode === 'title') { titleTick(); return; }
        G.t++;
        if (G.msgT > 0) { G.msgT--; }
        if (mode === 'over') { G.overT++; if (G.overT > 80 && (Zx.input.hit('fire'))) { mode = 'title'; } return; }
        if (G.phase === 'roll') {
            physTick();
            if (!moving()) { resolve(); }
            return;
        }
        if (G.wait > 0) { G.wait--; return; }
        if (isAI(G.cur)) { aiTick(); } else { humanTick(); }
    }

    function titleTick() {
        Zx.pauseOk = false;
        if (Zx.input.hit('up')) { menu = (menu + 2) % 3; Zx.snd.tick(); }
        if (Zx.input.hit('down')) { menu = (menu + 1) % 3; Zx.snd.tick(); }
        if (Zx.input.hit('left') && menu === 2) { level = level > 1 ? level - 1 : 3; Zx.snd.tick(); }
        if (Zx.input.hit('right') && menu === 2) { level = level < 3 ? level + 1 : 1; Zx.snd.tick(); }
        if (Zx.input.hit('fire')) {
            if (menu === 2) { level = level < 3 ? level + 1 : 1; Zx.snd.tick(); } else { vsAI = menu === 0; newGame(vsAI, level); }
        }
    }

    // ---- Vykreslení
    function drawBall(b, x, y) {
        var id = b.id, col = id > 8 ? 15 : COLS[id];
        Zx.disc(x, y, BR, id > 8 ? 15 : col);
        if (id > 8) { Zx.rect(x - BR, y - 1, 2 * BR + 1, 3, COLS[id - 8]); Zx.pix(x - BR, y - 1, 15); Zx.pix(x + BR, y - 1, 15); Zx.pix(x - BR, y + 1, 15); Zx.pix(x + BR, y + 1, 15); }
        if (id === 8) { Zx.pix(x, y, 15); }
        if (id) { Zx.pix(x - 1, y - 1, 15); } else { Zx.pix(x - 1, y - 1, 7); }
    }
    function miniBall(id, x, y, on) {
        if (!on) { Zx.ring(x, y, 2, 1); return; }
        Zx.disc(x, y, 2, id > 8 ? 15 : COLS[id]);
        if (id > 8) { Zx.rect(x - 2, y, 5, 1, COLS[id - 8]); }
    }
    function dotted(x0, y0, x1, y1, col) {
        var len = Math.hypot(x1 - x0, y1 - y0), n = Math.floor(len / 3);
        for (var i = 0; i <= n; i++) { var t = n ? i / n : 0; Zx.pix(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, col); }
    }
    function drawTable() {
        Zx.rect(8, 32, 240, 128, 2);
        Zx.frame(8, 32, 240, 128, 0);
        Zx.rect(L - 5, T - 5, R - L + 10, B - T + 10, 4);
        Zx.rect(L, T, R - L, B - T, 12);
        Zx.rect(L + 1, T + 1, R - L - 2, B - T - 2, 4);
        for (var i = 0; i < 7; i++) {
            Zx.pix(L + 28 + i * 28, 36, 14); Zx.pix(L + 28 + i * 28, 156, 14);
        }
        Zx.pix(10, CY, 14); Zx.pix(245, CY, 14); Zx.pix(10, CY - 28, 14); Zx.pix(10, CY + 28, 14); Zx.pix(245, CY - 28, 14); Zx.pix(245, CY + 28, 14);
        Zx.rect(HEADX, T + 1, 1, B - T - 2, 12); Zx.pix(HEADX, CY, 15); Zx.pix(FOOTX, CY, 15);
        POCKETS.forEach(function (p) { Zx.disc(p.x, p.y, Math.floor(p.c - 0.5), 0); });
    }
    function hud() {
        for (var p = 0; p < 2; p++) {
            var ax = p ? 'right' : 'left', x = p ? 250 : 6, cur = G.cur === p && mode === 'play';
            var col = cur ? 14 : 7, g = G.groups[p];
            Zx.text(x, 2, pname(p) + (g ? ' ' + gname(g) : ''), col, { align: ax });
            if (cur && (G.t >> 4) % 2) { Zx.rect(p ? 250 - 3 : 6, 21, 3, 3, 14); }
            for (var k = 0; k < 7; k++) {
                var bx = p ? 244 - k * 9 : 12 + k * 9;
                if (g) {
                    var id = g === 'solid' ? k + 1 : k + 9;
                    miniBall(id, bx, 19, balls[id].on);
                } else { Zx.text(bx - 2, 14, '?', 7); }
            }
        }
    }
    function drawPlay() {
        drawTable();
        var i, b, c = balls[0];
        for (i = 1; i < 16; i++) { if (balls[i].on) { drawBall(balls[i], Math.round(balls[i].x), Math.round(balls[i].y)); } }
        if (G.phase === 'aim' || G.phase === 'place') {
            var okp = G.phase === 'aim' || validPlace(c.x, c.y);
            if (okp) { drawBall(c, Math.round(c.x), Math.round(c.y)); } else { Zx.disc(Math.round(c.x), Math.round(c.y), BR, 10); }
            if (G.phase === 'aim') {
                var info = rayInfo(c.x, c.y, G.angle), ex = c.x + info.dx * info.t, ey = c.y + info.dy * info.t;
                dotted(c.x + info.dx * (BR + 1), c.y + info.dy * (BR + 1), ex, ey, 15);
                Zx.ring(Math.round(ex), Math.round(ey), BR, 15);
                if (info.ball) {
                    var tx = info.ball.x - ex, ty = info.ball.y - ey, tl = Math.hypot(tx, ty) || 1;
                    dotted(info.ball.x, info.ball.y, info.ball.x + tx / tl * 16, info.ball.y + ty / tl * 16, 14);
                }
                var pull = G.charging ? 3 + G.power * 14 : 3, ca = Math.cos(G.angle), sa = Math.sin(G.angle);
                var s0 = BR + 1 + pull, s1 = s0 + 40;
                Zx.line(c.x - ca * s0, c.y - sa * s0, c.x - ca * s1, c.y - sa * s1, 6);
                Zx.line(c.x - ca * s0 + sa * 0.01, c.y - sa * s0 + 1, c.x - ca * s1, c.y - sa * s1 + 1, 6);
                Zx.line(c.x - ca * s0, c.y - sa * s0, c.x - ca * (s0 + 3), c.y - sa * (s0 + 3), 15);
            }
        } else { drawBall(c, Math.round(c.x), Math.round(c.y)); }
        hud();
        // síla
        Zx.frame(15, 163, 226, 7, 7);
        var w = Math.round(G.power * 222);
        for (i = 0; i < w; i++) { Zx.rect(16 + i, 164, 1, 5, i < 90 ? 12 : i < 160 ? 14 : 10); }
        Zx.text(128, 171, G.phase === 'place' ? 'ŠIPKY POSUN   FIRE POLOŽIT' : 'ŠIPKY ZAMĚŘ  ALT JEMNĚ  FIRE DRŽ=SÍLA', 7, { align: 'center' });
        if (G.msgT > 0 || G.phase === 'place') {
            Zx.text(128, 182, G.msg, (G.t >> 3) % 2 ? 14 : 15, { align: 'center' });
        } else if (isAI(G.cur)) { Zx.text(128, 182, 'TAHÁ POČÍTAČ...', 7, { align: 'center' }); }
    }
    function drawTitle() {
        Zx.cls(0, 7);
        Zx.rect(0, 0, 256, 192, 0);
        Zx.text(128, 8, 'KULEČNÍK', 14, { scale: 3, align: 'center' });
        Zx.text(128, 38, 'OSMIČKA - POHLED SHORA', 7, { align: 'center' });
        Zx.rect(40, 52, 176, 30, 2); Zx.rect(44, 56, 168, 22, 4);
        var cols = [14, 9, 10, 11, 12, 13];
        for (var i = 0; i < 6; i++) { Zx.disc(150 + i * 8, 67, 3, cols[i]); }
        Zx.disc(70, 67, 3, 15); Zx.line(52, 67, 64, 67, 6);
        var items = ['HRA PROTI POČÍTAČI', 'DVA HRÁČI', 'OBTÍŽNOST: ' + CAPT[level - 1]];
        for (var m = 0; m < 3; m++) {
            Zx.text(128, 92 + m * 12, (menu === m ? '> ' : '') + items[m] + (menu === m ? ' <' : ''), menu === m ? 14 : 7, { align: 'center' });
        }
        Zx.text(128, 132, 'ŠIPKY ZAMĚŘ  ALT JEMNĚ', 15, { align: 'center' });
        Zx.text(128, 142, 'FIRE DRŽ = SÍLA, PUSŤ = RÁZ', 15, { align: 'center' });
        Zx.text(128, 154, 'ZAHRAJ SVOJE KOULE A PAK OSMIČKU', 12, { align: 'center' });
        Zx.text(128, 164, 'FAUL = SOUPEŘ MÁ BÍLOU V RUCE', 12, { align: 'center' });
        Zx.text(128, 178, 'REKORD - VÝHRY NAD POČÍTAČEM: ' + Zx.hi.get('kulecnik'), 14, { align: 'center' });
    }
    function drawOver() {
        drawPlay();
        Zx.rect(30, 64, 196, 50, 0); Zx.frame(30, 64, 196, 50, 14);
        Zx.text(128, 70, 'KONEC HRY', 10, { scale: 2, align: 'center' });
        Zx.text(128, 92, G.reason, 15, { align: 'center' });
        Zx.text(128, 102, 'VÍTĚZ: ' + pname(G.winner) + (G.won ? '  REKORD ' + Zx.hi.get('kulecnik') : ''), 14, { align: 'center' });
    }
    function draw() {
        Zx.cls(0, 7);
        Zx.rect(0, 0, 256, 192, 0);
        if (mode === 'title') { drawTitle(); } else if (mode === 'over') { drawOver(); } else { drawPlay(); }
    }

    onSound = function (kind, v) {
        if (kind === 'ball') { Zx.snd.beep(900 + Math.min(v, 6) * 80, 0.03, 600, 0.12); }
        else { Zx.snd.beep(160, 0.04, 100, 0.1); }
    };
    onPocket = function () { Zx.snd.beep(300, 0.12, 80, 0.25); };

    window.GAME = {
        get mode() { return mode; }, get G() { return G; }, get balls() { return balls; }, get res() { return res; },
        tick: tick, draw: draw, newGame: newGame, physTick: physTick, moving: moving, setupBalls: setupBalls, resolve: resolve, shoot: shoot,
        plans: plans, validPlace: validPlace, nearGap: nearGap, POCKETS: POCKETS, bounds: { L: L, R: R, T: T, B: B, BR: BR },
        setSilent: function () { onSound = null; onPocket = null; }, resetRes: function () { res = { first: null, pocketed: [], cue: false, rail: false }; },
        menuState: function (m, l) { menu = m; level = l; }
    };

    Zx.init({ title: 'Kulečník', touch: [
        { act: 'left', label: '◀' }, { act: 'right', label: '▶' }, { act: 'up', label: '▲' }, { act: 'down', label: '▼' },
        { act: 'alt', label: 'JEMNĚ' }, { act: 'fire', label: 'RÁZ', cls: 'big' }
    ] });
    Zx.run({ tick: tick, draw: draw });
})();
