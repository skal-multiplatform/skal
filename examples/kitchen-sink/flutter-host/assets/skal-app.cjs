// @bun @bytecode @bun-cjs
(function(exports, require, module, __filename, __dirname) {// flutter-host/assets/skal-app.js
(function() {
  var ue = { context: undefined, registry: undefined, effects: undefined, done: false, getContextId() {
    return jr(this.context.count);
  }, getNextContextId() {
    return jr(this.context.count++);
  } };
  function jr(t) {
    const r = String(t), n = r.length - 1;
    return ue.context.id + (n ? String.fromCharCode(96 + n) : "") + r;
  }
  function dr(t) {
    ue.context = t;
  }
  function Zn() {
    return { ...ue.context, id: ue.getNextContextId(), count: 0 };
  }
  var Qn = (t, r) => t === r, ye = Symbol("solid-proxy"), ei = typeof Proxy == "function", Mt = Symbol("solid-track"), Bt = { equals: Qn }, qr = null, Kr = rn, Ee = 1, St = 2, Xr = { owned: null, cleanups: null, context: null, owner: null }, ee = null, B = null, Et = null, nt = null, ne = null, ae = null, de = null, Wt = 0;
  function Ut(t, r) {
    const n = ne, o = ee, s = t.length === 0, u = r === undefined ? o : r, d = s ? Xr : { owned: null, cleanups: null, context: u ? u.context : null, owner: u }, b = s ? t : () => t(() => De(() => ze(d)));
    ee = d, ne = null;
    try {
      return Te(b, true);
    } finally {
      ne = n, ee = o;
    }
  }
  function X(t, r) {
    r = r ? Object.assign({}, Bt, r) : Bt;
    const n = { value: t, observers: null, observerSlots: null, comparator: r.equals || undefined }, o = (s) => (typeof s == "function" && (B && B.running && B.sources.has(n) ? s = s(n.tValue) : s = s(n.value)), en(n, s));
    return [Qr.bind(n), o];
  }
  function Ie(t, r, n) {
    const o = br(t, r, false, Ee);
    Et && B && B.running ? ae.push(o) : mt(o);
  }
  function hr(t, r, n) {
    Kr = li;
    const o = br(t, r, false, Ee), s = _r && ni(_r);
    s && (o.suspense = s), (!n || !n.render) && (o.user = true), de ? de.push(o) : mt(o);
  }
  function Vt(t, r, n) {
    n = n ? Object.assign({}, Bt, n) : Bt;
    const o = br(t, r, true, 0);
    return o.observers = null, o.observerSlots = null, o.comparator = n.equals || undefined, Et && B && B.running ? (o.tState = Ee, ae.push(o)) : mt(o), Qr.bind(o);
  }
  function Jr(t) {
    return Te(t, false);
  }
  function De(t) {
    if (!nt && ne === null)
      return t();
    const r = ne;
    ne = null;
    try {
      return nt ? nt.untrack(t) : t();
    } finally {
      ne = r;
    }
  }
  function ti(t) {
    hr(() => De(t));
  }
  function Yr(t) {
    return ee === null || (ee.cleanups === null ? ee.cleanups = [t] : ee.cleanups.push(t)), t;
  }
  function gr() {
    return ne;
  }
  function ri(t) {
    if (B && B.running)
      return t(), B.done;
    const r = ne, n = ee;
    return Promise.resolve().then(() => {
      ne = r, ee = n;
      let o;
      return (Et || _r) && (o = B || (B = { sources: new Set, effects: [], promises: new Set, disposed: new Set, queue: new Set, running: true }), o.done || (o.done = new Promise((s) => o.resolve = s)), o.running = true), Te(t, false), ne = ee = null, o ? o.done : undefined;
    });
  }
  var [dl, Zr] = X(false);
  function ni(t) {
    let r;
    return ee && ee.context && (r = ee.context[t.id]) !== undefined ? r : t.defaultValue;
  }
  var _r;
  function Qr() {
    const t = B && B.running;
    if (this.sources && (t ? this.tState : this.state))
      if ((t ? this.tState : this.state) === Ee)
        mt(this);
      else {
        const r = ae;
        ae = null, Te(() => Ht(this), false), ae = r;
      }
    if (ne) {
      const r = this.observers;
      if (!r || r[r.length - 1] !== ne) {
        const n = r ? r.length : 0;
        ne.sources ? (ne.sources.push(this), ne.sourceSlots.push(n)) : (ne.sources = [this], ne.sourceSlots = [n]), r ? (r.push(ne), this.observerSlots.push(ne.sources.length - 1)) : (this.observers = [ne], this.observerSlots = [ne.sources.length - 1]);
      }
    }
    return t && B.sources.has(this) ? this.tValue : this.value;
  }
  function en(t, r, n) {
    let o = B && B.running && B.sources.has(t) ? t.tValue : t.value;
    if (!t.comparator || !t.comparator(o, r)) {
      if (B) {
        const s = B.running;
        (s || !n && B.sources.has(t)) && (B.sources.add(t), t.tValue = r), s || (t.value = r);
      } else
        t.value = r;
      t.observers && t.observers.length && Te(() => {
        for (let s = 0;s < t.observers.length; s += 1) {
          const u = t.observers[s], d = B && B.running;
          d && B.disposed.has(u) || ((d ? !u.tState : !u.state) && (u.pure ? ae.push(u) : de.push(u), u.observers && nn(u)), d ? u.tState = Ee : u.state = Ee);
        }
        if (ae.length > 1e6)
          throw ae = [], new Error;
      }, false);
    }
    return r;
  }
  function mt(t) {
    if (!t.fn)
      return;
    ze(t);
    const r = Wt;
    tn(t, B && B.running && B.sources.has(t) ? t.tValue : t.value, r), B && !B.running && B.sources.has(t) && queueMicrotask(() => {
      Te(() => {
        B && (B.running = true), ne = ee = t, tn(t, t.tValue, r), ne = ee = null;
      }, false);
    });
  }
  function tn(t, r, n) {
    let o;
    const s = ee, u = ne;
    ne = ee = t;
    try {
      o = t.fn(r);
    } catch (d) {
      return t.pure && (B && B.running ? (t.tState = Ee, t.tOwned && t.tOwned.forEach(ze), t.tOwned = undefined) : (t.state = Ee, t.owned && t.owned.forEach(ze), t.owned = null)), t.updatedAt = n + 1, pr(d);
    } finally {
      ne = u, ee = s;
    }
    (!t.updatedAt || t.updatedAt <= n) && (t.updatedAt != null && ("observers" in t) ? en(t, o, true) : B && B.running && t.pure ? (B.sources.has(t) || (t.value = o), B.sources.add(t), t.tValue = o) : t.value = o, t.updatedAt = n);
  }
  function br(t, r, n, o = Ee, s) {
    const u = { fn: t, state: o, updatedAt: null, owned: null, sources: null, sourceSlots: null, cleanups: null, value: r, owner: ee, context: ee ? ee.context : null, pure: n };
    if (B && B.running && (u.state = 0, u.tState = o), ee === null || ee !== Xr && (B && B.running && ee.pure ? ee.tOwned ? ee.tOwned.push(u) : ee.tOwned = [u] : ee.owned ? ee.owned.push(u) : ee.owned = [u]), nt && u.fn) {
      const d = u.fn, [b, h] = X(undefined, { equals: false }), F = nt.factory(d, h);
      Yr(() => F.dispose());
      let R;
      const T = () => ri(h).then(() => {
        R && (R.dispose(), R = undefined);
      });
      u.fn = (D) => (b(), B && B.running ? (R || (R = nt.factory(d, T)), R.track(D)) : F.track(D));
    }
    return u;
  }
  function wt(t) {
    const r = B && B.running;
    if ((r ? t.tState : t.state) === 0)
      return;
    if ((r ? t.tState : t.state) === St)
      return Ht(t);
    if (t.suspense && De(t.suspense.inFallback))
      return t.suspense.effects.push(t);
    const n = [t];
    for (;(t = t.owner) && (!t.updatedAt || t.updatedAt < Wt); ) {
      if (r && B.disposed.has(t))
        return;
      (r ? t.tState : t.state) && n.push(t);
    }
    for (let o = n.length - 1;o >= 0; o--) {
      if (t = n[o], r) {
        let s = t, u = n[o + 1];
        for (;(s = s.owner) && s !== u; )
          if (B.disposed.has(s))
            return;
      }
      if ((r ? t.tState : t.state) === Ee)
        mt(t);
      else if ((r ? t.tState : t.state) === St) {
        const s = ae;
        ae = null, Te(() => Ht(t, n[0]), false), ae = s;
      }
    }
  }
  function Te(t, r) {
    if (ae)
      return t();
    let n = false;
    r || (ae = []), de ? n = true : de = [], Wt++;
    try {
      const o = t();
      return ii(n), o;
    } catch (o) {
      n || (de = null), ae = null, pr(o);
    }
  }
  function ii(t) {
    if (ae && (Et && B && B.running ? oi(ae) : rn(ae), ae = null), t)
      return;
    let r;
    if (B) {
      if (!B.promises.size && !B.queue.size) {
        const { sources: o, disposed: s } = B;
        de.push.apply(de, B.effects), r = B.resolve;
        for (const u of de)
          "tState" in u && (u.state = u.tState), delete u.tState;
        B = null, Te(() => {
          for (const u of s)
            ze(u);
          for (const u of o) {
            if (u.value = u.tValue, u.owned)
              for (let d = 0, b = u.owned.length;d < b; d++)
                ze(u.owned[d]);
            u.tOwned && (u.owned = u.tOwned), delete u.tValue, delete u.tOwned, u.tState = 0;
          }
          Zr(false);
        }, false);
      } else if (B.running) {
        B.running = false, B.effects.push.apply(B.effects, de), de = null, Zr(true);
        return;
      }
    }
    const n = de;
    de = null, n.length && Te(() => Kr(n), false), r && r();
  }
  function rn(t) {
    for (let r = 0;r < t.length; r++)
      wt(t[r]);
  }
  function oi(t) {
    for (let r = 0;r < t.length; r++) {
      const n = t[r], o = B.queue;
      o.has(n) || (o.add(n), Et(() => {
        o.delete(n), Te(() => {
          B.running = true, wt(n);
        }, false), B && (B.running = false);
      }));
    }
  }
  function li(t) {
    let r, n = 0;
    for (r = 0;r < t.length; r++) {
      const o = t[r];
      o.user ? t[n++] = o : wt(o);
    }
    if (ue.context) {
      if (ue.count) {
        ue.effects || (ue.effects = []), ue.effects.push(...t.slice(0, n));
        return;
      }
      dr();
    }
    for (ue.effects && (ue.done || !ue.count) && (t = [...ue.effects, ...t], n += ue.effects.length, delete ue.effects), r = 0;r < n; r++)
      wt(t[r]);
  }
  function Ht(t, r) {
    const n = B && B.running;
    n ? t.tState = 0 : t.state = 0;
    for (let o = 0;o < t.sources.length; o += 1) {
      const s = t.sources[o];
      if (s.sources) {
        const u = n ? s.tState : s.state;
        u === Ee ? s !== r && (!s.updatedAt || s.updatedAt < Wt) && wt(s) : u === St && Ht(s, r);
      }
    }
  }
  function nn(t) {
    const r = B && B.running;
    for (let n = 0;n < t.observers.length; n += 1) {
      const o = t.observers[n];
      (r ? !o.tState : !o.state) && (r ? o.tState = St : o.state = St, o.pure ? ae.push(o) : de.push(o), o.observers && nn(o));
    }
  }
  function ze(t) {
    let r;
    if (t.sources)
      for (;t.sources.length; ) {
        const n = t.sources.pop(), o = t.sourceSlots.pop(), s = n.observers;
        if (s && s.length) {
          const u = s.pop(), d = n.observerSlots.pop();
          o < s.length && (u.sourceSlots[d] = o, s[o] = u, n.observerSlots[o] = d);
        }
      }
    if (t.tOwned) {
      for (r = t.tOwned.length - 1;r >= 0; r--)
        ze(t.tOwned[r]);
      delete t.tOwned;
    }
    if (B && B.running && t.pure)
      on(t, true);
    else if (t.owned) {
      for (r = t.owned.length - 1;r >= 0; r--)
        ze(t.owned[r]);
      t.owned = null;
    }
    if (t.cleanups) {
      for (r = t.cleanups.length - 1;r >= 0; r--)
        t.cleanups[r]();
      t.cleanups = null;
    }
    B && B.running ? t.tState = 0 : t.state = 0;
  }
  function on(t, r) {
    if (r || (t.tState = 0, B.disposed.add(t)), t.owned)
      for (let n = 0;n < t.owned.length; n++)
        on(t.owned[n]);
  }
  function si(t) {
    return t instanceof Error ? t : new Error(typeof t == "string" ? t : "Unknown error", { cause: t });
  }
  function ln(t, r, n) {
    try {
      for (const o of r)
        o(t);
    } catch (o) {
      pr(o, n && n.owner || null);
    }
  }
  function pr(t, r = ee) {
    const n = qr && r && r.context && r.context[qr], o = si(t);
    if (!n)
      throw o;
    de ? de.push({ fn() {
      ln(o, n, r);
    }, state: Ee }) : ln(o, n, r);
  }
  var ai = Symbol("fallback");
  function sn(t) {
    for (let r = 0;r < t.length; r++)
      t[r]();
  }
  function ci(t, r, n = {}) {
    let o = [], s = [], u = [], d = 0, b = r.length > 1 ? [] : null;
    return Yr(() => sn(u)), () => {
      let h = t() || [], F = h.length, R, T;
      return h[Mt], De(() => {
        let m, x, S, z, j, P, $, f, E;
        if (F === 0)
          d !== 0 && (sn(u), u = [], o = [], s = [], d = 0, b && (b = [])), n.fallback && (o = [ai], s[0] = Ut((w) => (u[0] = w, n.fallback())), d = 1);
        else if (d === 0) {
          for (s = new Array(F), T = 0;T < F; T++)
            o[T] = h[T], s[T] = Ut(D);
          d = F;
        } else {
          for (S = new Array(F), z = new Array(F), b && (j = new Array(F)), P = 0, $ = Math.min(d, F);P < $ && o[P] === h[P]; P++)
            ;
          for ($ = d - 1, f = F - 1;$ >= P && f >= P && o[$] === h[f]; $--, f--)
            S[f] = s[$], z[f] = u[$], b && (j[f] = b[$]);
          for (m = new Map, x = new Array(f + 1), T = f;T >= P; T--)
            E = h[T], R = m.get(E), x[T] = R === undefined ? -1 : R, m.set(E, T);
          for (R = P;R <= $; R++)
            E = o[R], T = m.get(E), T !== undefined && T !== -1 ? (S[T] = s[R], z[T] = u[R], b && (j[T] = b[R]), T = x[T], m.set(E, T)) : u[R]();
          for (T = P;T < F; T++)
            T in S ? (s[T] = S[T], u[T] = z[T], b && (b[T] = j[T], b[T](T))) : s[T] = Ut(D);
          s = s.slice(0, d = F), o = h.slice(0);
        }
        return s;
      });
      function D(m) {
        if (u[T] = m, b) {
          const [x, S] = X(T);
          return b[T] = S, r(h[T], x);
        }
        return r(h[T]);
      }
    };
  }
  var ui = false;
  function fi(t, r) {
    if (ui && ue.context) {
      const n = ue.context;
      dr(Zn());
      const o = De(() => t(r || {}));
      return dr(n), o;
    }
    return De(() => t(r || {}));
  }
  function Gt() {
    return true;
  }
  var di = { get(t, r, n) {
    return r === ye ? n : t.get(r);
  }, has(t, r) {
    return r === ye ? true : t.has(r);
  }, set: Gt, deleteProperty: Gt, getOwnPropertyDescriptor(t, r) {
    return { configurable: true, enumerable: true, get() {
      return t.get(r);
    }, set: Gt, deleteProperty: Gt };
  }, ownKeys(t) {
    return t.keys();
  } };
  function Fr(t) {
    return (t = typeof t == "function" ? t() : t) ? t : {};
  }
  function hi() {
    for (let t = 0, r = this.length;t < r; ++t) {
      const n = this[t]();
      if (n !== undefined)
        return n;
    }
  }
  function an(...t) {
    let r = false;
    for (let d = 0;d < t.length; d++) {
      const b = t[d];
      r = r || !!b && ye in b, t[d] = typeof b == "function" ? (r = true, Vt(b)) : b;
    }
    if (ei && r)
      return new Proxy({ get(d) {
        for (let b = t.length - 1;b >= 0; b--) {
          const h = Fr(t[b])[d];
          if (h !== undefined)
            return h;
        }
      }, has(d) {
        for (let b = t.length - 1;b >= 0; b--)
          if (d in Fr(t[b]))
            return true;
        return false;
      }, keys() {
        const d = [];
        for (let b = 0;b < t.length; b++)
          d.push(...Object.keys(Fr(t[b])));
        return [...new Set(d)];
      } }, di);
    const n = {}, o = Object.create(null);
    for (let d = t.length - 1;d >= 0; d--) {
      const b = t[d];
      if (!b)
        continue;
      const h = Object.getOwnPropertyNames(b);
      for (let F = h.length - 1;F >= 0; F--) {
        const R = h[F];
        if (R === "__proto__" || R === "constructor")
          continue;
        const T = Object.getOwnPropertyDescriptor(b, R);
        if (!o[R])
          o[R] = T.get ? { enumerable: true, configurable: true, get: hi.bind(n[R] = [T.get.bind(b)]) } : T.value !== undefined ? T : undefined;
        else {
          const D = n[R];
          D && (T.get ? D.push(T.get.bind(b)) : T.value !== undefined && D.push(() => T.value));
        }
      }
    }
    const s = {}, u = Object.keys(o);
    for (let d = u.length - 1;d >= 0; d--) {
      const b = u[d], h = o[b];
      h && h.get ? Object.defineProperty(s, b, h) : s[b] = h ? h.value : undefined;
    }
    return s;
  }
  function oe(t) {
    const r = "fallback" in t && { fallback: () => t.fallback };
    return Vt(ci(() => t.each, t.children, r || undefined));
  }
  var gi = (t) => Vt(() => t());
  function _i({ createElement: t, createTextNode: r, isTextNode: n, replaceText: o, insertNode: s, removeNode: u, setProperty: d, getParentNode: b, getFirstChild: h, getNextSibling: F }) {
    function R(P, $, f, E) {
      if (f !== undefined && !E && (E = []), typeof $ != "function")
        return T(P, $, E, f);
      Ie((w) => T(P, $(), w, f), E);
    }
    function T(P, $, f, E, w) {
      for (;typeof f == "function"; )
        f = f();
      if ($ === f)
        return f;
      const I = typeof $, N = E !== undefined;
      if (I === "string" || I === "number")
        if (I === "number" && ($ = $.toString()), N) {
          let H = f[0];
          H && n(H) ? o(H, $) : H = r($), f = x(P, f, E, H);
        } else
          f !== "" && typeof f == "string" ? o(h(P), f = $) : (x(P, f, E, r($)), f = $);
      else if ($ == null || I === "boolean")
        f = x(P, f, E);
      else {
        if (I === "function")
          return Ie(() => {
            let H = $();
            for (;typeof H == "function"; )
              H = H();
            f = T(P, H, f, E);
          }), () => f;
        if (Array.isArray($)) {
          const H = [];
          if (D(H, $, w))
            return Ie(() => f = T(P, H, f, E, true)), () => f;
          if (H.length === 0) {
            const se = x(P, f, E);
            if (N)
              return f = se;
          } else
            Array.isArray(f) ? f.length === 0 ? S(P, H, E) : m(P, f, H) : f == null || f === "" ? S(P, H) : m(P, N && f || [h(P)], H);
          f = H;
        } else {
          if (Array.isArray(f)) {
            if (N)
              return f = x(P, f, E, $);
            x(P, f, null, $);
          } else
            f == null || f === "" || !h(P) ? s(P, $) : z(P, $, h(P));
          f = $;
        }
      }
      return f;
    }
    function D(P, $, f) {
      let E = false;
      for (let w = 0, I = $.length;w < I; w++) {
        let N = $[w], H;
        if (!(N == null || N === true || N === false))
          if (Array.isArray(N))
            E = D(P, N) || E;
          else if ((H = typeof N) == "string" || H === "number")
            P.push(r(N));
          else if (H === "function")
            if (f) {
              for (;typeof N == "function"; )
                N = N();
              E = D(P, Array.isArray(N) ? N : [N]) || E;
            } else
              P.push(N), E = true;
          else
            P.push(N);
      }
      return E;
    }
    function m(P, $, f) {
      let E = f.length, w = $.length, I = E, N = 0, H = 0, se = F($[w - 1]), re = null;
      for (;N < w || H < I; ) {
        if ($[N] === f[H]) {
          N++, H++;
          continue;
        }
        for (;$[w - 1] === f[I - 1]; )
          w--, I--;
        if (w === N) {
          const be = I < E ? H ? F(f[H - 1]) : f[I - H] : se;
          for (;H < I; )
            s(P, f[H++], be);
        } else if (I === H)
          for (;N < w; )
            (!re || !re.has($[N])) && u(P, $[N]), N++;
        else if ($[N] === f[I - 1] && f[H] === $[w - 1]) {
          const be = F($[--w]);
          s(P, f[H++], F($[N++])), s(P, f[--I], be), $[w] = f[I];
        } else {
          if (!re) {
            re = new Map;
            let ie = H;
            for (;ie < I; )
              re.set(f[ie], ie++);
          }
          const be = re.get($[N]);
          if (be != null)
            if (H < be && be < I) {
              let ie = N, pe = 1, Ze;
              for (;++ie < w && ie < I && !((Ze = re.get($[ie])) == null || Ze !== be + pe); )
                pe++;
              if (pe > be - H) {
                const bt = $[N];
                for (;H < be; )
                  s(P, f[H++], bt);
              } else
                z(P, f[H++], $[N++]);
            } else
              N++;
          else
            u(P, $[N++]);
        }
      }
    }
    function x(P, $, f, E) {
      if (f === undefined) {
        let I;
        for (;I = h(P); )
          u(P, I);
        return E && s(P, E), "";
      }
      const w = E || r("");
      if ($.length) {
        let I = false;
        for (let N = $.length - 1;N >= 0; N--) {
          const H = $[N];
          if (w !== H) {
            const se = b(H) === P;
            !I && !N ? se ? z(P, w, H) : s(P, w, f) : se && u(P, H);
          } else
            I = true;
        }
      } else
        s(P, w, f);
      return [w];
    }
    function S(P, $, f) {
      for (let E = 0, w = $.length;E < w; E++)
        s(P, $[E], f);
    }
    function z(P, $, f) {
      s(P, $, f), u(P, f);
    }
    function j(P, $, f = {}, E) {
      return $ || ($ = {}), E || Ie(() => f.children = T(P, $.children, f.children)), Ie(() => $.ref && $.ref(P)), Ie(() => {
        for (const w in $) {
          if (w === "children" || w === "ref")
            continue;
          const I = $[w];
          I !== f[w] && (d(P, w, I, f[w]), f[w] = I);
        }
      }), f;
    }
    return { render(P, $) {
      let f;
      return Ut((E) => {
        f = E, R($, P());
      }), f;
    }, insert: R, spread(P, $, f) {
      typeof $ == "function" ? Ie((E) => j(P, $(), E, f)) : j(P, $, undefined, f);
    }, createElement: t, createTextNode: r, insertNode: s, setProp(P, $, f, E) {
      return d(P, $, f, E), f;
    }, mergeProps: an, effect: Ie, memo: gi, createComponent: fi, use(P, $, f) {
      return De(() => P($, f));
    } };
  }
  function bi(t) {
    const r = _i(t);
    return r.mergeProps = an, r;
  }
  var pi = 6 * 1024 * 1024, jt = 4194368, Fi = 768 * 1024, cn = 4980800, un = 4980800, vi = 2, Si = 3, Ei = 6, fn = 7, mi = 10, wi = 0, yi = 2, xi = 4, hl = 1, gl = 2, _l = 3, bl = 4, pl = 16, Fl = 17, vl = 20, Sl = 21, El = 22, ml = 23, wl = 24, yl = 25, xl = 26, Pl = 27, Tl = 28, Al = 29, Rl = 30, $l = 31, Cl = 32, Ol = 33, kl = 34, Il = 35, Dl = 36, zl = 37, Nl = 38, Ll = 39, Ml = 0, Bl = 1, Wl = 2, Ul = 3, Vl = 4, Hl = 5, Gl = 6, jl = 7, ql = 9, Kl = 10, Xl = 11, Jl = 12, Yl = 13, Zl = 14, Ql = 15, es = 16, ts = 17, rs = 18, ns = 19, is = 20, os = 21, ls = 22, ss = 23, as = 24, cs = 25, us = 26, fs = 27, ds = 28, hs = 29, gs = 30, _s = 31, bs = 32, ps = 33, Fs = 34, vs = 35, Ss = 36, Es = 37, ms = 38, ws = 39, ys = 40, xs = 41, Ps = 42, Ts = 43, As = 44, Rs = 45, $s = 46, Cs = 47, Os = 48, ks = 1, Is = 2, Ds = 3, zs = 4, Ns = 5, Ls = 6, Ms = 7, Bs = 8, Ws = 9, Us = 10, Vs = 11, Hs = 12, Gs = 13, js = 14, qs = 15, Ks = 16, Xs = 17, Js = 18, Ys = 19, Zs = 20, Qs = 21, ea = 22, ta = 23, ra = 0, na = 1, ia = 2, oa = 3, la = 4, sa = 5, aa = 6, ca = 7, ua = 0, fa = 1, da = 2, ha = 3, ga = 4, _a = 5, ba = 6, pa = 7, Fa = 8, va = 9, Sa = 10, Ea = 11, ma = 12, wa = 13, ya = 14, xa = 15, Pa = 16, Ta = 32, Aa = 33, Ra = 34, $a = 35, Ca = 36, Oa = 37, ka = 64, Ia = 65, Da = 66, za = 67, Na = 68, La = 69, Ma = 70, Ba = 71, Wa = 72, Ua = 73, Va = 74, Ha = 75, Ga = 96, ja = 97, qa = 98, Ka = 99, Xa = 128, Ja = 129, Ya = 130, Za = 131, Qa = 132, ec = 133, tc = 134, rc = 135, nc = 136, ic = 137, oc = 160, lc = 161, sc = 162, ac = 163, cc = 164, uc = 165, fc = 166, dc = 167, hc = 168, gc = 169, _c = 170, bc = 171, pc = 172, Fc = 173, vc = 174, Sc = 175, Ec = 176, mc = 177, wc = 178, yc = 179, xc = 180, Pc = 181, Tc = 182, Ac = -1, Pi = 2147483646, Ti = 2147483645, Ue = globalThis.__skal_acquireBridge();
  if (!Ue || Ue.byteLength !== pi)
    throw new Error(`Skal: bridge buffer not available (got ${Ue && Ue.byteLength})`);
  var dn = new Uint8Array(Ue), _e = new Uint32Array(Ue), vr = new BigInt64Array(Ue), Ai = new TextEncoder, yt = 16, Ri = 1048592, $i = 16384, Ci = Ri - 4, qt = 0n, Ne = yt, it = jt, Kt = yt;
  function Sr() {
    _e[vi] = Ne - yt << 2, _e[Si] = it - jt, qt += 1n, Atomics.store(vr, wi, qt), Kt = Ne;
  }
  function hn() {
    Sr();
    const t = qt, r = performance.now() + 5000;
    for (;!(Atomics.load(vr, xi) >= t); )
      if (performance.now() > r) {
        console.warn("Skal: drain spin timeout \u2014 UI thread slow; ring will overwrite");
        break;
      }
    Ne = yt, it = jt, Kt = yt;
  }
  function te(t, r, n, o) {
    let s = Ne;
    s >= Ci && (hn(), s = Ne), _e[s] = t >>> 0, _e[s + 1] = r >>> 0, _e[s + 2] = n >>> 0, _e[s + 3] = o >>> 0, Ne = s + 4, Ne - Kt >= $i && Sr();
  }
  var Ve = 0, He = 0;
  function ot(t) {
    it + t.length * 3 > un && hn();
    const r = it - jt, n = dn.subarray(it, un), { read: o, written: s } = Ai.encodeInto(t, n);
    if (o !== t.length)
      throw new Error(`Skal: string too large for heap (${t.length} code units > ${Fi} bytes)`);
    it += s, Ve = r, He = s;
  }
  function Xt(t, r) {
    ot(r), te(20, t, Ve, He);
  }
  var Er = false;
  function Oi() {
    Er = false, Ne !== Kt && Sr();
  }
  function Y() {
    Er || (Er = true, queueMicrotask(Oi));
  }
  var Ae = 1024, U = new Int8Array(256);
  U.fill(-1), U[0] = 0, U[1] = 1, U[2] = 2, U[3] = 3, U[4] = 4, U[5] = 5, U[6] = 6, U[7] = 7, U[8] = 8, U[9] = 9, U[32] = 10, U[33] = 11, U[34] = 12, U[35] = 13, U[36] = 14, U[37] = 15, U[64] = 16, U[65] = 17, U[66] = 18, U[67] = 19, U[68] = 20, U[69] = 21, U[70] = 22, U[96] = 23, U[97] = 24, U[128] = 25, U[129] = 26, U[130] = 27, U[131] = 28, U[160] = 29, U[161] = 30, U[162] = 31, U[10] = 32, U[11] = 33, U[12] = 34, U[13] = 35, U[14] = 36, U[15] = 37, U[16] = 38, U[132] = 39, U[133] = 40, U[134] = 41, U[135] = 42, U[136] = 43, U[163] = 44, U[164] = 45, U[165] = 46, U[166] = 47, U[71] = 48, U[98] = 49, U[137] = 50, U[72] = 51, U[167] = 52, U[168] = 53, U[169] = 54, U[170] = 55, U[171] = 56, U[172] = 57, U[173] = 58, U[174] = 59, U[73] = 60, U[99] = 61, U[175] = 62, U[74] = 63;
  var ve = 64, Jt = new Int32Array(Ae * ve), xt = new Float32Array(Ae * ve), Yt = new Array(Ae * ve), Pt = new Uint8Array(Ae * ve), lt = 6, st = new Float32Array(Ae * lt);
  st.fill(NaN);
  var Zt = new Map, gn = [], ki = 0;
  function Ii() {
    const t = Ae * 2, r = Ae * ve, n = t * ve, o = Ae * lt, s = t * lt, u = new Int32Array(n);
    u.set(Jt), Jt = u;
    const d = new Uint8Array(n);
    d.set(Pt), Pt = d;
    const b = new Float32Array(n);
    b.set(xt), b.fill(NaN, r), xt = b;
    const h = new Float32Array(s);
    h.set(st), h.fill(NaN, o), st = h, Yt.length = n, Ae = t;
  }
  function Qt(t) {
    let r = Zt.get(t);
    if (r === undefined) {
      r = gn.pop(), r === undefined && (r = ki++), r >= Ae && Ii(), Zt.set(t, r);
      const n = r * ve;
      Pt.fill(0, n, n + ve), xt.fill(NaN, n, n + ve);
      for (let o = n;o < n + ve; o++)
        Yt[o] = undefined;
    }
    return r;
  }
  var _n = new Map, bn = new Map, pn = new Map, at = new Map;
  function Di(t) {
    const r = Zt.get(t);
    if (r !== undefined) {
      Zt.delete(t), gn.push(r);
      const n = r * lt;
      st.fill(NaN, n, n + lt);
    }
    _n.delete(t), bn.delete(t), pn.delete(t), to(t);
  }
  var xe = 0, Le = 0, ct = new Float32Array(1), Tt = new Uint32Array(ct.buffer);
  function he(t, r, n) {
    const o = n | 0, s = U[r];
    if (s < 0) {
      te(16, t, r, o), xe++;
      return;
    }
    const u = Qt(t) * ve + s;
    if (Pt[u] !== 0 && Jt[u] === o) {
      Le++;
      return;
    }
    Jt[u] = o, Pt[u] = 1, te(16, t, r, o), xe++;
  }
  function Fn(t, r, n) {
    const o = U[r];
    if (o < 0) {
      ct[0] = n, te(17, t, r, Tt[0]), xe++;
      return;
    }
    const s = Qt(t) * ve + o;
    if (xt[s] === n) {
      Le++;
      return;
    }
    xt[s] = n, ct[0] = n, te(17, t, r, Tt[0]), xe++;
  }
  function zi(t, r, n) {
    const o = U[r];
    if (o < 0) {
      ot(n == null ? "" : String(n)), te(22, t, (r & 255) << 24 | Ve & 16777215, He), xe++;
      return;
    }
    const s = Qt(t) * ve + o;
    if (Yt[s] === n) {
      Le++;
      return;
    }
    Yt[s] = n, ot(n == null ? "" : String(n)), te(22, t, (r & 255) << 24 | Ve & 16777215, He), xe++;
  }
  function ut(t, r, n, o) {
    const s = Qt(t) * lt + n;
    if (st[s] === o) {
      Le++;
      return;
    }
    st[s] = o, ct[0] = o, te(r, t, 0, Tt[0]), xe++;
  }
  function Ni(t, r) {
    ut(t, 32, 0, r);
  }
  function Li(t, r) {
    ut(t, 33, 1, r);
  }
  function Mi(t, r) {
    ut(t, 34, 2, r);
  }
  function Bi(t, r) {
    ut(t, 35, 3, r);
  }
  function Wi(t, r) {
    ut(t, 36, 4, r);
  }
  function Ui(t, r) {
    ut(t, 37, 5, r);
  }
  var Vi = { material: 0, cupertino: 1, adaptive: 2 }, Hi = { light: 0, dark: 1 };
  function Gi(t, r) {
    te(38, typeof t == "string" ? Vi[t] ?? 0 : t | 0, typeof r == "string" ? Hi[r] ?? 0 : r | 0, 0), Y();
  }
  function ji(t) {
    te(39, t, 0, 0), Y();
  }
  function vn(t) {
    return je(1, "showDialog", [JSON.stringify(t || {})]);
  }
  function qi(t) {
    return je(1, "showActionSheet", [JSON.stringify(t || {})]);
  }
  function Sn(t) {
    return je(1, "showSnackbar", [JSON.stringify(typeof t == "string" ? { message: t } : t || {})]);
  }
  function Ki(t) {
    return je(1, "showDatePicker", [JSON.stringify(t || {})]);
  }
  function Xi(t) {
    return je(1, "showTimePicker", [JSON.stringify(t || {})]);
  }
  function Ji() {
    return je(1, "getDataDir", []);
  }
  var En = new Map;
  function Yi(t) {
    let r = 2166136261;
    for (let n = 0;n < t.length; n++)
      r ^= t.charCodeAt(n), r = Math.imul(r, 16777619) >>> 0;
    return r;
  }
  function Ge(t) {
    let r = En.get(t);
    return r !== undefined || (r = Yi(t), ot(t), te(23, r, Ve, He), En.set(t, r)), r;
  }
  function Zi(t, r) {
    te(4, t, Ge(r), 0);
  }
  function mr(t, r) {
    let n = t.get(r);
    return n === undefined && (n = new Map, t.set(r, n)), n;
  }
  function mn(t, r, n) {
    const o = Ge(r), s = n >>> 0, u = mr(_n, t);
    if (u.get(o) === s) {
      Le++;
      return;
    }
    u.set(o, s), te(24, t, o, s), xe++;
  }
  function wn(t, r, n) {
    const o = Ge(r), s = mr(bn, t);
    if (s.get(o) === n) {
      Le++;
      return;
    }
    s.set(o, n), ct[0] = n, te(25, t, o, Tt[0]), xe++;
  }
  function yn(t, r, n) {
    const o = Ge(r), s = n == null ? "" : String(n), u = mr(pn, t);
    if (u.get(o) === s) {
      Le++;
      return;
    }
    u.set(o, s), ot(s);
    const d = Ve & 16777215, b = He & 255;
    te(26, t, o, d << 8 | b), xe++;
  }
  function Qi(t, r, n) {
    te(27, t, Ge(r), n);
  }
  var At = new Map, Re = new Map, xn = 1;
  function Pn(t, r) {
    for (let n = 0;n < r.length; n++) {
      const o = r[n];
      if (typeof o == "number")
        Number.isInteger(o) ? te(29, t, 1, o | 0) : (ct[0] = o, te(29, t, 2, Tt[0]));
      else if (typeof o == "boolean")
        te(29, t, 3, o ? 1 : 0);
      else if (typeof o == "string") {
        ot(o);
        const s = Ve >>> 0;
        te(29, t, 4 | (He & 16777215) << 8, s);
      } else
        te(29, t, 0, 0);
    }
  }
  function je(t, r, n) {
    const o = Ge(r), s = xn++;
    return Pn(s, n), te(28, t, o, s), Y(), new Promise((u, d) => {
      At.set(s, { resolve: u, reject: d });
    });
  }
  function eo(t, r, n, o, s) {
    const u = Ge(r), d = xn++;
    Pn(d, n), te(30, t, u, d), Y(), Re.set(d, { nodeId: t, onValue: o, onError: s && s.onError, onDone: s && s.onDone });
    let b = at.get(t);
    return b === undefined && (b = new Set, at.set(t, b)), b.add(d), function() {
      if (!Re.has(d))
        return;
      Re.delete(d);
      const F = at.get(t);
      F && (F.delete(d), F.size === 0 && at.delete(t)), te(31, d, 0, 0), Y();
    };
  }
  function to(t) {
    const r = at.get(t);
    if (r !== undefined) {
      for (const n of r)
        Re.has(n) && (Re.delete(n), te(31, n, 0, 0));
      at.delete(t), Y();
    }
  }
  var wr = new Map, ro = 1;
  function yr(t) {
    const r = ro++;
    return wr.set(r, t), r;
  }
  function Tn(t, r, n) {
    te(21, t, r, n);
  }
  var xr = 0n, qe = null, Pr = 1310736, no = 1572864, io = 65532, An = new ArrayBuffer(4), Tr = new Float32Array(An), Ar = new Uint32Array(An), oo = new TextDecoder("utf-8");
  function Rr(t, r) {
    return r === 0 ? "" : oo.decode(dn.subarray(cn + t, cn + t + r));
  }
  function $r(t, r) {
    _e[mi] = t + r;
  }
  globalThis.__skal_drainEvents = function() {
    const t = Atomics.load(vr, yi);
    if (t === xr)
      return;
    const r = Pr + (_e[Ei] >> 2);
    let n = Pr + (_e[fn] >> 2);
    const o = no, s = Pr;
    let u = io;
    for (;n !== r && u-- > 0; ) {
      const d = _e[n + 0], b = d & 255, h = d >>> 8 & 255, F = _e[n + 1], R = _e[n + 2], T = _e[n + 3];
      let D, m = false;
      if (h === 1)
        D = R | 0, m = true;
      else if (h === 2)
        Ar[0] = R, D = Tr[0], m = true;
      else if (h === 3)
        D = R !== 0, m = true;
      else if (h === 4)
        D = Rr(T, R), m = true, $r(T, R);
      else if (h === 5) {
        const x = Rr(T, R);
        try {
          D = JSON.parse(x);
        } catch {
          D = x;
        }
        m = true, $r(T, R);
      } else if (h === 6) {
        const x = Rr(T, R);
        try {
          D = JSON.parse(x);
        } catch {
          D = [];
        }
        m = true, $r(T, R);
      } else if (h === 7) {
        Ar[0] = R;
        const x = Tr[0];
        Ar[0] = T, D = [x, Tr[0]], m = true;
      }
      if (b === 3) {
        const x = At.get(F);
        if (x) {
          At.delete(F);
          try {
            x.resolve(m ? D : undefined);
          } catch (S) {
            qe = S && (S.stack || S.message || String(S)) || "unknown";
          }
        }
      } else if (b === 4) {
        const x = At.get(F);
        if (x) {
          At.delete(F);
          try {
            const S = typeof D == "string" ? D : `skal RPC error (status ${D})`;
            x.reject(new Error(S));
          } catch (S) {
            qe = S && (S.stack || S.message || String(S)) || "unknown";
          }
        }
      } else if (b === 5) {
        const x = Re.get(F);
        if (x)
          try {
            x.onValue(m ? D : undefined);
          } catch (S) {
            qe = S && (S.stack || S.message || String(S)) || "unknown";
          }
      } else if (b === 6) {
        const x = Re.get(F);
        if (x) {
          Re.delete(F);
          try {
            x.onDone && x.onDone();
          } catch (S) {
            qe = S && (S.stack || S.message || String(S)) || "unknown";
          }
        }
      } else if (b === 7) {
        const x = Re.get(F);
        if (x) {
          Re.delete(F);
          try {
            x.onError && x.onError(new Error(typeof D == "string" ? D : "skal stream error"));
          } catch (S) {
            qe = S && (S.stack || S.message || String(S)) || "unknown";
          }
        }
      } else {
        const x = wr.get(F);
        if (x)
          try {
            m ? (h === 6 || h === 7) && Array.isArray(D) ? x(...D) : x(D) : x();
          } catch (S) {
            qe = S && (S.stack || S.message || String(S)) || "unknown";
          }
      }
      n += 4, n >= o && (n = s);
    }
    _e[fn] = n - s << 2, xr = t;
  }, globalThis.skalStatus = () => JSON.stringify({ handlerCount: wr.size, opSeq: Number(qt), lastEventSeq: Number(xr), lastHandlerError: qe, propWrites: xe, propSkips: Le });
  var Rc = 1, lo = 2;
  function Rn() {
    return lo++;
  }
  var so = { box: 0, column: 1, scrollView: 5, listView: 6, reorderableListView: 7, row: 2, text: 3, button: 4, image: 9, stack: 10, switch: 11, slider: 12, checkbox: 13, activityIndicator: 14, progressBar: 15, lazyGrid: 16, wrap: 17, safeArea: 18, richText: 19, textInput: 20, navigator: 21, screen: 22, tabs: 23, tab: 24, animatedList: 25, crossFade: 26, hero: 27, listTile: 28, pageView: 29, dismissible: 30, customScrollView: 31, sliverAppBar: 32, sliverList: 33, sliverGrid: 34, canvas: 35, dragItem: 36, dropZone: 37, radio: 38, chip: 39, segmentedButton: 40, expansionTile: 41, dropdown: 42, stepper: 43, step: 44, drawer: 45, bottomSheet: 46, backdropFilter: 47, interactiveViewer: 48 };
  function ao() {
    const t = [], r = { _cmds: t, fillStyle(n) {
      return t.push(["fillStyle", Cr(n)]), r;
    }, strokeStyle(n) {
      return t.push(["strokeStyle", Cr(n)]), r;
    }, lineWidth(n) {
      return t.push(["lineWidth", +n || 0]), r;
    }, fillRect(n, o, s, u) {
      return t.push(["fillRect", +n, +o, +s, +u]), r;
    }, strokeRect(n, o, s, u) {
      return t.push(["strokeRect", +n, +o, +s, +u]), r;
    }, circle(n, o, s) {
      return t.push(["circle", +n, +o, +s]), r;
    }, line(n, o, s, u) {
      return t.push(["line", +n, +o, +s, +u]), r;
    }, beginPath() {
      return t.push(["beginPath"]), r;
    }, moveTo(n, o) {
      return t.push(["moveTo", +n, +o]), r;
    }, lineTo(n, o) {
      return t.push(["lineTo", +n, +o]), r;
    }, closePath() {
      return t.push(["closePath"]), r;
    }, fill() {
      return t.push(["fill"]), r;
    }, stroke() {
      return t.push(["stroke"]), r;
    }, fontSize(n) {
      return t.push(["fontSize", +n || 14]), r;
    }, fillText(n, o, s) {
      return t.push(["fillText", String(n), +o, +s]), r;
    } };
    return r;
  }
  var co = { padding: [0, "u32"], paddingTop: [1, "u32"], paddingRight: [2, "u32"], paddingBottom: [3, "u32"], paddingLeft: [4, "u32"], width: [5, "dim"], height: [6, "dim"], weight: [7, "f32"], alignment: [8, "u32"], gap: [9, "u32"], axis: [10, "u32"], top: [11, "u32"], right: [12, "u32"], bottom: [13, "u32"], left: [14, "u32"], crossAxisCount: [15, "u32"], aspectRatio: [16, "f32"], background: [32, "color"], color: [33, "color"], cornerRadius: [34, "u32"], borderWidth: [35, "u32"], borderColor: [36, "color"], shadow: [37, "u32"], fontSize: [64, "u32"], fontWeight: [65, "u32"], fontFamily: [66, "u32"], textAlign: [67, "u32"], lineHeight: [68, "u32"], maxLines: [69, "u32"], textOverflow: [70, "u32"], src: [96, "str"], contentScale: [97, "u32"], placeholder: [128, "str"], value: [129, "str"], keyboardType: [130, "u32"], secureEntry: [131, "u32"], checked: [132, "u32"], min: [134, "f32"], max: [135, "f32"], progress: [136, "f32"], initialSize: [176, "f32"], minSize: [177, "f32"], maxSize: [178, "f32"], presentation: [166, "u32"], title: [71, "str"], icon: [98, "str"], leadingIcon: [98, "str"], subtitle: [73, "str"], trailingIcon: [99, "str"], activeTab: [137, "u32"], tag: [72, "str"], transition: [171, "u32"], enabled: [160, "u32"], focusable: [161, "u32"], visible: [162, "u32"], draggable: [172, "u32"], spring: [173, "u32"], release: [174, "u32"], sliverMode: [175, "u32"], dragData: [74, "str"], scrollbar: [179, "u32"], blurRadius: [180, "u32"], minScale: [181, "f32"], maxScale: [182, "f32"], semanticLabel: [75, "str"] }, uo = { opacity: Ni, translationX: Li, translationY: Mi, scaleX: Bi, scaleY: Wi, rotation: Ui }, fo = { onClick: 1, onclick: 1, onTap: 1, onLongPress: 8, onDoubleTap: 9, onChange: 2, onSubmit: 10, onReorder: 11, onPop: 12, onDismiss: 20, onPanStart: 13, onPanUpdate: 14, onPanEnd: 15, onScaleStart: 16, onScaleUpdate: 17, onScaleEnd: 18, onDrop: 21, onHover: 22, onKey: 23 }, ho = { linear: 0, easeIn: 1, easeOut: 2, easeInOut: 3, bounce: 4, elastic: 5, fastOutSlowIn: 6 }, go = { gentle: 1, bouncy: 2, stiff: 3 };
  function Cr(t) {
    if (typeof t == "number")
      return t | 0;
    if (typeof t != "string")
      return 0;
    let r = t.trim();
    r.startsWith("#") && (r = r.slice(1));
    let n = 0, o = 0, s = 0, u = 255;
    return r.length === 3 ? (n = parseInt(r[0] + r[0], 16), o = parseInt(r[1] + r[1], 16), s = parseInt(r[2] + r[2], 16)) : r.length === 4 ? (n = parseInt(r[0] + r[0], 16), o = parseInt(r[1] + r[1], 16), s = parseInt(r[2] + r[2], 16), u = parseInt(r[3] + r[3], 16)) : r.length === 6 ? (n = parseInt(r.slice(0, 2), 16), o = parseInt(r.slice(2, 4), 16), s = parseInt(r.slice(4, 6), 16)) : r.length === 8 && (u = parseInt(r.slice(0, 2), 16), n = parseInt(r.slice(2, 4), 16), o = parseInt(r.slice(4, 6), 16), s = parseInt(r.slice(6, 8), 16)), (u & 255) << 24 | (n & 255) << 16 | (o & 255) << 8 | s & 255 | 0;
  }
  function _o(t) {
    return typeof t == "number" ? t | 0 : t === "fill" ? Pi : t === "wrap" ? Ti : -1;
  }
  function bo(t) {
    if (Array.isArray(t))
      return true;
    const r = Object.getPrototypeOf(t);
    return r === Object.prototype || r === null;
  }
  function po(t, r, n) {
    if (n == null)
      return;
    if (r === "ref" && n && typeof n.__skalBind == "function") {
      n.__skalBind(t.id);
      return;
    }
    const o = typeof n;
    if (o === "object" && bo(n)) {
      yn(t.id, r, JSON.stringify(n)), Y();
      return;
    }
    if (o === "function") {
      const s = yr(n);
      Qi(t.id, r, s), Y();
      return;
    }
    if (o === "number") {
      Number.isInteger(n) && n >= 0 && n <= 4294967295 && mn(t.id, r, n | 0), wn(t.id, r, n), Y();
      return;
    }
    if (o === "string") {
      yn(t.id, r, n), Y();
      return;
    }
    if (o === "boolean") {
      mn(t.id, r, n ? 1 : 0), Y();
      return;
    }
  }
  function Fo(t) {
    const r = [t];
    for (;r.length > 0; ) {
      const n = r.pop();
      Di(n.id);
      let o = n.firstChild;
      for (;o; )
        r.push(o), o = o.nextSibling;
    }
  }
  var er = class {
    constructor(t, r, n = false, o = false) {
      this.tag = t, this.id = r, this.isText = n, this.isCustom = o, this.parent = null, this.firstChild = null, this.lastChild = null, this.nextSibling = null, this.prevSibling = null, this.text = "";
    }
  }, vo = bi({ createElement(t) {
    const r = Rn(), n = so[t];
    return n !== undefined ? (te(1, r, n, 0), Y(), new er(t, r, false, false)) : (Zi(r, t), Y(), new er(t, r, false, true));
  }, createTextNode(t) {
    const r = Rn();
    te(1, r, 3, 0);
    const n = t == null ? "" : String(t);
    n.length > 0 && Xt(r, n), Y();
    const o = new er("#text", r, true);
    return o.text = n, o;
  }, replaceText(t, r) {
    const n = r == null ? "" : String(r);
    t.text !== n && (t.text = n, Xt(t.id, n), Y());
  }, setProperty(t, r, n, o) {
    if (t.isCustom) {
      po(t, r, n);
      return;
    }
    if (r === "onRefresh") {
      if (typeof n == "function") {
        const b = t.id, h = n, R = yr(async () => {
          try {
            await h();
          } finally {
            ji(b);
          }
        });
        Tn(t.id, 19, R), Y();
      }
      return;
    }
    if (r === "draw" && typeof n == "function") {
      const b = n, h = t;
      hr(() => {
        const F = ao();
        try {
          b(F);
        } catch {}
        const R = JSON.stringify(F._cmds);
        R !== h._skalCanvasProgram && (h._skalCanvasProgram = R, Xt(h.id, R), Y());
      });
      return;
    }
    const s = fo[r];
    if (s !== undefined) {
      if (typeof n == "function") {
        const b = yr(n);
        Tn(t.id, s, b), Y();
      }
      return;
    }
    if (r === "value" && t.tag === "slider") {
      Fn(t.id, 133, Number(n) || 0), Y();
      return;
    }
    if (r === "draggable" && typeof n == "string") {
      he(t.id, 172, { free: 1, both: 1, horizontal: 2, x: 2, vertical: 3, y: 3 }[n] ?? 0), Y();
      return;
    }
    if (r === "spring" && typeof n == "string") {
      he(t.id, 173, { gentle: 1, bouncy: 2, stiff: 3, wobbly: 2 }[n] ?? 0), Y();
      return;
    }
    if (r === "release" && typeof n == "string") {
      he(t.id, 174, { none: 0, glide: 1, friction: 1, springback: 2, spring: 2 }[n.toLowerCase()] ?? 0), Y();
      return;
    }
    if (r === "sliverMode" && typeof n == "string") {
      he(t.id, 175, { normal: 0, pinned: 1, floating: 2, both: 3 }[n.toLowerCase()] ?? 0), Y();
      return;
    }
    if (r === "animate" && n && typeof n == "object") {
      if (he(t.id, 163, n.duration | 0), n.curve != null) {
        const b = typeof n.curve == "string" ? ho[n.curve] ?? 0 : n.curve | 0;
        he(t.id, 164, b);
      }
      if (n.delay != null && he(t.id, 165, n.delay | 0), n.repeat != null && he(t.id, 167, n.repeat ? 1 : 0), n.reverse != null && he(t.id, 168, n.reverse ? 1 : 0), n.loop != null && he(t.id, 169, n.loop | 0), n.spring != null) {
        const b = typeof n.spring == "string" ? go[n.spring] ?? 0 : n.spring ? 2 : 0;
        he(t.id, 170, b);
      }
      Y();
      return;
    }
    if (r === "label" && (t.tag === "button" || t.tag === "text" || t.tag === "chip")) {
      const b = n == null ? "" : String(n);
      Xt(t.id, b), Y();
      return;
    }
    const u = uo[r];
    if (u !== undefined) {
      typeof n == "number" && (u(t.id, n), Y());
      return;
    }
    const d = co[r];
    if (d !== undefined) {
      const [b, h] = d;
      if (n == null)
        return;
      switch (h) {
        case "u32":
          typeof n == "number" ? (he(t.id, b, n | 0), Y()) : typeof n == "boolean" && (he(t.id, b, n ? 1 : 0), Y());
          return;
        case "f32":
          typeof n == "number" && (Fn(t.id, b, n), Y());
          return;
        case "str":
          zi(t.id, b, String(n)), Y();
          return;
        case "color":
          he(t.id, b, Cr(n)), Y();
          return;
        case "dim":
          he(t.id, b, _o(n)), Y();
          return;
      }
      return;
    }
    if (r === "style" && n && typeof n == "object") {
      for (const b in n)
        this.setProperty(t, b, n[b]);
      return;
    }
  }, insertNode(t, r, n) {
    if (r === n)
      return;
    if (r.parent) {
      const s = r.parent;
      r.prevSibling ? r.prevSibling.nextSibling = r.nextSibling : s.firstChild === r && (s.firstChild = r.nextSibling), r.nextSibling ? r.nextSibling.prevSibling = r.prevSibling : s.lastChild === r && (s.lastChild = r.prevSibling), r.prevSibling = null, r.nextSibling = null;
    }
    const o = n ? n.id : 0;
    te(3, t.id, r.id, o), Y(), r.parent = t, n ? (r.nextSibling = n, r.prevSibling = n.prevSibling, n.prevSibling ? n.prevSibling.nextSibling = r : t.firstChild = r, n.prevSibling = r) : (r.prevSibling = t.lastChild, r.nextSibling = null, t.lastChild ? t.lastChild.nextSibling = r : t.firstChild = r, t.lastChild = r);
  }, removeNode(t, r) {
    te(2, r.id, 0, 0), Fo(r), Y(), r.prevSibling ? r.prevSibling.nextSibling = r.nextSibling : t.firstChild = r.nextSibling, r.nextSibling ? r.nextSibling.prevSibling = r.prevSibling : t.lastChild = r.prevSibling, r.parent = null, r.prevSibling = null, r.nextSibling = null;
  }, isTextNode(t) {
    return t.isText;
  }, getParentNode(t) {
    return t.parent;
  }, getFirstChild(t) {
    return t.firstChild;
  }, getNextSibling(t) {
    return t.nextSibling;
  } }), { render: So, effect: G, memo: Or, createComponent: L, createElement: l, createTextNode: $c, insertNode: _, insert: M, spread: Cc, setProp: e, mergeProps: Oc, use: Eo } = vo;
  te(1, 1, 0, 0), Y();
  var mo = new er("box", 1, false);
  function wo() {
    let t = 0;
    const r = function() {};
    return r.__skalBind = (n) => {
      t = n;
    }, new Proxy(r, { apply(n, o, s) {
      const u = s[0];
      u && typeof u.id == "number" && (t = u.id);
    }, get(n, o) {
      if (o === "__skalBind" || typeof o == "symbol")
        return r[o];
      if (typeof o == "string" && o.endsWith("$") && o.length > 1) {
        const s = o.slice(0, -1);
        return (...u) => {
          if (t === 0)
            throw new Error(`skal ref: cannot call .${String(o)}() before the host mounts. Move the call into a JSX event handler.`);
          const d = u[u.length - 1];
          if (typeof d != "function")
            throw new TypeError(`skal ref: .${String(o)}() requires a callback as its last argument (got ${typeof d})`);
          const b = u.slice(0, -1);
          return eo(t, s, b, d);
        };
      }
      return (...s) => t === 0 ? Promise.reject(new Error(`skal ref: cannot call .${String(o)}() before the host mounts. Move the call into a JSX event handler.`)) : je(t, o, s);
    } });
  }
  function kr(t, r, n) {
    const o = (x) => {
      const S = t[x];
      return typeof S == "function" ? S : S && S.component || null;
    }, s = (x) => {
      const S = t[x];
      return S && typeof S == "object" ? S.title : undefined;
    }, u = (x) => {
      const S = t[x];
      return S && typeof S == "object" ? S.transition : undefined;
    }, d = (x) => x === "fade" ? 1 : x === "none" ? 2 : typeof x == "number" ? x : 0, b = !!(n && n.linking), h = typeof window < "u", F = () => {
      if (!h)
        return null;
      const x = (window.location.hash || "").replace(/^#\/?/, "").split("?")[0];
      return x && t[x] ? x : null;
    };
    let R = typeof r == "string" ? r : r && r.name || Object.keys(t)[0];
    if (b) {
      const x = F();
      x && (R = x);
    }
    const [T, D] = X([{ name: R, params: {}, title: s(R), transition: u(R) }]), m = { stack: T, navigate(x, S, z) {
      D([...T(), { name: x, params: S || {}, presentation: z && z.presentation, title: (z && z.title) !== undefined ? z.title : s(x), transition: (z && z.transition) !== undefined ? z.transition : u(x) }]);
    }, back() {
      const x = T();
      x.length > 1 && D(x.slice(0, -1));
    }, replace(x, S, z) {
      D([...T().slice(0, -1), { name: x, params: S || {}, title: (z && z.title) !== undefined ? z.title : s(x), transition: (z && z.transition) !== undefined ? z.transition : u(x) }]);
    }, reset(x, S) {
      D([{ name: x, params: S || {}, title: s(x), transition: u(x) }]);
    }, canGoBack() {
      return T().length > 1;
    } };
    return b && h && hr(() => {
      const x = T(), S = "#/" + x[x.length - 1].name;
      window.location.hash !== S && window.history.replaceState({}, "", S);
    }), m.View = () => (() => {
      var x = l("navigator");
      return e(x, "onPop", () => m.back()), M(x, L(oe, { get each() {
        return T();
      }, children: (S) => {
        const z = o(S.name);
        return (() => {
          var j = l("screen");
          return M(j, z ? L(z, { get params() {
            return S.params || {};
          }, router: m }) : null), G((P) => {
            var $ = S.presentation === "modal" ? 1 : 0, f = S.title || "", E = d(S.transition);
            return $ !== P.e && (P.e = e(j, "presentation", $, P.e)), f !== P.t && (P.t = e(j, "title", f, P.t)), E !== P.a && (P.a = e(j, "transition", E, P.a)), P;
          }, { e: undefined, t: undefined, a: undefined }), j;
        })();
      } })), x;
    })(), m;
  }
  var tr = Symbol("store-raw"), Ke = Symbol("store-node"), $e = Symbol("store-has"), $n = Symbol("store-self");
  function Cn(t) {
    let r = t[ye];
    if (!r && (Object.defineProperty(t, ye, { value: r = new Proxy(t, Po) }), !Array.isArray(t))) {
      const n = Object.keys(t), o = Object.getOwnPropertyDescriptors(t), s = Object.getPrototypeOf(t), u = s !== null && t !== null && typeof t == "object" && !Array.isArray(t) && s !== Object.prototype;
      if (u) {
        const d = Object.getOwnPropertyDescriptors(s);
        n.push(...Object.keys(d)), Object.assign(o, d);
      }
      for (let d = 0, b = n.length;d < b; d++) {
        const h = n[d];
        u && h === "constructor" || o[h].get && Object.defineProperty(t, h, { configurable: true, enumerable: o[h].enumerable, get: o[h].get.bind(r) });
      }
    }
    return r;
  }
  function ft(t) {
    let r;
    return t != null && typeof t == "object" && (t[ye] || !(r = Object.getPrototypeOf(t)) || r === Object.prototype || Array.isArray(t));
  }
  function dt(t, r = new Set) {
    let n, o, s, u;
    if (n = t != null && t[tr])
      return n;
    if (!ft(t) || r.has(t))
      return t;
    if (Array.isArray(t)) {
      Object.isFrozen(t) ? t = t.slice(0) : r.add(t);
      for (let d = 0, b = t.length;d < b; d++)
        s = t[d], (o = dt(s, r)) !== s && (t[d] = o);
    } else {
      Object.isFrozen(t) ? t = Object.assign({}, t) : r.add(t);
      const d = Object.keys(t), b = Object.getOwnPropertyDescriptors(t);
      for (let h = 0, F = d.length;h < F; h++)
        u = d[h], !b[u].get && (s = t[u], (o = dt(s, r)) !== s && (t[u] = o));
    }
    return t;
  }
  function rr(t, r) {
    let n = t[r];
    return n || Object.defineProperty(t, r, { value: n = Object.create(null) }), n;
  }
  function Rt(t, r, n) {
    if (t[r])
      return t[r];
    const [o, s] = X(n, { equals: false, internal: true });
    return o.$ = s, t[r] = o;
  }
  function yo(t, r) {
    const n = Reflect.getOwnPropertyDescriptor(t, r);
    return !n || n.get || !n.configurable || r === ye || r === Ke || (delete n.value, delete n.writable, n.get = () => t[ye][r]), n;
  }
  function On(t) {
    gr() && Rt(rr(t, Ke), $n)();
  }
  function xo(t) {
    return On(t), Reflect.ownKeys(t);
  }
  var Po = { get(t, r, n) {
    if (r === tr)
      return t;
    if (r === ye)
      return n;
    if (r === Mt)
      return On(t), n;
    const o = rr(t, Ke), s = o[r];
    let u = s ? s() : t[r];
    if (r === Ke || r === $e || r === "__proto__")
      return u;
    if (!s) {
      const d = Object.getOwnPropertyDescriptor(t, r);
      gr() && (typeof u != "function" || t.hasOwnProperty(r)) && !(d && d.get) && (u = Rt(o, r, u)());
    }
    return ft(u) ? Cn(u) : u;
  }, has(t, r) {
    return r === tr || r === ye || r === Mt || r === Ke || r === $e || r === "__proto__" ? true : (gr() && Rt(rr(t, $e), r)(), (r in t));
  }, set() {
    return true;
  }, deleteProperty() {
    return true;
  }, ownKeys: xo, getOwnPropertyDescriptor: yo };
  function ht(t, r, n, o = false) {
    if (r === "__proto__" || !o && t[r] === n)
      return;
    const s = t[r], u = t.length;
    n === undefined ? (delete t[r], t[$e] && t[$e][r] && s !== undefined && t[$e][r].$()) : (t[r] = n, t[$e] && t[$e][r] && s === undefined && t[$e][r].$());
    let d = rr(t, Ke), b;
    if ((b = Rt(d, r, s)) && b.$(() => n), Array.isArray(t) && t.length !== u) {
      for (let h = t.length;h < u; h++)
        (b = d[h]) && b.$();
      (b = Rt(d, "length", u)) && b.$(t.length);
    }
    (b = d[$n]) && b.$();
  }
  function kn(t, r) {
    const n = Object.keys(r);
    for (let o = 0;o < n.length; o += 1) {
      const s = n[o];
      In(s) || ht(t, s, r[s]);
    }
  }
  function In(t) {
    return t === "__proto__" || t === "constructor" || t === "prototype";
  }
  function To(t, r) {
    if (typeof r == "function" && (r = r(t)), r = dt(r), Array.isArray(r)) {
      if (t === r)
        return;
      let n = 0, o = r.length;
      for (;n < o; n++) {
        const s = r[n];
        t[n] !== s && ht(t, n, s);
      }
      ht(t, "length", o);
    } else
      kn(t, r);
  }
  function $t(t, r, n = []) {
    let o, s = t;
    if (r.length > 1) {
      o = r.shift();
      const d = typeof o, b = Array.isArray(t);
      if (d === "string" && (o === "__proto__" || r.length > 1 && In(o)))
        return;
      if (Array.isArray(o)) {
        for (let h = 0;h < o.length; h++)
          $t(t, [o[h]].concat(r), n);
        return;
      } else if (b && d === "function") {
        for (let h = 0;h < t.length; h++)
          o(t[h], h) && $t(t, [h].concat(r), n);
        return;
      } else if (b && d === "object") {
        const { from: h = 0, to: F = t.length - 1, by: R = 1 } = o;
        for (let T = h;T <= F; T += R)
          $t(t, [T].concat(r), n);
        return;
      } else if (r.length > 1) {
        $t(t[o], r, [o].concat(n));
        return;
      }
      s = t[o], n = [o].concat(n);
    }
    let u = r[0];
    typeof u == "function" && (u = u(s, n), u === s) || o === undefined && u == null || (u = dt(u), o === undefined || ft(s) && ft(u) && !Array.isArray(u) ? kn(s, u) : ht(t, o, u));
  }
  function Ao(...[t, r]) {
    const n = dt(t || {}), o = Array.isArray(n), s = Cn(n);
    function u(...d) {
      Jr(() => {
        o && d.length === 1 ? To(n, d[0]) : $t(n, d);
      });
    }
    return [s, u];
  }
  var nr = new WeakMap, Dn = { get(t, r) {
    if (r === tr)
      return t;
    const n = t[r];
    if (r === ye || r === Mt || r === Ke || r === $e || r === "__proto__")
      return n;
    let o;
    return ft(n) ? nr.get(n) || (nr.set(n, o = new Proxy(n, Dn)), o) : n;
  }, set(t, r, n) {
    return ht(t, r, dt(n)), true;
  }, deleteProperty(t, r) {
    return ht(t, r, undefined, true), true;
  } };
  function ir(t) {
    return (r) => {
      if (ft(r)) {
        let n;
        (n = nr.get(r)) || nr.set(r, n = new Proxy(r, Dn)), t(n);
      }
      return r;
    };
  }
  var kc = 15, Ro = (() => {
    const t = new Uint32Array(256);
    for (let r = 0;r < 256; r++) {
      let n = r;
      for (let o = 0;o < 8; o++)
        n = n & 1 ? 3988292384 ^ n >>> 1 : n >>> 1;
      t[r] = n >>> 0;
    }
    return t;
  })();
  function zn(t, r = 0, n = t.length) {
    let o = 4294967295;
    for (let s = r;s < n; s++)
      o = Ro[(o ^ t[s]) & 255] ^ o >>> 8;
    return (o ^ 4294967295) >>> 0;
  }
  function Nn(t, r, n, o, s, u) {
    const d = 15 + s.length + u.length, b = new DataView(t.buffer, t.byteOffset + r, d);
    return b.setUint32(4, n >>> 0, true), t[r + 8] = o & 255, b.setUint16(9, s.length, true), b.setUint32(11, u.length, true), t.set(s, r + 15), t.set(u, r + 15 + s.length), b.setUint32(0, zn(t, r + 4, r + d), true), d;
  }
  function or(t, r, n = true) {
    if (r + 15 > t.length)
      return null;
    const o = new DataView(t.buffer, t.byteOffset, t.byteLength), s = o.getUint32(r, true), u = o.getUint32(r + 4, true), d = t[r + 8], b = o.getUint16(r + 9, true), h = o.getUint32(r + 11, true), F = 15 + b + h;
    if (r + F > t.length || n && zn(t, r + 4, r + F) !== s)
      return null;
    const R = r + 15, T = R + b;
    return { seq: u, flags: d, total: F, key: t.subarray(R, T), value: t.subarray(T, T + h) };
  }
  var Xe = 256 * 1024, $o = 0.4, Co = 1000, Oo = 8, ko = 16, Io = new TextEncoder, Do = new TextDecoder, Ir = (t) => Io.encode(t), Dr = (t) => Do.decode(t), Ln = () => Date.now(), Mn = new Uint8Array(0), Bn = 1397442609, zr = new Function("m", "return import(m);"), Nr = (t, r) => t && t[r] ? t : t && t.default || t, Lr = class {
    constructor() {
      this.kind = "memory", this._segs = new Map, this._meta = new Map;
    }
    listSegments() {
      return [...this._segs.keys()].sort((t, r) => t - r);
    }
    appendSegment(t, r) {
      const n = this._segs.get(t);
      if (!n) {
        this._segs.set(t, r.slice());
        return;
      }
      const o = new Uint8Array(n.length + r.length);
      o.set(n), o.set(r, n.length), this._segs.set(t, o);
    }
    getSegment(t) {
      return this._segs.get(t) || null;
    }
    dropSegment(t) {
      this._segs.delete(t);
    }
    flush() {}
    metaGet(t) {
      return this._meta.get(t) || null;
    }
    metaPut(t, r) {
      this._meta.set(t, r.slice());
    }
  }, zo = class {
    constructor(t, r, n) {
      this.kind = "fs", this._fs = t, this._p = r, this.root = n;
    }
    _seg(t) {
      return this._p.join(this.root, `seg-${String(t).padStart(5, "0")}.log`);
    }
    listSegments() {
      let t = [];
      try {
        t = this._fs.readdirSync(this.root);
      } catch {
        return [];
      }
      return t.filter((r) => /^seg-\d+\.log$/.test(r)).map((r) => parseInt(r.slice(4), 10)).sort((r, n) => r - n);
    }
    appendSegment(t, r) {
      this._fs.appendFileSync(this._seg(t), r);
    }
    getSegment(t) {
      try {
        return new Uint8Array(this._fs.readFileSync(this._seg(t)));
      } catch {
        return null;
      }
    }
    dropSegment(t) {
      try {
        this._fs.unlinkSync(this._seg(t));
      } catch {}
    }
    flush() {}
    metaGet(t) {
      try {
        return new Uint8Array(this._fs.readFileSync(this._p.join(this.root, `meta-${t}`)));
      } catch {
        return null;
      }
    }
    metaPut(t, r) {
      this._fs.writeFileSync(this._p.join(this.root, `meta-${t}`), r);
    }
  }, No = class {
    constructor(t, r, n, o) {
      this.kind = "mmap", this.directActive = true, this._mmap = t, this._fs = r, this._p = n, this.root = o, this._open = new Map;
      try {
        for (const s of r.readdirSync(o))
          if (s.endsWith(".dead"))
            try {
              r.unlinkSync(n.join(o, s));
            } catch {}
      } catch {}
    }
    _segPath(t) {
      return this._p.join(this.root, `seg-${String(t).padStart(5, "0")}.log`);
    }
    _handle(t) {
      let r = this._open.get(t);
      if (r)
        return this._open.delete(t), this._open.set(t, r), r;
      const n = this._mmap(this._segPath(t), { shared: true });
      let o = 0;
      for (;o < n.length; ) {
        const s = or(n, o);
        if (!s)
          break;
        o += s.total;
      }
      return r = { mapped: n, cursor: o }, this._open.set(t, r), this._evictOpen(t), r;
    }
    _evictOpen(t) {
      for (;this._open.size > ko; ) {
        const r = this._open.keys().next().value;
        if (r === t)
          break;
        this._open.delete(r);
      }
    }
    createSegment(t, r) {
      const n = this._segPath(t);
      this._fs.writeFileSync(n, new Uint8Array(r));
      const o = { mapped: this._mmap(n, { shared: true }), cursor: 0 };
      return this._open.set(t, o), this._evictOpen(t), o;
    }
    segmentCapacity(t) {
      const r = this._open.get(t);
      if (r)
        return r.mapped.length;
      try {
        return this._handle(t).mapped.length;
      } catch {
        return 0;
      }
    }
    listSegments() {
      let t = [];
      try {
        t = this._fs.readdirSync(this.root);
      } catch {
        return [];
      }
      return t.filter((r) => /^seg-\d+\.log$/.test(r)).map((r) => parseInt(r.slice(4), 10)).sort((r, n) => r - n);
    }
    segmentLen(t) {
      try {
        return this._handle(t).cursor;
      } catch {
        return 0;
      }
    }
    reserve(t, r) {
      const n = this._handle(t), o = n.cursor;
      return n.cursor += r, { mapped: n.mapped, offset: o };
    }
    getSegment(t) {
      let r;
      try {
        r = this._handle(t);
      } catch {
        return null;
      }
      return r.mapped.subarray(0, r.cursor);
    }
    dropSegment(t) {
      this._open.delete(t);
      try {
        this._fs.renameSync(this._segPath(t), this._segPath(t) + ".dead");
      } catch {}
    }
    flush() {}
    metaGet(t) {
      try {
        return new Uint8Array(this._fs.readFileSync(this._p.join(this.root, `meta-${t}`)));
      } catch {
        return null;
      }
    }
    metaPut(t, r) {
      this._fs.writeFileSync(this._p.join(this.root, `meta-${t}`), r);
    }
  };
  function Ct(t, r) {
    return t.diag = r, t;
  }
  async function Lo(t) {
    let r, n, o;
    try {
      const d = Promise.all([zr("node:fs"), zr("node:os"), zr("node:path")]), b = new Promise((T, D) => setTimeout(() => D(new Error("module import timed out")), 2000)), [h, F, R] = await Promise.race([d, b]);
      if (r = Nr(h, "readFileSync"), n = Nr(F, "tmpdir"), o = Nr(R, "join"), typeof r.readFileSync != "function" || typeof r.writeFileSync != "function" || typeof n.tmpdir != "function" || typeof o.join != "function")
        return Ct(new Lr, "node:fs/os/path resolved but missing methods");
    } catch (d) {
      return Ct(new Lr, "node: import failed \u2014 " + (d && d.message || d));
    }
    const s = t && t.length ? t : o.join(n.tmpdir(), "skal-store");
    let u = "";
    try {
      if (typeof Bun < "u" && typeof Bun.mmap == "function") {
        const d = o.join(s, "mmap");
        r.mkdirSync(d, { recursive: true });
        const b = o.join(d, ".mmap-probe");
        r.writeFileSync(b, new Uint8Array(64));
        const h = Bun.mmap(b, { shared: true });
        if (h && h.length >= 64)
          return Ct(new No((F, R) => Bun.mmap(F, R), r, o, d), "mmap @ " + d);
        u += "Bun.mmap probe unusable; ";
      } else
        u += "Bun.mmap absent; ";
    } catch (d) {
      u += "mmap \u2014 " + (d && d.message || d) + "; ";
    }
    try {
      if (typeof r.appendFileSync == "function") {
        const d = o.join(s, "fs");
        return r.mkdirSync(d, { recursive: true }), r.writeFileSync(o.join(d, ".fs-probe"), new Uint8Array(1)), Ct(new zo(r, o, d), u + "fs @ " + d);
      }
      u += "fs.appendFileSync absent; ";
    } catch (d) {
      u += "fs \u2014 " + (d && d.message || d) + "; ";
    }
    return Ct(new Lr, u + "memory fallback");
  }
  var Mo = class {
    constructor(t) {
      this._b = t, this._keydir = new Map, this._dead = new Map, this._cache = new Map, this._seq = 0, this._active = null, this._lastHintMs = 0;
    }
    get backendKind() {
      return this._b.kind;
    }
    open() {
      const t = this._b.listSegments(), r = this._loadHint(t);
      if (r && (this._keydir = r.keydir, this._dead = r.dead, this._seq = r.seq), t.length === 0) {
        const d = r ? r.tail.id : 0;
        this._active = this._b.directActive ? { id: d, direct: true } : { id: d, buf: new Uint8Array(Xe), len: 0, persisted: 0 };
        return;
      }
      const n = t[t.length - 1], o = r ? r.tail.id : n, s = r ? r.tail.id : t[0];
      let u = null;
      for (const d of t) {
        if (d < s)
          continue;
        const b = this._b.getSegment(d) || new Uint8Array(0);
        let h = r && d === r.tail.id ? r.tail.len : 0;
        for (;h < b.length; ) {
          const F = or(b, h);
          if (!F)
            break;
          const R = Dr(F.key), T = this._keydir.get(R);
          T && this._addDead(T.seg, T.len), F.flags & 1 ? (this._keydir.delete(R), this._addDead(d, F.total)) : this._keydir.set(R, { seg: d, off: h, len: F.total, seq: F.seq }), F.seq > this._seq && (this._seq = F.seq), h += F.total;
        }
        d === o ? u = b : this._cacheSet(d, b);
      }
      if (this._cache.delete(o), this._b.directActive)
        this._b.getSegment(o), this._active = { id: o, direct: true };
      else {
        u == null && (u = this._b.getSegment(o) || new Uint8Array(0));
        const d = new Uint8Array(Math.max(Xe, u.length));
        d.set(u), this._active = { id: o, buf: d, len: u.length, persisted: u.length };
      }
    }
    _addDead(t, r) {
      this._dead.set(t, (this._dead.get(t) || 0) + r);
    }
    _cacheGet(t) {
      const r = this._cache.get(t);
      return r !== undefined && (this._cache.delete(t), this._cache.set(t, r)), r;
    }
    _cacheSet(t, r) {
      for (this._cache.delete(t), this._cache.set(t, r);this._cache.size > Oo; )
        this._cache.delete(this._cache.keys().next().value);
    }
    _loadHint(t) {
      let r;
      try {
        r = this._b.metaGet("hint");
      } catch {
        return null;
      }
      if (!r || r.length < 20)
        return null;
      const n = new DataView(r.buffer, r.byteOffset, r.byteLength);
      if (n.getUint32(0, true) !== Bn)
        return null;
      const o = n.getUint32(4, true), s = n.getUint32(8, true), u = n.getUint32(12, true), d = n.getUint32(16, true), b = new Set(t), h = new Map;
      let F = 20;
      try {
        for (let D = 0;D < d; D++) {
          const m = n.getUint16(F, true);
          if (F += 2, F + m + 16 > r.length)
            return null;
          const x = Dr(r.subarray(F, F + m));
          F += m;
          const S = n.getUint32(F, true);
          F += 4;
          const z = n.getUint32(F, true);
          F += 4;
          const j = n.getUint32(F, true);
          F += 4;
          const P = n.getUint32(F, true);
          if (F += 4, !b.has(S))
            return null;
          h.set(x, { seg: S, off: z, len: j, seq: P });
        }
        const R = n.getUint32(F, true);
        F += 4;
        const T = new Map;
        for (let D = 0;D < R; D++) {
          const m = n.getUint32(F, true);
          F += 4, T.set(m, n.getUint32(F, true)), F += 4;
        }
        return !b.has(s) && u !== 0 ? null : { seq: o, tail: { id: s, len: u }, keydir: h, dead: T };
      } catch {
        return null;
      }
    }
    _tailLen() {
      const t = this._active;
      return t ? t.direct ? this._b.segmentLen(t.id) : t.persisted : 0;
    }
    _writeHint() {
      this._lastHintMs = Ln();
      const t = this._active, r = [];
      let n = 20;
      for (const [d, b] of this._keydir) {
        const h = Ir(d);
        r.push([h, b]), n += 2 + h.length + 16;
      }
      n += 4 + this._dead.size * 8;
      const o = new Uint8Array(n), s = new DataView(o.buffer);
      s.setUint32(0, Bn, true), s.setUint32(4, this._seq >>> 0, true), s.setUint32(8, t ? t.id : 0, true), s.setUint32(12, this._tailLen(), true), s.setUint32(16, r.length, true);
      let u = 20;
      for (const [d, b] of r)
        s.setUint16(u, d.length, true), u += 2, o.set(d, u), u += d.length, s.setUint32(u, b.seg, true), u += 4, s.setUint32(u, b.off, true), u += 4, s.setUint32(u, b.len, true), u += 4, s.setUint32(u, b.seq >>> 0, true), u += 4;
      s.setUint32(u, this._dead.size, true), u += 4;
      for (const [d, b] of this._dead)
        s.setUint32(u, d, true), u += 4, s.setUint32(u, b, true), u += 4;
      try {
        this._b.metaPut("hint", o);
      } catch {}
    }
    _seal() {
      const t = this._active;
      if (t.direct) {
        this._active = { id: t.id + 1, direct: true };
        return;
      }
      t.len > t.persisted && this._b.appendSegment(t.id, t.buf.subarray(t.persisted, t.len)), this._cacheSet(t.id, t.buf.slice(0, t.len)), this._active = { id: t.id + 1, buf: new Uint8Array(Xe), len: 0, persisted: 0 };
    }
    _writeFrame(t, r, n, o) {
      const s = 15 + n.length + o.length, u = this._active;
      if (u.direct) {
        const h = this._b.segmentCapacity(u.id);
        h === 0 ? this._b.createSegment(u.id, Math.max(Xe, s)) : this._b.segmentLen(u.id) + s > h && (this._seal(), this._b.createSegment(this._active.id, Math.max(Xe, s)));
        const F = this._b.reserve(this._active.id, s);
        return Nn(F.mapped, F.offset, t, r, n, o), F.offset;
      }
      u.len > 0 && u.len + s > Xe && this._seal();
      const d = this._active;
      if (d.len + s > d.buf.length) {
        const h = new Uint8Array(Math.max(d.buf.length * 2, d.len + s));
        h.set(d.buf.subarray(0, d.len)), d.buf = h;
      }
      const b = d.len;
      return Nn(d.buf, b, t, r, n, o), d.len += s, b;
    }
    put(t, r) {
      const n = ++this._seq, o = Ir(t), s = this._writeFrame(n, 0, o, r), u = this._keydir.get(t);
      u && this._addDead(u.seg, u.len), this._keydir.set(t, { seg: this._active.id, off: s, len: 15 + o.length + r.length, seq: n });
    }
    del(t) {
      const r = this._keydir.get(t);
      r && (this._writeFrame(++this._seq, 1, Ir(t), Mn), this._addDead(r.seg, r.len), this._keydir.delete(t));
    }
    delPrefix(t) {
      if (!t)
        return;
      const r = t + ".", n = t + "#", o = [];
      for (const s of this._keydir.keys())
        (s.startsWith(r) || s.startsWith(n)) && o.push(s);
      for (const s of o)
        this.del(s);
    }
    get(t) {
      const r = this._keydir.get(t);
      if (!r)
        return null;
      const n = this._segBytes(r.seg);
      if (!n)
        return null;
      const o = or(n, r.off, false);
      return !o || o.flags & 1 ? null : o.value.slice();
    }
    _segBytes(t) {
      if (this._active && t === this._active.id)
        return this._active.direct ? this._b.getSegment(t) : this._active.buf.subarray(0, this._active.len);
      let r = this._cacheGet(t);
      return r || (r = this._b.getSegment(t), r && this._cacheSet(t, r)), r;
    }
    flush() {
      const t = this._active;
      t && !t.direct && t.len > t.persisted && (this._b.appendSegment(t.id, t.buf.subarray(t.persisted, t.len)), t.persisted = t.len), this._b.flush(), Ln() - this._lastHintMs >= Co && this._writeHint();
    }
    compact() {
      let t = -1, r = 0;
      for (const [d, b] of this._dead)
        this._active && d === this._active.id || b > r && (r = b, t = d);
      if (t < 0 || r < Xe * $o)
        return false;
      const n = this._segBytes(t);
      if (!n)
        return false;
      const o = this._b.listSegments(), s = o.length > 0 && t === o[0];
      let u = 0;
      for (;u < n.length; ) {
        const d = or(n, u);
        if (!d)
          break;
        const b = Dr(d.key);
        if (d.flags & 1)
          !s && !this._keydir.has(b) && (this._writeFrame(++this._seq, 1, d.key, Mn), this._addDead(this._active.id, 15 + d.key.length));
        else {
          const h = this._keydir.get(b);
          h && h.seg === t && h.off === u && this.put(b, d.value.slice());
        }
        u += d.total;
      }
      return this.flush(), this._b.dropSegment(t), this._cache.delete(t), this._dead.delete(t), this._writeHint(), true;
    }
    stats() {
      let t = 0;
      for (const r of this._dead.values())
        t += r;
      return { backend: this._b.kind, records: this._keydir.size, segments: this._b.listSegments().length, activeSegment: this._active ? this._active.id : -1, deadBytes: t, seq: this._seq };
    }
  }, Bo = class {
    constructor(t) {
      this.backendKind = "native", this._dir = t, this._h = 0;
    }
    open() {
      const t = globalThis.__skal_store_open;
      if (this._h = typeof t == "function" && t(this._dir) || 0, !this._h)
        throw new Error("skal-store: native engine open failed @ " + this._dir);
    }
    put(t, r) {
      globalThis.__skal_store_put(this._h, t, r);
    }
    del(t) {
      globalThis.__skal_store_del(this._h, t);
    }
    delPrefix(t) {
      const r = globalThis.__skal_store_del_prefix;
      typeof r == "function" && r(this._h, t);
    }
    get(t) {
      const r = globalThis.__skal_store_get(this._h, t);
      return r ? new Uint8Array(r) : null;
    }
    flush() {}
    compact() {
      return !!globalThis.__skal_store_compact(this._h);
    }
    stats() {
      const t = this._h ? globalThis.__skal_store_stats(this._h) : null;
      if (!t)
        return { backend: "native", records: 0, segments: 0, deadBytes: 0, seq: 0 };
      const r = new DataView(t);
      return { backend: "native", records: r.getUint32(0, true), segments: r.getUint32(4, true), deadBytes: r.getUint32(8, true), seq: r.getUint32(12, true) };
    }
  }, Wo = 60, Uo = 8192, lr = Symbol("skal.indexDirty"), Vo = new TextEncoder, Ho = new TextDecoder;
  function Je(t) {
    return Vo.encode(JSON.stringify(t));
  }
  function Pe(t) {
    return JSON.parse(Ho.decode(t));
  }
  var Mr = Symbol.for("skal.store"), Se = (t) => t !== null && typeof t == "object" && !Array.isArray(t), Oe = (t) => Array.isArray(t) && t.every(Se), Br = (t) => typeof t == "string" && /^(0|[1-9]\d*)$/.test(t), fe = (t, r) => t ? t + "." + r : r, Ot = () => typeof performance < "u" && performance.now ? performance.now() : Date.now();
  function gt(t) {
    if (Array.isArray(t))
      return t.map(gt);
    if (Se(t)) {
      const r = {};
      for (const n of Object.keys(t))
        r[n] = gt(t[n]);
      return r;
    }
    return t;
  }
  async function Go() {
    const t = globalThis.__skal_data_dir;
    if (typeof t == "string" && t.length)
      return t;
    for (let r = 0;r < 5; r++) {
      try {
        const n = await Promise.race([Ji(), new Promise((o, s) => setTimeout(() => s(new Error("getDataDir timeout")), 800))]);
        if (typeof n == "string" && n.length)
          return n;
      } catch {}
      await new Promise((n) => setTimeout(n, 150));
    }
    return "";
  }
  function jo(t, r = {}) {
    const n = { name: r.name || "store", paths: r.paths || null, residentMax: r.residentMax || 1e4, version: r.version || 0, migrate: r.migrate || null };
    let o = false, s = false;
    if (n.paths)
      for (const A in n.paths) {
        const p = n.paths[A];
        p && p.lazy === true && (o = true), p && p.persist === false && (s = true);
      }
    const u = new Map;
    function d(A) {
      const p = u.get(A);
      if (p)
        return p;
      let v = true, O = false;
      if (n.paths) {
        const C = [];
        for (const i in n.paths)
          (i === A || A.startsWith(i + ".")) && C.push(i);
        C.sort((i, a) => i.length - a.length);
        for (const i of C) {
          const a = n.paths[i];
          a.persist !== undefined && (v = a.persist), a.lazy !== undefined && (O = a.lazy);
        }
      }
      const k = { persist: v, lazy: O };
      return u.set(A, k), k;
    }
    const [b, h] = Ao(gt(t)), [F, R] = X(false), [T, D] = X("\u2026"), [m, x] = X(null);
    let S = null;
    const z = new Map, j = new Map, P = new Map, $ = new Set;
    let f = null, E = 0;
    function w(A) {
      const p = j.get(A) || 1;
      return j.set(A, p + 1), String(p);
    }
    function I() {
      f == null && (f = setTimeout(() => {
        f = null, N();
      }, Wo));
    }
    function N() {
      if (!(!S || z.size === 0 && $.size === 0)) {
        if ($.size > 0) {
          if (S.delPrefix)
            for (const A of $)
              S.delPrefix(A);
          $.clear();
        }
        for (const [A, p] of z)
          if (p === null)
            S.del(A);
          else if (p === lr) {
            const v = A.slice(2, -2), O = re(v === "" ? [] : v.split("."));
            Array.isArray(O) && S.put(A, Je({ ids: O.map((k) => k && k._id), nextId: j.get(v) || O.length + 1 }));
          } else
            S.put(A, p);
        z.clear(), S.flush(), E++;
      }
    }
    function H() {
      f != null && (clearTimeout(f), f = null), N();
    }
    function se(A) {
      const p = [];
      let v = b;
      for (const O of A)
        if (O !== null && typeof O == "object") {
          let k = -1;
          if (Array.isArray(v)) {
            const C = O.hint;
            C >= 0 && C < v.length && v[C] && v[C]._id === O.__id ? k = C : (k = v.findIndex((i) => i && i._id === O.__id), O.hint = k);
          }
          p.push(k), v = k < 0 ? undefined : v[k];
        } else
          p.push(O), v = v?.[O];
      return { path: p, value: v };
    }
    function re(A) {
      let p = b;
      for (let v = 0;v < A.length; v++) {
        const O = A[v];
        if (O !== null && typeof O == "object") {
          let k = -1;
          if (Array.isArray(p)) {
            const C = O.hint;
            C >= 0 && C < p.length && p[C] && p[C]._id === O.__id ? k = C : (k = p.findIndex((i) => i && i._id === O.__id), O.hint = k);
          }
          p = k < 0 ? undefined : p[k];
        } else
          p = p?.[O];
        if (p == null)
          return;
      }
      return p;
    }
    function be(A, p) {
      let v = b;
      for (let O = 0;O < A.length; O++) {
        const k = A[O];
        if (k !== null && typeof k == "object") {
          let C = -1;
          if (Array.isArray(v)) {
            const i = k.hint;
            i >= 0 && i < v.length && v[i] && v[i]._id === k.__id ? C = i : (C = v.findIndex((a) => a && a._id === k.__id), k.hint = C);
          }
          v = C < 0 ? undefined : v[C];
        } else
          v = v?.[k];
        if (v == null)
          return;
      }
      return v[p];
    }
    function ie(A, ...p) {
      for (let v = 0;v < A.length; v++) {
        const O = A[v];
        if (O !== null && typeof O == "object") {
          const k = se(A);
          if (k.path.indexOf(-1) >= 0)
            return;
          h(...k.path, ...p);
          return;
        }
      }
      h(...A, ...p);
    }
    const pe = new Map;
    function Ze(A) {
      let p = t;
      for (const v of A.split(".")) {
        if (p == null)
          return;
        p = p[v];
      }
      return gt(p);
    }
    function bt(A) {
      for (pe.delete(A), pe.set(A, true);pe.size > n.residentMax; ) {
        const p = pe.keys().next().value;
        if (p === A)
          break;
        pe.delete(p), ie(p.split("."), Ze(p));
      }
    }
    function sr(A, p) {
      if (!(!S || pe.has(p))) {
        if (Array.isArray(re(A)))
          vt(A, p);
        else {
          const v = S.get("k:" + p);
          v != null && ie(A, Pe(v));
        }
        bt(p);
      }
    }
    function Qe(A, p, v, O) {
      if (v) {
        z.set("k:" + v.storeKey, Je(re(v.solidPath)));
        return;
      }
      if (Oe(O)) {
        for (const k of O)
          z.set("k:" + fe(p, k._id), Je(k));
        z.set("k:" + p + "#x", lr);
        return;
      }
      if (p === "" && Se(O)) {
        for (const k of Object.keys(O)) {
          const C = fe(p, k);
          d(C).persist && Qe([...A, k], C, null, O[k]);
        }
        return;
      }
      z.set("k:" + p, Je(O));
    }
    function It(A, p) {
      if (Oe(p)) {
        for (const v of p)
          v && v._id != null && z.set("k:" + fe(A, v._id), null);
        z.set("k:" + A + "#x", null);
        return;
      }
      z.set("k:" + A, null), A && p !== null && typeof p == "object" && $.add(A);
    }
    function Wr(A, p, v, O) {
      let k = O;
      !v && Oe(O) && (k = O.map((a) => a._id != null ? a : { ...a, _id: w(p) }));
      let C = false;
      for (let a = 0;a < A.length; a++) {
        const c = A[a];
        if (c !== null && typeof c == "object") {
          C = true;
          break;
        }
      }
      if (C) {
        const a = se(A);
        if (a.path.indexOf(-1) >= 0)
          return;
        h(...a.path, k);
      } else
        h(...A, k);
      Array.isArray(k) && P.delete(p), p && ge.size > 0 && Ce(p, k !== null && typeof k == "object");
      let i = true;
      if (o || s) {
        const a = d(p);
        !v && a.lazy && bt(p), i = a.persist;
      }
      i && (!v && p && k !== null && typeof k == "object" && $.add(p), Qe(A, p, v, k), I());
    }
    const ge = new Map;
    let Dt = new Set, zt = false;
    function Ur() {
      zt || (zt = true, queueMicrotask(Vr));
    }
    function Vr() {
      zt = false;
      const A = Dt;
      Dt = new Set;
      for (const p of A)
        if (!p._disposed) {
          p._dirty = false;
          try {
            pt(p);
          } catch (v) {
            console.error("[skal] effect threw:", v);
          }
        }
    }
    function pt(A) {
      const { _sps: p, _vals: v } = A;
      for (let O = 0;O < p.length; O++)
        v[O] = re(p[O]);
      A._fn(v);
    }
    function We(A) {
      for (const p of A)
        p._dirty || (p._dirty = true, Dt.add(p));
    }
    function Ce(A, p) {
      const v = ge.get(A);
      if (v && We(v), p)
        if (A === "")
          for (const [, O] of ge)
            O !== v && We(O);
        else {
          const O = A + ".";
          for (const [k, C] of ge)
            k.startsWith(O) && We(C);
        }
      (v || p) && Ur();
    }
    function ar(A, p) {
      const v = new Array(A.length);
      for (let C = 0;C < A.length; C++)
        v[C] = A[C].split(".");
      const O = { _fn: p, _paths: A, _sps: v, _vals: new Array(A.length), _dirty: false, _disposed: false };
      for (let C = 0;C < A.length; C++) {
        const i = A[C];
        let a = ge.get(i);
        a || (a = new Set, ge.set(i, a)), a.add(O);
      }
      const k = () => {
        if (!O._disposed) {
          O._disposed = true;
          for (let C = 0;C < O._paths.length; C++) {
            const i = ge.get(O._paths[C]);
            i && (i.delete(O), i.size === 0 && ge.delete(O._paths[C]));
          }
        }
      };
      try {
        pt(O);
      } catch (C) {
        throw k(), C;
      }
      return k;
    }
    const cr = { ready: F, backendKind: T, initTiming: m, flushNow: H, version: () => n.version, pending: () => z.size, flushes: () => E, resident: () => pe.size, engineStats: () => S && S.stats ? S.stats() : null, createEffect: ar }, we = new Map;
    function et(A, p, v, O) {
      O === undefined && (O = Array.isArray(re(A)));
      const k = we.get(p);
      if (k !== undefined && k.isArray === O)
        return k.node;
      const C = O ? Hr(A, p, v) : ur(A, p, v);
      return we.set(p, { node: C, isArray: O }), we.size > Uo && we.delete(we.keys().next().value), C;
    }
    function Ft(A) {
      if (A.length) {
        for (const p of we.keys())
          for (const v of A)
            if (p === v || p.startsWith(v + ".") || p.startsWith(v + "#")) {
              we.delete(p);
              break;
            }
      }
    }
    function ur(A, p, v) {
      return new Proxy({}, { get(O, k) {
        if (k === Mr)
          return cr;
        if (typeof k == "symbol")
          return;
        if (o && !v) {
          const i = p ? p + "." + k : k;
          !pe.has(i) && d(i).lazy && De(() => sr(A.length === 0 ? [k] : [...A, k], i));
        }
        const C = be(A, k);
        return C !== null && typeof C == "object" ? et(A.length === 0 ? [k] : [...A, k], p ? p + "." + k : k, v, Array.isArray(C)) : C;
      }, set(O, k, C) {
        return typeof k == "symbol" ? false : (Wr(A.length === 0 ? [k] : [...A, k], p ? p + "." + k : k, v, C), true);
      }, has(O, k) {
        const C = re(A);
        return C != null && k in C;
      }, ownKeys() {
        const O = re(A);
        return O ? Reflect.ownKeys(O) : [];
      }, getOwnPropertyDescriptor(O, k) {
        const C = re(A);
        if (C != null && k in C)
          return { enumerable: k !== "_id", configurable: true };
      }, deleteProperty(O, k) {
        if (typeof k == "symbol")
          return false;
        const C = p ? p + "." + k : k, i = re(A.length === 0 ? [k] : [...A, k]);
        return ie(A, ir((a) => {
          a != null && delete a[k];
        })), v ? Qe(A, p, v, null) : (!s || d(C).persist) && It(C, i), i !== null && typeof i == "object" && (Ft([C]), P.delete(C)), C && ge.size > 0 && Ce(C, true), I(), true;
      } });
    }
    function Hr(A, p, v) {
      const O = () => re(A) || [], k = () => {
        (v || !s || d(p).persist) && Qe(A, p, v, O()), I();
      };
      function C(c, g, ...y) {
        const W = O(), V = W.length;
        c = c < 0 ? Math.max(0, V + c) : Math.min(c, V), g = g === undefined ? V - c : Math.max(0, Math.min(g, V - c));
        const K = W.slice(c, c + g);
        let q = y;
        if (v || (q = y.map((Q) => Se(Q) && Q._id == null ? { ...Q, _id: w(p) } : Q)), g === 0 && c === V && q.length > 0)
          for (let Q = 0;Q < q.length; Q++)
            ie([...A, V + Q], q[Q]);
        else
          ie(A, ir((Q) => {
            Q.splice(c, g, ...q);
          }));
        if (!v) {
          const Q = [];
          for (const ce of K)
            if (ce && ce._id != null) {
              const Fe = fe(p, ce._id);
              z.set("k:" + Fe, null), Q.push(Fe);
            }
          Ft(Q);
        }
        let Z = false;
        if (!v) {
          const Q = P.get(p);
          Z = Q === undefined ? Oe(W) : Q, Z && (Z = q.every(Se)), P.set(p, Z);
        }
        if (Z) {
          for (const Q of q)
            Q && Q._id != null && z.set("k:" + fe(p, Q._id), Je(Q));
          z.set("k:" + p + "#x", lr), I();
        } else
          k();
        return ge.size > 0 && Ce(p, true), K;
      }
      function i(c, g) {
        ie(A, ir(c));
        const y = P.get(p);
        return g && !v && (y === undefined ? Oe(O()) : y) ? (z.set("k:" + p + "#x", lr), I()) : k(), ge.size > 0 && Ce(p, true), O();
      }
      const a = { splice: C, push: (...c) => (C(O().length, 0, ...c), O().length), unshift: (...c) => (C(0, 0, ...c), O().length), pop: () => C(O().length - 1, 1)[0], shift: () => C(0, 1)[0], sort: (c) => i((g) => {
        g.sort(c);
      }, true), reverse: () => i((c) => {
        c.reverse();
      }, true), fill: (c, g, y) => i((W) => {
        W.fill(c, g, y);
      }, false), copyWithin: (c, g, y) => i((W) => {
        W.copyWithin(c, g, y);
      }, false) };
      return new Proxy([], { get(c, g) {
        if (g === Mr)
          return cr;
        if (g === "length")
          return O().length;
        if (typeof g == "string" && Object.hasOwn(a, g))
          return a[g];
        if (Br(g)) {
          const V = O(), K = +g, q = V[K];
          if (q !== null && typeof q == "object") {
            let Z = false;
            if (!v) {
              const Fe = P.get(p);
              Fe === undefined ? (Z = Oe(O()), P.set(p, Z)) : Z = Fe;
            }
            if (Z && q._id != null) {
              const Fe = fe(p, q._id), tt = [...A, { __id: q._id, hint: K }];
              return et(tt, Fe, { solidPath: tt, storeKey: Fe }, false);
            }
            const Q = fe(p, g), ce = [...A, K];
            return v ? et(ce, Q, v, Array.isArray(q)) : et(ce, Q, { solidPath: A, storeKey: p }, Array.isArray(q));
          }
          return q;
        }
        const y = O(), W = y[g];
        return typeof W == "function" ? W.bind(y) : W;
      }, set(c, g, y) {
        if (g === "length") {
          const W = +y;
          let V = null;
          if (!v && W < O().length) {
            const K = P.get(p);
            (K === undefined ? Oe(O()) : K) && (V = O().slice(W));
          }
          if (ie(A, ir((K) => {
            K.length = W;
          })), P.delete(p), V) {
            const K = [];
            for (const q of V)
              if (q && q._id != null) {
                const Z = fe(p, q._id);
                z.set("k:" + Z, null), K.push(Z);
              }
            Ft(K);
          }
          return k(), ge.size > 0 && Ce(p, true), true;
        }
        if (Br(g)) {
          const W = +g, V = O()[W];
          let K = y;
          !v && Se(y) && y._id == null && (K = { ...y, _id: V && V._id != null ? V._id : w(p) }), ie(A, W, K);
          let q = false;
          if (!v) {
            const Z = P.get(p);
            q = Z === undefined ? Oe(O()) : Z, q && !Se(K) && (q = false), P.set(p, q);
          }
          if (q && K && K._id != null ? (z.set("k:" + fe(p, K._id), Je(K)), I()) : k(), ge.size > 0) {
            const Z = K !== null && typeof K == "object";
            Ce(fe(p, g), Z);
            const Q = K && K._id != null ? K._id : null;
            q && Q != null && Ce(fe(p, Q), Z);
            const ce = V && V._id != null ? V._id : null;
            ce != null && ce !== Q && Ce(fe(p, ce), true);
          }
          return true;
        }
        return false;
      }, has(c, g) {
        return g === "length" || typeof g == "string" && Object.hasOwn(a, g) ? true : (g in O());
      }, ownKeys() {
        return Reflect.ownKeys(O());
      }, getOwnPropertyDescriptor(c, g) {
        const y = O();
        if (g === "length")
          return { value: y.length, writable: true, enumerable: false, configurable: false };
        if (Br(g) && +g < y.length)
          return { enumerable: true, configurable: true };
      } });
    }
    function fr(A, p, v) {
      if (Array.isArray(A)) {
        const k = S.get("k:" + p + "#x");
        if (k != null) {
          v.push(p + "#x");
          const i = Pe(k), a = [];
          for (const c of i.ids || []) {
            const g = fe(p, c);
            v.push(g);
            const y = S.get("k:" + g);
            y != null && a.push(Pe(y));
          }
          return a;
        }
        const C = S.get("k:" + p);
        return C != null ? (v.push(p), Pe(C)) : gt(A);
      }
      if (Se(A)) {
        const k = {};
        for (const C of Object.keys(A))
          k[C] = fr(A[C], fe(p, C), v);
        return k;
      }
      const O = S.get("k:" + p);
      return O != null ? (v.push(p), Pe(O)) : A;
    }
    function Nt(A, p) {
      if (Oe(A)) {
        let v = 0;
        for (const O of A) {
          const k = O._id == null ? 0 : +O._id;
          k > v && (v = k);
        }
        v + 1 > (j.get(p) || 1) && j.set(p, v + 1);
        for (const O of A)
          O._id == null && (O._id = w(p));
      } else if (Se(A))
        for (const v of Object.keys(A))
          Nt(A[v], fe(p, v));
    }
    function Lt(A, p, v) {
      for (const O of Object.keys(A)) {
        const k = A[O], C = [...p, O], i = fe(v, O), a = d(i);
        if (Array.isArray(k))
          a.persist && !a.lazy && vt(C, i);
        else if (Se(k)) {
          let c = true;
          if (a.persist && !a.lazy && !z.has("k:" + i)) {
            const g = S.get("k:" + i);
            if (g != null) {
              const y = Pe(g);
              ie(C, y), Se(y) || (c = false, S.delPrefix && $.add(i));
            }
          }
          c && Lt(k, C, i);
        } else {
          if (!a.persist || a.lazy || z.has("k:" + i))
            continue;
          const c = S.get("k:" + i);
          if (c != null) {
            const g = Pe(c);
            ie(C, g), Se(g) && Lt(g, C, i);
          }
        }
      }
    }
    function vt(A, p) {
      if (!d(p).persist || z.has("k:" + p + "#x") || z.has("k:" + p))
        return;
      P.delete(p);
      const v = S.get("k:" + p + "#x");
      if (v != null) {
        const k = Pe(v);
        j.set(p, k.nextId || 1);
        const C = [];
        for (const i of k.ids || []) {
          const a = S.get("k:" + fe(p, i));
          a != null && C.push(Pe(a));
        }
        ie(A, C);
        return;
      }
      const O = S.get("k:" + p);
      O != null && ie(A, Pe(O));
    }
    async function Gr() {
      const A = Ot();
      let p = A, v = A, O = A;
      try {
        const a = await Go();
        if (p = Ot(), typeof globalThis.__skal_store_open == "function" && a)
          try {
            const V = new Bo(a + "/" + n.name);
            V.open(), S = V, D("native");
          } catch {
            S = null;
          }
        if (!S) {
          const V = await Lo(a), K = new Mo(V);
          K.open(), S = K, D(V.kind);
        }
        v = Ot();
        let c = null;
        const g = S.get("k:#meta");
        if (g != null)
          try {
            c = Pe(g);
          } catch {
            c = null;
          }
        const y = c ? c.version | 0 : 0;
        let W = false;
        if (c && c.shape && n.migrate && y < n.version) {
          const V = [], K = fr(c.shape, "", V);
          let q = null;
          try {
            q = n.migrate(K, y);
          } catch {
            q = null;
          }
          if (Se(q)) {
            for (const Z of V)
              z.set("k:" + Z, null);
            Nt(q, ""), P.clear(), ie([], q), Qe([], "", null, q), W = true;
          }
        }
        (!c || y !== n.version) && z.set("k:#meta", Je({ version: n.version, shape: gt(t) })), O = Ot(), W || Lt(t, [], ""), I();
      } catch {}
      const k = Ot(), C = S && S.stats ? S.stats() : null, i = (a) => Math.round(a * 10) / 10;
      x({ total: i(k - A), dir: i(p - A), open: i(v - p), migrate: i(O - v), hydrate: i(k - O), records: C ? C.records : 0 }), R(true);
    }
    return Gr(), et([], "", null, Array.isArray(t));
  }
  var qo = "#FFFFFFFF", Ko = "#FFE5E5EA", Wn = "#FF1C1C1E", Un = "#FF8E8E93", ke = "#FF0A84FF", Me = "#FF34C759", Ye = "#FFFF9F0A", kt = "#FFFF3B30", _t = "#FF5E5CE6";
  function J(t) {
    return (() => {
      var r = l("column"), n = l("text");
      return _(r, n), e(r, "background", "#FFFFFFFF"), e(r, "cornerRadius", 14), e(r, "padding", 16), e(r, "gap", 12), e(r, "borderWidth", 1), e(r, "borderColor", "#FFE5E5EA"), e(n, "fontSize", 15), e(n, "fontWeight", 800), e(n, "color", "#FF1C1C1E"), M(r, () => t.children, null), G((o) => e(n, "label", t.title, o)), r;
    })();
  }
  function Xo(t) {
    const r = ["Inbox", "Starred", "Drafts", "Archive"];
    return [(() => {
      var n = l("column");
      return e(n, "background", "#FFF2F2F7"), e(n, "padding", 16), e(n, "gap", 8), e(n, "height", "fill"), M(n, L(oe, { each: r, children: (o) => (() => {
        var s = l("box"), u = l("text");
        return _(s, u), e(s, "background", "#FFFFFFFF"), e(s, "cornerRadius", 8), e(s, "padding", 12), e(s, "onTap", () => t.router.navigate("detail", { name: o }, { title: o })), e(u, "label", `${o}   \u203A`), e(u, "fontSize", 14), e(u, "color", "#FF1C1C1E"), s;
      })() })), n;
    })(), (() => {
      var n = l("drawer"), o = l("box"), s = l("text");
      return _(n, o), e(n, "background", "#FFFFFFFF"), _(o, s), e(o, "padding", 20), e(o, "background", "#FF0A84FF"), e(s, "label", "Mail"), e(s, "fontSize", 20), e(s, "fontWeight", 800), e(s, "color", "#FFFFFF"), M(n, L(oe, { each: r, children: (u) => (() => {
        var d = l("box"), b = l("text");
        return _(d, b), e(d, "padding", 14), e(b, "label", u), e(b, "fontSize", 14), e(b, "color", "#FF1C1C1E"), d;
      })() }), null), n;
    })()];
  }
  function Jo(t) {
    return (() => {
      var r = l("column"), n = l("text"), o = l("text");
      return _(r, n), _(r, o), e(r, "background", "#FFF2F2F7"), e(r, "padding", 16), e(r, "gap", 10), e(r, "height", "fill"), e(n, "fontSize", 20), e(n, "fontWeight", 800), e(n, "color", "#FF1C1C1E"), e(o, "label", "The AppBar's \u2039 back button (and the system back / swipe gesture) all pop this route. The list screen behind stayed mounted \u2014 back is instant, no re-render, scroll preserved."), e(o, "fontSize", 13), e(o, "color", "#FF8E8E93"), G((s) => e(n, "label", t.name, s)), r;
    })();
  }
  var Yo = [ke, Me, Ye, _t];
  function Zo() {
    const [t, r] = X(false), [n, o] = X(false), [s, u] = X(false), [d, b] = X(0), [h, F] = X("0, 0"), [R, T] = X(false), [D, m] = X(["Alpha", "Beta", "Gamma"]);
    let x = 3;
    const S = kr({ gallery: (z) => (() => {
      var j = l("column"), P = l("text"), $ = l("row");
      return _(j, P), _(j, $), e(j, "background", "#FFF2F2F7"), e(j, "padding", 16), e(j, "gap", 12), e(j, "height", "fill"), e(P, "label", "Tap a swatch \u2014 it flies to the detail screen."), e(P, "fontSize", 13), e(P, "color", "#FF8E8E93"), e($, "gap", 12), M($, L(oe, { each: Yo, children: (f) => (() => {
        var E = l("hero"), w = l("box");
        return _(E, w), e(E, "tag", `hero-${f}`), e(w, "width", 56), e(w, "height", 56), e(w, "background", f), e(w, "cornerRadius", 12), e(w, "onTap", () => z.router.navigate("detail", { color: f })), E;
      })() })), j;
    })(), detail: { component: (z) => (() => {
      var j = l("column"), P = l("hero"), $ = l("box"), f = l("text");
      return _(j, P), _(j, f), e(j, "background", "#FFF2F2F7"), e(j, "padding", 16), e(j, "gap", 12), e(j, "height", "fill"), _(P, $), e($, "width", "fill"), e($, "height", 180), e($, "cornerRadius", 20), e(f, "label", "The swatch flew here from the gallery \u2014 a shared-element transition, GPU-composited host-side."), e(f, "fontSize", 13), e(f, "color", "#FF8E8E93"), G((E) => {
        var w = `hero-${z.params.color}`, I = z.params.color;
        return w !== E.e && (E.e = e(P, "tag", w, E.e)), I !== E.t && (E.t = e($, "background", I, E.t)), E;
      }, { e: undefined, t: undefined }), j;
    })(), title: "Detail", transition: "fade" } }, "gallery");
    return (() => {
      var z = l("scrollView"), j = l("text"), P = l("text"), $ = l("text");
      return _(z, j), _(z, P), _(z, $), e(z, "background", "#FFF2F2F7"), e(z, "padding", 16), e(z, "gap", 14), e(j, "label", "Animations"), e(j, "fontSize", 24), e(j, "fontWeight", 800), e(j, "color", "#FF1C1C1E"), e(P, "label", "Host-side motion \u2014 JS flips one signal, Flutter runs the whole tween. Zero per-frame bridge traffic. See ANIMATION.md for the full plan."), e(P, "fontSize", 13), e(P, "color", "#FF8E8E93"), M(z, L(J, { title: "Implicit hot-prop tween \u2014 the animate prop", get children() {
        return [(() => {
          var f = l("row"), E = l("box");
          return _(f, E), e(f, "gap", 8), e(E, "width", 64), e(E, "height", 64), e(E, "background", "#FF0A84FF"), e(E, "cornerRadius", 14), e(E, "animate", { duration: 450, curve: "easeInOut" }), G((w) => {
            var I = t() ? 0.3 : 1, N = t() ? 1.4 : 1, H = t() ? 1.4 : 1, se = t() ? 0.5 : 0, re = t() ? 70 : 0;
            return I !== w.e && (w.e = e(E, "opacity", I, w.e)), N !== w.t && (w.t = e(E, "scaleX", N, w.t)), H !== w.a && (w.a = e(E, "scaleY", H, w.a)), se !== w.o && (w.o = e(E, "rotation", se, w.o)), re !== w.i && (w.i = e(E, "translationX", re, w.i)), w;
          }, { e: undefined, t: undefined, a: undefined, o: undefined, i: undefined }), f;
        })(), (() => {
          var f = l("button");
          return e(f, "onClick", () => r(!t())), G((E) => e(f, "label", t() ? "Reset" : "Animate", E)), f;
        })(), (() => {
          var f = l("text");
          return e(f, "label", "opacity + scale + rotation + translation tween together \u2014 JS only flips one signal; the whole tween runs host-side."), e(f, "fontSize", 11), e(f, "color", "#FF8E8E93"), f;
        })()];
      } }), $), M(z, L(J, { title: "Cold-prop tween \u2014 colour \xB7 radius \xB7 padding", get children() {
        return [(() => {
          var f = l("box"), E = l("text");
          return _(f, E), e(f, "animate", { duration: 400, curve: "easeInOut" }), e(f, "width", "fill"), e(E, "label", "AnimatedContainer tweens these host-side"), e(E, "fontSize", 12), e(E, "color", "#FFFFFFFF"), G((w) => {
            var I = n() ? kt : ke, N = n() ? 32 : 8, H = n() ? 28 : 12;
            return I !== w.e && (w.e = e(f, "background", I, w.e)), N !== w.t && (w.t = e(f, "cornerRadius", N, w.t)), H !== w.a && (w.a = e(f, "padding", H, w.a)), w;
          }, { e: undefined, t: undefined, a: undefined }), f;
        })(), (() => {
          var f = l("button");
          return e(f, "onClick", () => o(!n())), G((E) => e(f, "label", n() ? "Reset" : "Animate", E)), f;
        })(), (() => {
          var f = l("text");
          return e(f, "label", "background, cornerRadius and padding are cold props \u2014 the host's AnimatedContainer tweens them; JS writes each value once."), e(f, "fontSize", 11), e(f, "color", "#FF8E8E93"), f;
        })()];
      } }), $), M(z, L(J, { title: "Looping \u2014 repeat \xB7 reverse", get children() {
        return [(() => {
          var f = l("row"), E = l("box"), w = l("box"), I = l("box");
          return _(f, E), _(f, w), _(f, I), e(f, "gap", 20), e(E, "width", 44), e(E, "height", 44), e(E, "background", "#FF5E5CE6"), e(E, "cornerRadius", 22), e(E, "animate", { duration: 800, curve: "easeInOut", repeat: true, reverse: true }), e(E, "scaleX", 1.35), e(E, "scaleY", 1.35), e(w, "width", 44), e(w, "height", 44), e(w, "background", "#FF34C759"), e(w, "cornerRadius", 10), e(w, "animate", { duration: 1400, repeat: true }), e(w, "rotation", 6.2832), e(I, "width", 44), e(I, "height", 44), e(I, "background", "#FFFF9F0A"), e(I, "cornerRadius", 22), e(I, "animate", { duration: 900, curve: "easeInOut", repeat: true, reverse: true }), e(I, "opacity", 0.25), f;
        })(), (() => {
          var f = l("text");
          return e(f, "label", "A pulse, a spin and a breathe \u2014 each loops forever host-side; JS set the endpoints once and never touches them again."), e(f, "fontSize", 11), e(f, "color", "#FF8E8E93"), f;
        })()];
      } }), $), M(z, L(J, { title: "Spring physics \u2014 animate.spring", get children() {
        return [(() => {
          var f = l("column"), E = l("box"), w = l("box"), I = l("box");
          return _(f, E), _(f, w), _(f, I), e(f, "gap", 10), e(E, "width", 48), e(E, "height", 48), e(E, "background", "#FF0A84FF"), e(E, "cornerRadius", 10), e(E, "animate", { duration: 700, spring: "gentle" }), e(w, "width", 48), e(w, "height", 48), e(w, "background", "#FF34C759"), e(w, "cornerRadius", 10), e(w, "animate", { duration: 700, spring: "bouncy" }), e(I, "width", 48), e(I, "height", 48), e(I, "background", "#FFFF9F0A"), e(I, "cornerRadius", 10), e(I, "animate", { duration: 700, spring: "stiff" }), G((N) => {
            var H = s() ? 150 : 0, se = s() ? 150 : 0, re = s() ? 150 : 0;
            return H !== N.e && (N.e = e(E, "translationX", H, N.e)), se !== N.t && (N.t = e(w, "translationX", se, N.t)), re !== N.a && (N.a = e(I, "translationX", re, N.a)), N;
          }, { e: undefined, t: undefined, a: undefined }), f;
        })(), (() => {
          var f = l("button");
          return e(f, "onClick", () => u(!s())), G((E) => e(f, "label", s() ? "Back" : "Spring", E)), f;
        })(), (() => {
          var f = l("text");
          return e(f, "label", "gentle \xB7 bouncy \xB7 stiff \u2014 three spring-like curves; bouncy overshoots and wobbles into place."), e(f, "fontSize", 11), e(f, "color", "#FF8E8E93"), f;
        })()];
      } }), $), M(z, L(J, { title: "Physics \u2014 real SpringSimulation (spring)", get children() {
        return [(() => {
          var f = l("column"), E = l("box"), w = l("box"), I = l("box");
          return _(f, E), _(f, w), _(f, I), e(f, "gap", 12), e(E, "width", 52), e(E, "height", 52), e(E, "background", "#FF0A84FF"), e(E, "cornerRadius", 12), e(E, "spring", "gentle"), e(w, "width", 52), e(w, "height", 52), e(w, "background", "#FF34C759"), e(w, "cornerRadius", 12), e(w, "spring", "bouncy"), e(I, "width", 52), e(I, "height", 52), e(I, "background", "#FFFF9F0A"), e(I, "cornerRadius", 12), e(I, "spring", "stiff"), G((N) => {
            var H = d(), se = d(), re = d();
            return H !== N.e && (N.e = e(E, "translationX", H, N.e)), se !== N.t && (N.t = e(w, "translationX", se, N.t)), re !== N.a && (N.a = e(I, "translationX", re, N.a)), N;
          }, { e: undefined, t: undefined, a: undefined }), f;
        })(), (() => {
          var f = l("button");
          return e(f, "onClick", () => b(d() === 0 ? 175 : 0)), G((E) => e(f, "label", d() === 0 ? "Spring" : "Back", E)), f;
        })(), (() => {
          var f = l("text");
          return e(f, "label", "A real SpringSimulation drives these \u2014 not a curve. Tap fast: the box retargets from its CURRENT position and velocity mid-flight, with no dead-stop restart. gentle settles, bouncy overshoots, stiff snaps."), e(f, "fontSize", 11), e(f, "color", "#FF8E8E93"), f;
        })()];
      } }), $), M(z, L(J, { title: "Physics \u2014 release momentum (draggable + release)", get children() {
        return [(() => {
          var f = l("box"), E = l("box"), w = l("text");
          return _(f, E), e(f, "height", 150), e(f, "background", "#FFEFEFF4"), e(f, "cornerRadius", 12), _(E, w), e(E, "draggable", true), e(E, "release", "glide"), e(E, "width", 60), e(E, "height", 60), e(E, "background", "#FF0A84FF"), e(E, "cornerRadius", 14), e(E, "onPanEnd", (I, N) => F(`${I.toFixed(0)}, ${N.toFixed(0)}`)), e(w, "label", "glide"), e(w, "fontSize", 11), e(w, "color", "#FFFFFFFF"), f;
        })(), (() => {
          var f = l("text");
          return e(f, "fontSize", 11), e(f, "color", "#FF8E8E93"), G((E) => e(f, "label", `Throw the blue box \u2014 friction carries it on after you let go and decelerates it to rest. Resting at ${h()}.`, E)), f;
        })(), (() => {
          var f = l("box"), E = l("box"), w = l("text");
          return _(f, E), e(f, "height", 150), e(f, "background", "#FFEFEFF4"), e(f, "cornerRadius", 12), _(E, w), e(E, "draggable", true), e(E, "release", "springBack"), e(E, "width", 60), e(E, "height", 60), e(E, "background", "#FF5E5CE6"), e(E, "cornerRadius", 14), e(w, "label", "spring"), e(w, "fontSize", 11), e(w, "color", "#FFFFFFFF"), f;
        })(), (() => {
          var f = l("text");
          return e(f, "label", "Throw the purple box \u2014 a SpringSimulation springs it home to the origin, seeded with your fling velocity (throw harder \u2192 springs back harder). All host-side: zero per-frame bridge traffic."), e(f, "fontSize", 11), e(f, "color", "#FF8E8E93"), f;
        })()];
      } }), $), M(z, L(J, { title: "Cross-fade \u2014 CrossFade", get children() {
        return [(() => {
          var f = l("box"), E = l("crossFade");
          return _(f, E), e(f, "height", 92), M(E, (() => {
            var w = Or(() => !!R());
            return () => w() ? (() => {
              var I = l("box"), N = l("text");
              return _(I, N), e(I, "width", "fill"), e(I, "height", 92), e(I, "background", "#FF5E5CE6"), e(I, "cornerRadius", 12), e(I, "padding", 16), e(N, "label", "Panel B"), e(N, "fontSize", 16), e(N, "fontWeight", 800), e(N, "color", "#FFFFFFFF"), I;
            })() : (() => {
              var I = l("box"), N = l("text");
              return _(I, N), e(I, "width", "fill"), e(I, "height", 92), e(I, "background", "#FF0A84FF"), e(I, "cornerRadius", 12), e(I, "padding", 16), e(N, "label", "Panel A"), e(N, "fontSize", 16), e(N, "fontWeight", 800), e(N, "color", "#FFFFFFFF"), I;
            })();
          })()), f;
        })(), (() => {
          var f = l("button");
          return e(f, "label", "Swap panel"), e(f, "onClick", () => T(!R())), f;
        })(), (() => {
          var f = l("text");
          return e(f, "label", "AnimatedSwitcher fades the old child out as the new fades in \u2014 the outgoing element is retained through the fade."), e(f, "fontSize", 11), e(f, "color", "#FF8E8E93"), f;
        })()];
      } }), $), M(z, L(J, { title: "Animated list \u2014 AnimatedList", get children() {
        return [(() => {
          var f = l("animatedList");
          return e(f, "gap", 8), M(f, L(oe, { get each() {
            return D();
          }, children: (E) => (() => {
            var w = l("box"), I = l("text");
            return _(w, I), e(w, "background", "#FFEFEFF4"), e(w, "cornerRadius", 8), e(w, "padding", 12), e(I, "label", E), e(I, "fontSize", 13), e(I, "color", "#FF1C1C1E"), w;
          })() })), f;
        })(), (() => {
          var f = l("row"), E = l("button"), w = l("button");
          return _(f, E), _(f, w), e(f, "gap", 8), e(E, "label", "Add"), e(E, "onClick", () => m([...D(), `Item ${++x}`])), e(w, "label", "Remove"), e(w, "onClick", () => m(D().slice(0, -1))), f;
        })(), (() => {
          var f = l("text");
          return e(f, "label", "Add \u2192 a row fades + expands in; Remove \u2192 it collapses + fades out. Both host-side, via deferred teardown."), e(f, "fontSize", 11), e(f, "color", "#FF8E8E93"), f;
        })()];
      } }), $), M(z, L(J, { title: "Shared element \u2014 Hero", get children() {
        return [(() => {
          var f = l("box");
          return e(f, "height", 300), e(f, "borderWidth", 1), e(f, "borderColor", "#FFE5E5EA"), e(f, "cornerRadius", 8), M(f, L(S.View, {})), f;
        })(), (() => {
          var f = l("text");
          return e(f, "label", "A Hero with a matching tag on each screen flies between them across the navigator push \u2014 the navigator is a real Flutter Navigator."), e(f, "fontSize", 11), e(f, "color", "#FF8E8E93"), f;
        })()];
      } }), $), e($, "label", "\u2014 end of animations \u2014"), e($, "fontSize", 12), e($, "color", "#FF8E8E93"), z;
    })();
  }
  function Qo() {
    const [t, r] = X("material"), [n, o] = X(false), [s, u] = X(true), [d, b] = X(false), [h, F] = X(40), [R, T] = X(""), [D, m] = X("none yet"), [x, S] = X(0), [z, j] = X(["Item one", "Item two", "Item three", "Item four"]);
    let P = 0;
    const [$, f] = X([]), [E, w] = X([]), [I, N] = X("M"), [H, se] = X([]), [re, be] = X(0), [ie, pe] = X(false), [Ze, bt] = X(0), [sr, Qe] = X(0), [It, Wr] = X(false), [ge, Dt] = X("\u2014"), [zt, Ur] = X("0, 0"), [Vr, pt] = X("\u2014"), [We, Ce] = X(1);
    let ar = 1;
    const [cr, we] = X("\u2014 try a dialog button \u2014"), [et, Ft] = X("\u2014 no date / time picked \u2014"), [ur, Hr] = X(["First item", "Second item", "Third item", "Fourth item"]), fr = kr({ list: { component: (p) => L(Xo, { get router() {
      return p.router;
    } }), title: "Mailboxes" }, detail: (p) => L(Jo, { get name() {
      return p.params.name;
    }, get router() {
      return p.router;
    } }) }, "list"), [Nt, Lt] = X(0), vt = (p, v) => {
      r(p), o(v), Gi(p, v ? 1 : 0);
    }, Gr = kr({ home: { component: (p) => A(p.router) }, animations: { component: () => L(Zo, {}), title: "Animations" } }, "home");
    function A(p) {
      return (() => {
        var v = l("scrollView"), O = l("text"), k = l("text"), C = l("text");
        return _(v, O), _(v, k), _(v, C), e(v, "background", "#FFF2F2F7"), e(v, "padding", 16), e(v, "gap", 14), e(v, "scrollbar", true), e(O, "label", "Skal \u2014 Component Demo"), e(O, "fontSize", 24), e(O, "fontWeight", 800), e(O, "color", "#FF1C1C1E"), e(k, "label", "Every fast-path widget, plus animation, the design system, and dialogs."), e(k, "fontSize", 13), e(k, "color", "#FF8E8E93"), M(v, L(J, { title: "Design system \u2014 setDesign()", get children() {
          return [(() => {
            var i = l("text");
            return e(i, "fontSize", 13), e(i, "color", "#FF8E8E93"), G((a) => e(i, "label", `active: ${t()} \xB7 ${n() ? "dark" : "light"}`, a)), i;
          })(), (() => {
            var i = l("row"), a = l("button"), c = l("button"), g = l("button");
            return _(i, a), _(i, c), _(i, g), e(i, "gap", 8), e(a, "label", "Material"), e(a, "onClick", () => vt("material", n())), e(c, "label", "Cupertino"), e(c, "onClick", () => vt("cupertino", n())), e(g, "onClick", () => vt(t(), !n())), G((y) => e(g, "label", n() ? "Light mode" : "Dark mode", y)), i;
          })(), (() => {
            var i = l("text");
            return e(i, "label", "Buttons, switches, sliders, the text field & spinner all swap Material\u2194Cupertino."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })()];
        } }), C), M(v, L(J, { title: "Layout \u2014 box \xB7 row \xB7 wrap", get children() {
          return [(() => {
            var i = l("row"), a = l("box"), c = l("box"), g = l("box");
            return _(i, a), _(i, c), _(i, g), e(i, "gap", 8), e(a, "width", 56), e(a, "height", 56), e(a, "background", "#FF0A84FF"), e(a, "cornerRadius", 10), e(c, "width", 56), e(c, "height", 56), e(c, "background", "#FF34C759"), e(c, "cornerRadius", 10), e(g, "width", 56), e(g, "height", 56), e(g, "background", "#FFFF9F0A"), e(g, "cornerRadius", 10), i;
          })(), (() => {
            var i = l("text");
            return e(i, "label", "Wrap \u2014 children flow onto new runs:"), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = l("wrap");
            return e(i, "gap", 6), M(i, L(oe, { each: ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa"], children: (a) => (() => {
              var c = l("box"), g = l("text");
              return _(c, g), e(c, "background", "#FFEFEFF4"), e(c, "cornerRadius", 12), e(c, "paddingLeft", 10), e(c, "paddingRight", 10), e(c, "paddingTop", 6), e(c, "paddingBottom", 6), e(g, "label", a), e(g, "fontSize", 12), e(g, "color", "#FF1C1C1E"), c;
            })() })), i;
          })()];
        } }), C), M(v, L(J, { title: "Stack \u2014 overlap + positioned children", get children() {
          var i = l("stack"), a = l("box"), c = l("box"), g = l("text"), y = l("box");
          return _(i, a), _(i, c), _(i, y), e(i, "width", "fill"), e(i, "height", 120), e(a, "width", "fill"), e(a, "height", 120), e(a, "background", "#FF5E5CE6"), e(a, "cornerRadius", 12), _(c, g), e(c, "top", 10), e(c, "left", 10), e(c, "background", "#FFFFFFFF"), e(c, "cornerRadius", 8), e(c, "paddingLeft", 10), e(c, "paddingRight", 10), e(c, "paddingTop", 4), e(c, "paddingBottom", 4), e(g, "label", "top \xB7 left"), e(g, "fontSize", 11), e(g, "color", "#FF1C1C1E"), e(y, "bottom", 10), e(y, "right", 10), e(y, "width", 30), e(y, "height", 30), e(y, "background", "#FFFF3B30"), e(y, "cornerRadius", 15), i;
        } }), C), M(v, L(J, { title: "Text & RichText", get children() {
          return [(() => {
            var i = l("text");
            return e(i, "label", "Styled text \u2014 18sp, weight 700."), e(i, "fontSize", 18), e(i, "fontWeight", 700), e(i, "color", "#FF1C1C1E"), i;
          })(), (() => {
            var i = l("richText"), a = l("text"), c = l("text"), g = l("text"), y = l("text"), W = l("text");
            return _(i, a), _(i, c), _(i, g), _(i, y), _(i, W), e(a, "label", "Rich text "), e(a, "fontSize", 16), e(a, "color", "#FF1C1C1E"), e(c, "label", "mixes "), e(c, "fontSize", 16), e(c, "color", "#FF0A84FF"), e(c, "fontWeight", 800), e(g, "label", "size, "), e(g, "fontSize", 22), e(g, "color", "#FFFF3B30"), e(g, "fontWeight", 700), e(y, "label", "weight "), e(y, "fontSize", 16), e(y, "color", "#FF34C759"), e(y, "fontWeight", 800), e(W, "label", "and colour inline."), e(W, "fontSize", 16), e(W, "color", "#FF1C1C1E"), i;
          })()];
        } }), C), M(v, L(J, { title: "Image \u2014 network \xB7 BoxFit \xB7 rounded", get children() {
          return [(() => {
            var i = l("image");
            return e(i, "src", "https://picsum.photos/seed/skal/640/360"), e(i, "width", "fill"), e(i, "height", 160), e(i, "contentScale", 1), e(i, "cornerRadius", 12), i;
          })(), (() => {
            var i = l("text");
            return e(i, "label", "contentScale=1 (cover); cornerRadius clips the pixels. Requires network."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })()];
        } }), C), M(v, L(J, { title: "Scrolling \u2014 horizontal list \xB7 lazy grid \xB7 reorderable", get children() {
          return [(() => {
            var i = l("text");
            return e(i, "label", "listView axis=1 (horizontal, virtualized):"), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = l("listView");
            return e(i, "axis", 1), e(i, "height", 66), e(i, "gap", 8), M(i, L(oe, { each: [ke, Me, Ye, _t, kt, "#FF00C7BE", "#FFAF52DE", "#FFFFD60A"], children: (a) => (() => {
              var c = l("box");
              return e(c, "width", 66), e(c, "height", 50), e(c, "background", a), e(c, "cornerRadius", 10), c;
            })() })), i;
          })(), (() => {
            var i = l("text");
            return e(i, "label", "lazyGrid \u2014 crossAxisCount=4:"), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = l("lazyGrid");
            return e(i, "crossAxisCount", 4), e(i, "aspectRatio", 1), e(i, "gap", 8), e(i, "height", 150), M(i, L(oe, { get each() {
              return Array.from({ length: 12 }, (a, c) => c);
            }, children: (a) => (() => {
              var c = l("box");
              return e(c, "background", a % 3 === 0 ? ke : a % 3 === 1 ? Me : Ye), e(c, "cornerRadius", 8), c;
            })() })), i;
          })(), (() => {
            var i = l("text");
            return e(i, "label", "reorderableListView \u2014 drag a row to reorder:"), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = l("reorderableListView");
            return e(i, "height", 200), e(i, "gap", 6), e(i, "onReorder", (a, c) => {
              const g = ur().slice(), [y] = g.splice(a, 1);
              g.splice(c, 0, y), Hr(g);
            }), M(i, L(oe, { get each() {
              return ur();
            }, children: (a) => (() => {
              var c = l("box"), g = l("text");
              return _(c, g), e(c, "background", "#FFEFEFF4"), e(c, "cornerRadius", 8), e(c, "padding", 12), e(g, "label", a), e(g, "fontSize", 13), e(g, "color", "#FF1C1C1E"), c;
            })() })), i;
          })()];
        } }), C), M(v, L(J, { title: "Controls \u2014 switch \xB7 checkbox \xB7 slider \xB7 text field", get children() {
          return [(() => {
            var i = l("row"), a = l("switch"), c = l("text");
            return _(i, a), _(i, c), e(i, "gap", 12), e(a, "onChange", (g) => u(g)), e(c, "fontSize", 13), e(c, "color", "#FF1C1C1E"), G((g) => {
              var y = s(), W = s() ? "switch: on" : "switch: off";
              return y !== g.e && (g.e = e(a, "checked", y, g.e)), W !== g.t && (g.t = e(c, "label", W, g.t)), g;
            }, { e: undefined, t: undefined }), i;
          })(), (() => {
            var i = l("row"), a = l("checkbox"), c = l("text");
            return _(i, a), _(i, c), e(i, "gap", 12), e(a, "onChange", (g) => b(g)), e(c, "fontSize", 13), e(c, "color", "#FF1C1C1E"), G((g) => {
              var y = d(), W = d() ? "checkbox: checked" : "checkbox: unchecked";
              return y !== g.e && (g.e = e(a, "checked", y, g.e)), W !== g.t && (g.t = e(c, "label", W, g.t)), g;
            }, { e: undefined, t: undefined }), i;
          })(), (() => {
            var i = l("slider");
            return e(i, "min", 0), e(i, "max", 100), e(i, "onChange", (a) => F(a)), G((a) => e(i, "value", h(), a)), i;
          })(), (() => {
            var i = l("text");
            return e(i, "fontSize", 13), e(i, "color", "#FF1C1C1E"), G((a) => e(i, "label", `slider: ${Math.round(h())}`, a)), i;
          })(), (() => {
            var i = l("textInput");
            return e(i, "placeholder", "Type your name\u2026"), e(i, "onChange", (a) => T(a)), e(i, "onSubmit", (a) => Sn(`Submitted: ${a}`)), G((a) => e(i, "value", R(), a)), i;
          })(), (() => {
            var i = l("text");
            return e(i, "fontSize", 13), e(i, "color", "#FF8E8E93"), G((a) => e(i, "label", R() ? `Hello, ${R()}!` : "\u2014 type above; press Enter to submit \u2014", a)), i;
          })()];
        } }), C), M(v, L(J, { title: "Indicators \u2014 spinner \xB7 progress bar", get children() {
          return [(() => {
            var i = l("row"), a = l("activityIndicator"), c = l("text");
            return _(i, a), _(i, c), e(i, "gap", 12), e(a, "color", "#FF0A84FF"), e(c, "label", "CircularProgressIndicator"), e(c, "fontSize", 13), e(c, "color", "#FF1C1C1E"), i;
          })(), (() => {
            var i = l("text");
            return e(i, "label", "determinate \u2014 tracks the slider above:"), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = l("progressBar");
            return e(i, "color", "#FF0A84FF"), G((a) => e(i, "progress", h() / 100, a)), i;
          })(), (() => {
            var i = l("text");
            return e(i, "label", "indeterminate:"), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = l("progressBar");
            return e(i, "color", "#FF34C759"), i;
          })()];
        } }), C), M(v, L(J, { title: "Animation", get children() {
          return [(() => {
            var i = l("text");
            return e(i, "label", "Implicit tweens, looping, list enter/exit, Hero \u2014 all host-side, zero per-frame bridge traffic. Opens a dedicated page."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = l("button");
            return e(i, "label", "Open Animations \u2192"), e(i, "onClick", () => p.navigate("animations")), i;
          })()];
        } }), C), M(v, L(J, { title: "ListTile \u2014 structured rows", get children() {
          return [(() => {
            var i = l("box"), a = l("column"), c = l("listTile"), g = l("listTile"), y = l("listTile");
            return _(i, a), e(i, "background", "#FFFFFFFF"), e(i, "cornerRadius", 12), e(i, "borderWidth", 1), e(i, "borderColor", "#FFE5E5EA"), _(a, c), _(a, g), _(a, y), e(a, "padding", 0), e(a, "gap", 0), e(c, "leadingIcon", "person"), e(c, "title", "Profile"), e(c, "subtitle", "Name, photo, bio"), e(c, "trailingIcon", "explore"), e(c, "onClick", () => m("tapped Profile")), e(g, "leadingIcon", "bell"), e(g, "title", "Notifications"), e(g, "subtitle", "Sounds, badges, alerts"), e(g, "trailingIcon", "explore"), e(g, "onClick", () => m("tapped Notifications")), e(y, "leadingIcon", "settings"), e(y, "title", "Settings"), e(y, "trailingIcon", "explore"), e(y, "onClick", () => m("tapped Settings")), i;
          })(), (() => {
            var i = l("text");
            return e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), G((a) => e(i, "label", `last row: ${D()}`, a)), i;
          })()];
        } }), C), M(v, L(J, { title: "PageView \u2014 swipe between pages", get children() {
          return [(() => {
            var i = l("box"), a = l("pageView"), c = l("box"), g = l("text"), y = l("box"), W = l("text"), V = l("box"), K = l("text");
            return _(i, a), e(i, "height", 140), _(a, c), _(a, y), _(a, V), e(a, "onChange", (q) => S(q)), _(c, g), e(c, "width", "fill"), e(c, "height", 140), e(c, "background", "#FF0A84FF"), e(c, "cornerRadius", 12), e(c, "padding", 20), e(g, "label", "Page 1 \u2014 swipe \u2192"), e(g, "fontSize", 16), e(g, "fontWeight", 800), e(g, "color", "#FFFFFFFF"), _(y, W), e(y, "width", "fill"), e(y, "height", 140), e(y, "background", "#FF34C759"), e(y, "cornerRadius", 12), e(y, "padding", 20), e(W, "label", "Page 2"), e(W, "fontSize", 16), e(W, "fontWeight", 800), e(W, "color", "#FFFFFFFF"), _(V, K), e(V, "width", "fill"), e(V, "height", 140), e(V, "background", "#FFFF9F0A"), e(V, "cornerRadius", 12), e(V, "padding", 20), e(K, "label", "Page 3"), e(K, "fontSize", 16), e(K, "fontWeight", 800), e(K, "color", "#FFFFFFFF"), G((q) => e(a, "activeTab", x(), q)), i;
          })(), (() => {
            var i = l("row"), a = l("button"), c = l("button");
            return _(i, a), _(i, c), e(i, "gap", 8), e(a, "label", "\u25C0 Prev"), e(a, "onClick", () => S(Math.max(0, x() - 1))), e(c, "label", "Next \u25B6"), e(c, "onClick", () => S(Math.min(2, x() + 1))), i;
          })(), (() => {
            var i = l("text");
            return e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), G((a) => e(i, "label", `page ${x() + 1} of 3 \u2014 swipe or use the buttons`, a)), i;
          })()];
        } }), C), M(v, L(J, { title: "Pull-to-refresh + swipe-to-dismiss", get children() {
          return [(() => {
            var i = l("box"), a = l("listView");
            return _(i, a), e(i, "height", 210), e(i, "borderWidth", 1), e(i, "borderColor", "#FFE5E5EA"), e(i, "cornerRadius", 8), e(a, "onRefresh", async () => {
              await new Promise((c) => setTimeout(c, 900)), j([`Fresh item ${++P}`, ...z()]);
            }), M(a, L(oe, { get each() {
              return z();
            }, children: (c) => (() => {
              var g = l("dismissible"), y = l("box"), W = l("text");
              return _(g, y), e(g, "onDismiss", () => j(z().filter((V) => V !== c))), _(y, W), e(y, "width", "fill"), e(y, "background", "#FFEFEFF4"), e(y, "cornerRadius", 8), e(y, "padding", 14), e(W, "label", c), e(W, "fontSize", 13), e(W, "color", "#FF1C1C1E"), g;
            })() })), i;
          })(), (() => {
            var i = l("text");
            return e(i, "label", "Pull the list down to refresh (a 900ms async task \u2014 the spinner waits for it); swipe any row sideways to dismiss it."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })()];
        } }), C), M(v, L(J, { title: "Slivers \u2014 collapsing header (CustomScrollView)", get children() {
          return [(() => {
            var i = l("box"), a = l("customScrollView"), c = l("sliverAppBar"), g = l("box"), y = l("text"), W = l("sliverList"), V = l("sliverGrid");
            return _(i, a), e(i, "height", 340), e(i, "borderWidth", 1), e(i, "borderColor", "#FFE5E5EA"), e(i, "cornerRadius", 8), _(a, c), _(a, W), _(a, V), _(c, g), e(c, "title", "Collapsing header"), e(c, "height", 170), e(c, "sliverMode", "pinned"), e(c, "background", "#FF0A84FF"), _(g, y), e(g, "width", "fill"), e(g, "height", 170), e(g, "background", "#FF5E5CE6"), e(g, "padding", 20), e(y, "label", "Parallax background"), e(y, "fontSize", 18), e(y, "fontWeight", 800), e(y, "color", "#FFFFFFFF"), M(W, L(oe, { each: ["One", "Two", "Three", "Four", "Five"], children: (K) => (() => {
              var q = l("box"), Z = l("text");
              return _(q, Z), e(q, "width", "fill"), e(q, "background", "#FFFFFFFF"), e(q, "padding", 16), e(q, "borderWidth", 1), e(q, "borderColor", "#FFE5E5EA"), e(Z, "label", `Row ${K}`), e(Z, "fontSize", 14), e(Z, "color", "#FF1C1C1E"), q;
            })() })), e(V, "crossAxisCount", 3), e(V, "aspectRatio", 1), e(V, "gap", 8), M(V, L(oe, { each: [ke, Me, Ye, _t, kt, ke, Me, Ye, _t], children: (K) => (() => {
              var q = l("box");
              return e(q, "background", K), e(q, "cornerRadius", 10), q;
            })() })), i;
          })(), (() => {
            var i = l("text");
            return e(i, "label", "Scroll the panel up \u2014 the purple header collapses into a pinned blue bar. The SliverList builds rows lazily; non-sliver children would auto-wrap in a SliverToBoxAdapter."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })()];
        } }), C), M(v, L(J, { title: "Canvas \u2014 CustomPaint 2-D drawing", get children() {
          return [(() => {
            var i = l("box"), a = l("canvas");
            return _(i, a), e(i, "background", "#FFFFFFFF"), e(i, "cornerRadius", 12), e(i, "borderWidth", 1), e(i, "borderColor", "#FFE5E5EA"), e(i, "padding", 10), e(a, "width", 300), e(a, "height", 170), e(a, "draw", (c) => {
              c.strokeStyle(Ko).lineWidth(2).beginPath().moveTo(16, 150).lineTo(284, 150).stroke(), [50, 95, 70, h() + 10, 80].forEach((g, y) => {
                c.fillStyle(y === 3 ? ke : _t).fillRect(28 + y * 52, 150 - g, 34, g);
              }), c.fillStyle(Me).beginPath().circle(252, 44, 22).fill(), c.fillStyle(Wn).fontSize(12).fillText("bars \xB7 circle \xB7 path \xB7 text", 18, 22), $().forEach((g) => {
                c.fillStyle(g.color).beginPath().circle(g.x, g.y, g.r).fill();
              });
            }), i;
          })(), (() => {
            var i = l("row"), a = l("button"), c = l("button");
            return _(i, a), _(i, c), e(i, "gap", 8), e(a, "label", "Draw a shape"), e(a, "onClick", () => f([...$(), { x: 24 + Math.random() * 252, y: 16 + Math.random() * 120, r: 8 + Math.random() * 20, color: [ke, Me, Ye, kt, _t][Math.floor(Math.random() * 5)] }])), e(c, "label", "Clear"), e(c, "onClick", () => f([])), i;
          })(), (() => {
            var i = l("text");
            return e(i, "label", "Bars, a circle, a stroked path, text. The 4th bar tracks the Controls slider; the buttons append/clear circles \u2014 each click flips the canvasShapes signal, so the draw callback re-records and the host repaints. Static drawings cross the bridge exactly once."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })()];
        } }), C), M(v, L(J, { title: "Drag-and-drop \u2014 DragItem onto DropZone", get children() {
          return [(() => {
            var i = l("row");
            return e(i, "gap", 8), M(i, L(oe, { each: ["Apple", "Banana", "Cherry"], children: (a) => (() => {
              var c = l("dragItem"), g = l("box"), y = l("text");
              return _(c, g), e(c, "dragData", a), _(g, y), e(g, "background", "#FF5E5CE6"), e(g, "cornerRadius", 20), e(g, "padding", 12), e(y, "label", a), e(y, "fontSize", 13), e(y, "color", "#FFFFFFFF"), c;
            })() })), i;
          })(), (() => {
            var i = l("dropZone"), a = l("box"), c = l("text");
            return _(i, a), e(i, "onDrop", (g) => w([...E(), g])), _(a, c), e(a, "width", "fill"), e(a, "height", 90), e(a, "background", "#FFEFEFF4"), e(a, "cornerRadius", 12), e(a, "padding", 16), e(c, "fontSize", 13), e(c, "color", "#FF1C1C1E"), G((g) => e(c, "label", E().length ? `Basket: ${E().join(", ")}` : "Drag a chip into this zone", g)), i;
          })(), (() => {
            var i = l("row"), a = l("button");
            return _(i, a), e(i, "gap", 8), e(a, "label", "Clear basket"), e(a, "onClick", () => w([])), i;
          })(), (() => {
            var i = l("text");
            return e(i, "label", "Drag a fruit chip onto the zone \u2014 it highlights host-side while you hover; on release onDrop fires with the chip's dragData string. The whole drag is host-side; only the drop crosses the bridge."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })()];
        } }), C), M(v, L(J, { title: "More controls \u2014 radio \xB7 chip \xB7 segmented \xB7 accordion", get children() {
          return [(() => {
            var i = l("row");
            return e(i, "gap", 16), M(i, L(oe, { each: ["S", "M", "L"], children: (a) => (() => {
              var c = l("row"), g = l("radio"), y = l("text");
              return _(c, g), _(c, y), e(c, "gap", 2), e(g, "onChange", () => N(a)), e(y, "label", a), e(y, "fontSize", 13), e(y, "color", "#FF1C1C1E"), G((W) => e(g, "checked", I() === a, W)), c;
            })() })), i;
          })(), (() => {
            var i = l("row");
            return e(i, "gap", 8), M(i, L(oe, { each: ["Red", "Green", "Blue"], children: (a) => (() => {
              var c = l("chip");
              return e(c, "label", a), e(c, "onChange", (g) => se(g ? [...H(), a] : H().filter((y) => y !== a))), G((g) => e(c, "checked", H().includes(a), g)), c;
            })() })), i;
          })(), (() => {
            var i = l("segmentedButton"), a = l("text"), c = l("text"), g = l("text");
            return _(i, a), _(i, c), _(i, g), e(i, "onChange", (y) => be(y)), e(a, "label", "Day"), e(a, "fontSize", 13), e(c, "label", "Week"), e(c, "fontSize", 13), e(g, "label", "Month"), e(g, "fontSize", 13), G((y) => e(i, "activeTab", re(), y)), i;
          })(), (() => {
            var i = l("row"), a = l("text"), c = l("dropdown"), g = l("text"), y = l("text"), W = l("text");
            return _(i, a), _(i, c), e(i, "gap", 8), e(a, "label", "Priority"), e(a, "fontSize", 13), e(a, "color", "#FF1C1C1E"), _(c, g), _(c, y), _(c, W), e(c, "onChange", (V) => bt(V)), e(g, "label", "Low"), e(g, "fontSize", 13), e(y, "label", "Medium"), e(y, "fontSize", 13), e(W, "label", "High"), e(W, "fontSize", 13), G((V) => e(c, "activeTab", Ze(), V)), i;
          })(), (() => {
            var i = l("box"), a = l("expansionTile"), c = l("box"), g = l("text");
            return _(i, a), e(i, "background", "#FFFFFFFF"), e(i, "cornerRadius", 8), e(i, "borderWidth", 1), e(i, "borderColor", "#FFE5E5EA"), _(a, c), e(a, "title", "Details"), e(a, "onChange", (y) => pe(y)), _(c, g), e(c, "padding", 14), e(c, "background", "#FFEFEFF4"), e(g, "label", "Body content revealed by the accordion \u2014 host-owned open state, host-side expand animation."), e(g, "fontSize", 12), e(g, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = l("text");
            return e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), G((a) => e(i, "label", `size ${I()} \xB7 chips ${H().join("/") || "\u2014"} \xB7 segment ${["Day", "Week", "Month"][re()]} \xB7 priority ${["Low", "Medium", "High"][Ze()]} \xB7 details ${ie() ? "open" : "closed"}`, a)), i;
          })()];
        } }), C), M(v, L(J, { title: "Stepper \u2014 multi-step flow", get children() {
          return [(() => {
            var i = l("stepper"), a = l("step"), c = l("text"), g = l("step"), y = l("text"), W = l("step"), V = l("text");
            return _(i, a), _(i, g), _(i, W), e(i, "onChange", (K) => Qe(K)), _(a, c), e(a, "title", "Account"), e(c, "label", "Create your account \u2014 name, email, password."), e(c, "fontSize", 12), e(c, "color", "#FF8E8E93"), _(g, y), e(g, "title", "Profile"), e(y, "label", "Add a photo and a short bio."), e(y, "fontSize", 12), e(y, "color", "#FF8E8E93"), _(W, V), e(W, "title", "Done"), e(V, "label", "All set \u2014 review and finish."), e(V, "fontSize", 12), e(V, "color", "#FF8E8E93"), G((K) => e(i, "activeTab", sr(), K)), i;
          })(), (() => {
            var i = l("text");
            return e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), G((a) => e(i, "label", `current step: ${sr() + 1} of 3`, a)), i;
          })()];
        } }), C), M(v, L(J, { title: "BottomSheet \u2014 draggable / expandable", get children() {
          var i = l("box"), a = l("stack"), c = l("box"), g = l("text"), y = l("bottomSheet"), W = l("box"), V = l("text");
          return _(i, a), e(i, "height", 300), e(i, "cornerRadius", 12), e(i, "background", "#FFEFEFF4"), _(a, c), _(a, y), _(c, g), e(c, "width", "fill"), e(c, "height", "fill"), e(c, "padding", 16), e(g, "label", "A DraggableScrollableSheet \u2014 drag the sheet up, or scroll its list past the edge to expand it."), e(g, "fontSize", 12), e(g, "color", "#FF8E8E93"), _(y, W), e(y, "initialSize", 0.4), e(y, "minSize", 0.18), e(y, "maxSize", 0.95), e(y, "background", "#FFFFFFFF"), _(W, V), e(W, "padding", 16), e(V, "label", "Sheet content \u2014 drag or scroll"), e(V, "fontSize", 15), e(V, "fontWeight", 700), e(V, "color", "#FF1C1C1E"), M(y, L(oe, { each: ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta"], children: (K) => (() => {
            var q = l("box"), Z = l("text");
            return _(q, Z), e(q, "padding", 14), e(Z, "label", K), e(Z, "fontSize", 14), e(Z, "color", "#FF1C1C1E"), q;
          })() }), null), i;
        } }), C), M(v, L(J, { title: "Effects \u2014 BackdropFilter \xB7 InteractiveViewer", get children() {
          return [(() => {
            var i = l("stack"), a = l("image"), c = l("box"), g = l("backdropFilter"), y = l("box");
            return _(i, a), _(i, c), e(a, "src", "https://picsum.photos/seed/skalblur/300/160"), e(a, "width", 300), e(a, "height", 160), e(a, "contentScale", 1), e(a, "cornerRadius", 10), _(c, g), e(c, "top", 0), e(c, "left", 150), e(c, "width", 150), e(c, "height", 160), _(g, y), e(g, "blurRadius", 12), e(y, "width", 150), e(y, "height", 160), e(y, "background", "#33FFFFFF"), i;
          })(), (() => {
            var i = l("text");
            return e(i, "label", "The right half is frosted by a BackdropFilter."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = l("box"), a = l("interactiveViewer"), c = l("image");
            return _(i, a), e(i, "height", 200), e(i, "cornerRadius", 12), e(i, "background", "#FFEFEFF4"), _(a, c), e(a, "minScale", 1), e(a, "maxScale", 4), e(c, "src", "https://picsum.photos/seed/skalzoom/320/200"), e(c, "width", 320), e(c, "height", 200), e(c, "contentScale", 1), i;
          })(), (() => {
            var i = l("text");
            return e(i, "label", "Pinch / scroll-wheel to zoom the image, drag to pan."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })()];
        } }), C), M(v, L(J, { title: "Hover \u2014 onHover \xB7 semanticLabel", get children() {
          return [(() => {
            var i = l("box"), a = l("text");
            return _(i, a), e(i, "padding", 16), e(i, "cornerRadius", 10), e(i, "borderWidth", 1), e(i, "borderColor", "#FFE5E5EA"), e(i, "onHover", (c) => Wr(c)), e(i, "semanticLabel", "A hoverable demo card"), e(a, "fontSize", 14), G((c) => {
              var g = It() ? ke : qo, y = It() ? "Hovering \u2014 pointer is over the card" : "Move the pointer over this card", W = It() ? "#FFFFFF" : Wn;
              return g !== c.e && (c.e = e(i, "background", g, c.e)), y !== c.t && (c.t = e(a, "label", y, c.t)), W !== c.a && (c.a = e(a, "color", W, c.a)), c;
            }, { e: undefined, t: undefined, a: undefined }), i;
          })(), (() => {
            var i = l("text");
            return e(i, "label", "onHover fires on pointer enter/exit (desktop/web). semanticLabel wraps the card in a Semantics node for screen readers."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })()];
        } }), C), M(v, L(J, { title: "Keyboard \u2014 onKey", get children() {
          return [(() => {
            var i = l("box"), a = l("text");
            return _(i, a), e(i, "padding", 16), e(i, "cornerRadius", 10), e(i, "background", "#FFFFFFFF"), e(i, "borderWidth", 1), e(i, "borderColor", "#FFE5E5EA"), e(i, "onKey", (c) => Dt(c)), e(a, "fontSize", 14), e(a, "color", "#FF1C1C1E"), G((c) => e(a, "label", `last key: ${ge()}`, c)), i;
          })(), (() => {
            var i = l("text");
            return e(i, "label", "Click the card to focus it, then press keys (\u2318S, Escape, arrows). onKey reports a normalized combo string; build any shortcut layer on it."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })()];
        } }), C), M(v, L(J, { title: "Gestures \u2014 onTap \xB7 onLongPress \xB7 onDoubleTap", get children() {
          return [(() => {
            var i = l("box"), a = l("text");
            return _(i, a), e(i, "background", "#FFEFEFF4"), e(i, "cornerRadius", 12), e(i, "padding", 22), e(i, "onTap", () => m("onTap")), e(i, "onLongPress", () => m("onLongPress")), e(i, "onDoubleTap", () => m("onDoubleTap")), e(a, "label", "Tap / long-press / double-tap this box"), e(a, "fontSize", 13), e(a, "color", "#FF1C1C1E"), i;
          })(), (() => {
            var i = l("text");
            return e(i, "fontSize", 12), e(i, "color", "#FF8E8E93"), G((a) => e(i, "label", `last gesture: ${D()}`, a)), i;
          })()];
        } }), C), M(v, L(J, { title: "Drag \u2014 draggable (zero per-frame bridge traffic)", get children() {
          return [(() => {
            var i = l("box"), a = l("box"), c = l("text");
            return _(i, a), e(i, "height", 150), e(i, "background", "#FFEFEFF4"), e(i, "cornerRadius", 12), _(a, c), e(a, "draggable", true), e(a, "width", 64), e(a, "height", 64), e(a, "background", "#FF0A84FF"), e(a, "cornerRadius", 14), e(a, "onPanEnd", (g, y) => Ur(`${g.toFixed(0)}, ${y.toFixed(0)}`)), e(c, "label", "drag"), e(c, "fontSize", 12), e(c, "color", "#FFFFFFFF"), i;
          })(), (() => {
            var i = l("text");
            return e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), G((a) => e(i, "label", `Drag the blue box \u2014 the host moves it itself, no event per frame. Resting offset: ${zt()}`, a)), i;
          })()];
        } }), C), M(v, L(J, { title: "Pan \u2014 onPanUpdate delta stream", get children() {
          return [(() => {
            var i = l("box"), a = l("text");
            return _(i, a), e(i, "height", 70), e(i, "background", "#FFEFEFF4"), e(i, "cornerRadius", 12), e(i, "padding", 16), e(i, "onPanStart", () => pt("drag started")), e(i, "onPanUpdate", (c, g) => pt(`dx ${c.toFixed(1)}  dy ${g.toFixed(1)}`)), e(i, "onPanEnd", (c, g) => pt(`fling v ${c.toFixed(0)}, ${g.toFixed(0)} dp/s`)), e(a, "label", "Drag anywhere on this strip"), e(a, "fontSize", 13), e(a, "color", "#FF1C1C1E"), i;
          })(), (() => {
            var i = l("text");
            return e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), G((a) => e(i, "label", `onPanUpdate: ${Vr()}`, a)), i;
          })()];
        } }), C), M(v, L(J, { title: "Scale \u2014 onScaleUpdate (pinch / rotate)", get children() {
          return [(() => {
            var i = l("box"), a = l("box"), c = l("text");
            return _(i, a), e(i, "height", 170), e(i, "background", "#FFEFEFF4"), e(i, "cornerRadius", 12), _(a, c), e(a, "width", 96), e(a, "height", 96), e(a, "background", "#FF5E5CE6"), e(a, "cornerRadius", 16), e(a, "onScaleStart", () => {
              ar = We();
            }), e(a, "onScaleUpdate", (g) => Ce(Math.max(0.3, ar * g))), e(c, "label", "pinch"), e(c, "fontSize", 13), e(c, "color", "#FFFFFFFF"), G((g) => {
              var y = We(), W = We();
              return y !== g.e && (g.e = e(a, "scaleX", y, g.e)), W !== g.t && (g.t = e(a, "scaleY", W, g.t)), g;
            }, { e: undefined, t: undefined }), i;
          })(), (() => {
            var i = l("text");
            return e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), G((a) => e(i, "label", `Pinch the purple box (two pointers / trackpad). Scale \xD7${We().toFixed(2)}`, a)), i;
          })()];
        } }), C), M(v, L(J, { title: "Dialogs \u2014 imperative JS API", get children() {
          return [(() => {
            var i = l("row"), a = l("button"), c = l("button");
            return _(i, a), _(i, c), e(i, "gap", 8), e(a, "label", "Alert"), e(a, "onClick", async () => {
              await vn({ title: "Heads up", message: "A plain alert dialog.", actions: [{ label: "OK", value: "ok" }] }), we("alert: dismissed");
            }), e(c, "label", "Confirm"), e(c, "onClick", async () => {
              we(`confirm \u2192 ${await vn({ title: "Delete file?", message: "This cannot be undone.", actions: [{ label: "Cancel", value: "cancel" }, { label: "Delete", value: "delete", style: "destructive" }] }) ?? "dismissed"}`);
            }), i;
          })(), (() => {
            var i = l("row"), a = l("button"), c = l("button");
            return _(i, a), _(i, c), e(i, "gap", 8), e(a, "label", "Action sheet"), e(a, "onClick", async () => {
              we(`sheet \u2192 ${await qi({ title: "Choose an action", actions: [{ label: "Copy", value: "copy" }, { label: "Share", value: "share" }, { label: "Delete", value: "delete", style: "destructive" }] }) ?? "cancelled"}`);
            }), e(c, "label", "Snackbar"), e(c, "onClick", () => {
              Sn("Hello from a snackbar \uD83D\uDC4B"), we("snackbar: shown");
            }), i;
          })(), (() => {
            var i = l("text");
            return e(i, "fontSize", 12), e(i, "color", "#FF8E8E93"), G((a) => e(i, "label", cr(), a)), i;
          })()];
        } }), C), M(v, L(J, { title: "Pickers \u2014 date \xB7 time", get children() {
          return [(() => {
            var i = l("row"), a = l("button"), c = l("button");
            return _(i, a), _(i, c), e(i, "gap", 8), e(a, "label", "Pick a date"), e(a, "onClick", async () => {
              Ft(`date \u2192 ${await Ki({ initialDate: "2026-05-17" }) ?? "dismissed"}`);
            }), e(c, "label", "Pick a time"), e(c, "onClick", async () => {
              Ft(`time \u2192 ${await Xi({ initialHour: 9, initialMinute: 30 }) ?? "dismissed"}`);
            }), i;
          })(), (() => {
            var i = l("text");
            return e(i, "fontSize", 12), e(i, "color", "#FF8E8E93"), G((a) => e(i, "label", et(), a)), i;
          })()];
        } }), C), M(v, L(J, { title: "Navigation \u2014 push / pop with keep-alive", get children() {
          return [(() => {
            var i = l("text");
            return e(i, "label", "Tap a mailbox to push a screen; the AppBar back button (or system back) pops. Native transition; the screen behind stays mounted."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = l("box");
            return e(i, "height", 320), e(i, "borderWidth", 1), e(i, "borderColor", "#FFE5E5EA"), M(i, L(fr.View, {})), i;
          })()];
        } }), C), M(v, L(J, { title: "Tabs \u2014 bottom bar with keep-alive", get children() {
          return [(() => {
            var i = l("text");
            return e(i, "label", "Every tab subtree is built once and kept alive (IndexedStack) \u2014 switching never re-mounts; scroll & state survive."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = l("box"), a = l("tabs"), c = l("tab"), g = l("column"), y = l("text"), W = l("text"), V = l("tab"), K = l("column"), q = l("text"), Z = l("textInput"), Q = l("tab"), ce = l("column"), Fe = l("text"), tt = l("text");
            return _(i, a), e(i, "height", 280), e(i, "borderWidth", 1), e(i, "borderColor", "#FFE5E5EA"), e(i, "cornerRadius", 8), _(a, c), _(a, V), _(a, Q), e(a, "onChange", Lt), e(a, "height", "fill"), _(c, g), e(c, "title", "Home"), e(c, "icon", "home"), _(g, y), _(g, W), e(g, "background", "#FFF2F2F7"), e(g, "padding", 16), e(g, "gap", 8), e(g, "height", "fill"), e(y, "label", "Home"), e(y, "fontSize", 20), e(y, "fontWeight", 800), e(y, "color", "#FF1C1C1E"), e(W, "label", "Switch tabs and come back \u2014 this tab was never torn down."), e(W, "fontSize", 13), e(W, "color", "#FF8E8E93"), _(V, K), e(V, "title", "Search"), e(V, "icon", "search"), _(K, q), _(K, Z), e(K, "background", "#FFF2F2F7"), e(K, "padding", 16), e(K, "gap", 8), e(K, "height", "fill"), e(q, "label", "Search"), e(q, "fontSize", 20), e(q, "fontWeight", 800), e(q, "color", "#FF1C1C1E"), e(Z, "placeholder", "Type to search\u2026"), _(Q, ce), e(Q, "title", "Profile"), e(Q, "icon", "person"), _(ce, Fe), _(ce, tt), e(ce, "background", "#FFF2F2F7"), e(ce, "padding", 16), e(ce, "gap", 8), e(ce, "height", "fill"), e(Fe, "label", "Profile"), e(Fe, "fontSize", 20), e(Fe, "fontWeight", 800), e(Fe, "color", "#FF1C1C1E"), e(tt, "fontSize", 13), e(tt, "color", "#FF8E8E93"), G((rt) => {
              var Jn = Nt(), Yn = `active tab index: ${Nt()}`;
              return Jn !== rt.e && (rt.e = e(a, "activeTab", Jn, rt.e)), Yn !== rt.t && (rt.t = e(tt, "label", Yn, rt.t)), rt;
            }, { e: undefined, t: undefined }), i;
          })()];
        } }), C), M(v, L(J, { title: "SafeArea", get children() {
          var i = l("safeArea"), a = l("box"), c = l("text");
          return _(i, a), _(a, c), e(a, "background", "#FFEFEFF4"), e(a, "cornerRadius", 8), e(a, "padding", 14), e(c, "label", "Insets past notches & system bars. (No visible effect here \u2014 the app root already applies one.)"), e(c, "fontSize", 12), e(c, "color", "#FF1C1C1E"), i;
        } }), C), e(C, "label", "\u2014 end of UI demo \u2014"), e(C, "fontSize", 12), e(C, "color", "#FF8E8E93"), v;
      })();
    }
    return L(Gr.View, {});
  }
  var Vn = ["Just shipped a new feature, feeling great about how it turned out \uD83D\uDE80", "Hot take: the best APIs are the ones you don't have to read docs for", "Spent the morning refactoring legacy code \u2014 so much cleaner now", "There's no such thing as 'just a small change' in production code", "If your tests are slow, that's a smell. Fast tests = good tests", "Bun's startup time keeps surprising me, even after a year", "Why is naming things still the hardest part of programming?", "Found a 10\xD7 speedup in a critical path today. Profilers, not guesses", "Reading 'The Art of Unix Programming' for the third time", "Premature abstraction is somehow worse than premature optimization", "Latency is a feature, throughput is an artifact of how you measure", "Half of debugging is admitting your assumption was wrong", "You don't ship the codebase you have. You ship the codebase you understand", "Cache invalidation, naming things, off-by-one. The classics", "Every config file format eventually grows a turing-complete templating layer"], el = Array.from({ length: 15000 }, (t, r) => ({ author: `@user${r * 2654435761 >>> 17}`, body: Vn[r % Vn.length], num: r + 1 })), tl = [50, 200, 500, 1000, 2000, 5000, 1e4], Hn = "#FFF1F5F9", Gn = "#FF475569", rl = "#FF22C55E", nl = "#FFEF4444", jn = "#FFFFFFFF";
  function il(t) {
    const [r, n] = X(0), [o, s] = X(false), [u, d] = X(0), [b, h] = X(false);
    return (() => {
      var F = l("column"), R = l("text"), T = l("text"), D = l("row"), m = l("button"), x = l("button");
      return _(F, R), _(F, T), _(F, D), e(F, "background", "#FFFFFFFF"), e(F, "padding", 12), e(F, "cornerRadius", 10), e(F, "borderWidth", 1), e(F, "borderColor", "#FFE5E5EA"), e(F, "gap", 6), e(R, "fontWeight", 700), e(R, "fontSize", 14), e(R, "color", "#FF1DA1F2"), e(T, "fontSize", 14), e(T, "color", "#FF1F2937"), e(T, "maxLines", 3), e(T, "textOverflow", 1), _(D, m), _(D, x), e(D, "gap", 10), e(m, "fontSize", 12), e(m, "padding", 6), e(m, "cornerRadius", 16), e(m, "onClick", () => {
        const S = !o();
        s(S), n(r() + (S ? 1 : -1));
      }), e(x, "fontSize", 12), e(x, "padding", 6), e(x, "cornerRadius", 16), e(x, "onClick", () => {
        const S = !b();
        h(S), d(u() + (S ? 1 : -1));
      }), G((S) => {
        var z = `#${t.num} \xB7 ${t.author}`, j = t.body, P = `\u2665 ${r()}`, $ = o() ? rl : Hn, f = o() ? jn : Gn, E = `\u21A9 ${u()}`, w = b() ? nl : Hn, I = b() ? jn : Gn;
        return z !== S.e && (S.e = e(R, "label", z, S.e)), j !== S.t && (S.t = e(T, "label", j, S.t)), P !== S.a && (S.a = e(m, "label", P, S.a)), $ !== S.o && (S.o = e(m, "background", $, S.o)), f !== S.i && (S.i = e(m, "color", f, S.i)), E !== S.n && (S.n = e(x, "label", E, S.n)), w !== S.s && (S.s = e(x, "background", w, S.s)), I !== S.h && (S.h = e(x, "color", I, S.h)), S;
      }, { e: undefined, t: undefined, a: undefined, o: undefined, i: undefined, n: undefined, s: undefined, h: undefined }), F;
    })();
  }
  function ol() {
    const [t, r] = X(50), [n, o] = X(""), s = Vt(() => el.slice(0, t()));
    return (() => {
      var u = l("listView"), d = l("text"), b = l("text"), h = l("wrap"), F = l("text");
      return _(u, d), _(u, b), _(u, h), _(u, F), e(u, "background", "#FFF2F2F7"), e(u, "padding", 16), e(u, "gap", 12), e(d, "label", "Tweet feed \u2014 virtualized"), e(d, "fontSize", 24), e(d, "fontWeight", 800), e(d, "color", "#FF1C1C1E"), e(b, "label", "ListView.builder materializes only the visible window; the source pool is 15 000 items. Tap a count to mount N."), e(b, "fontSize", 13), e(b, "color", "#FF8E8E93"), e(h, "gap", 6), M(h, L(oe, { each: tl, children: (R) => (() => {
        var T = l("button");
        return e(T, "label", `${R}`), e(T, "onClick", () => {
          const D = performance.now();
          try {
            r(R), o(`mounted ${R} in ${(performance.now() - D).toFixed(2)} ms`);
          } catch (m) {
            o(`ERROR @ ${R}: ${m && (m.message || String(m)) || "unknown"}`);
          }
        }), T;
      })() })), e(F, "fontSize", 12), e(F, "color", "#FF8E8E93"), M(u, L(oe, { get each() {
        return s();
      }, children: (R) => L(il, { get author() {
        return R.author;
      }, get body() {
        return R.body;
      }, get num() {
        return R.num;
      } }) }), null), G((R) => e(F, "label", n() || `showing ${t()} tweets`, R)), u;
    })();
  }
  function ll() {
    const [t, r] = X("\u2014 waiting for counter events \u2014"), n = wo(), [o, s] = X("\u2014 tap a button to RPC the Ticker \u2014"), [u, d] = X(null), [b, h] = X(false);
    return (() => {
      var F = l("scrollView"), R = l("text"), T = l("text"), D = l("text");
      return _(F, R), _(F, T), _(F, D), e(F, "background", "#FFF2F2F7"), e(F, "padding", 16), e(F, "gap", 14), e(R, "label", "Libraries \u2014 codegen-wrapped widgets"), e(R, "fontSize", 24), e(R, "fontWeight", 800), e(R, "color", "#FF1C1C1E"), e(T, "label", "Custom adapters + real pub.dev packages, brought into JSX by skal_codegen. Imported from 'skal-flutter'."), e(T, "fontSize", 13), e(T, "color", "#FF8E8E93"), M(F, L(J, { title: "Greeting \u2014 hand-written adapter", get children() {
        var m = l("greeting");
        return e(m, "name", "Skal"), e(m, "color", "#FF1DA1F2"), e(m, "fontSize", 20), m;
      } }), D), M(F, L(J, { title: "Shimmer \u2014 pub.dev, named-ctor wrap", get children() {
        return [(() => {
          var m = l("text");
          return e(m, "label", "ShimmerFromColors \u2014 codegen-synthesized from the Shimmer.fromColors named constructor."), e(m, "fontSize", 11), e(m, "color", "#FF8E8E93"), m;
        })(), (() => {
          var m = l("shimmerFromColors"), x = l("greeting");
          return _(m, x), e(m, "baseColor", 4290624957), e(m, "highlightColor", 4292927712), e(m, "period", 1500), e(x, "name", "loading\u2026"), e(x, "color", "#FF333333"), e(x, "fontSize", 28), m;
        })()];
      } }), D), M(F, L(J, { title: "QR code \u2014 qr_flutter, pub.dev wrap", get children() {
        return [(() => {
          var m = l("qrImageView");
          return e(m, "data", "https://skal.dev"), e(m, "size", 200), m;
        })(), (() => {
          var m = l("text");
          return e(m, "label", "QrImageView, generated against qr_flutter's class."), e(m, "fontSize", 11), e(m, "color", "#FF8E8E93"), m;
        })()];
      } }), D), M(F, L(J, { title: "Camera \u2014 host-pattern wrap (controller lifecycle)", get children() {
        return [(() => {
          var m = l("text");
          return e(m, "label", "A synthesized _CameraHost owns the CameraController (init in initState, dispose on unmount). The controller initializes only once Start mounts <Camera> \u2014 no camera / permission \u2192 an inline error banner."), e(m, "fontSize", 11), e(m, "color", "#FF8E8E93"), m;
        })(), (() => {
          var m = l("button");
          return e(m, "onClick", () => h(!b())), G((x) => e(m, "label", b() ? "Stop camera" : "Start camera", x)), m;
        })(), Or(() => Or(() => !!b())() && (() => {
          var m = l("box"), x = l("camera");
          return _(m, x), e(m, "background", "#FF000000"), e(m, "padding", 4), e(m, "cornerRadius", 8), e(x, "resolutionIndex", 1), m;
        })())];
      } }), D), M(F, L(J, { title: "Counter \u2014 typed callbacks back to JSX", get children() {
        return [(() => {
          var m = l("counter");
          return e(m, "initial", 0), e(m, "onChanged", (x) => r(`onChanged(${x})`)), e(m, "onReset", () => r("onReset()")), m;
        })(), (() => {
          var m = l("text");
          return e(m, "fontSize", 13), e(m, "color", "#FF1C1C1E"), G((x) => e(m, "label", t(), x)), m;
        })()];
      } }), D), M(F, L(J, { title: "Ticker \u2014 JS \u2192 Dart imperative RPC", get children() {
        return [(() => {
          var m = l("ticker");
          return Eo(n, m), e(m, "intervalMs", 500), m;
        })(), (() => {
          var m = l("wrap"), x = l("button"), S = l("button"), z = l("button"), j = l("button"), P = l("button"), $ = l("button"), f = l("button"), E = l("button");
          return _(m, x), _(m, S), _(m, z), _(m, j), _(m, P), _(m, $), _(m, f), _(m, E), e(m, "gap", 6), e(x, "label", "pause"), e(x, "onClick", async () => {
            await n.pause(), s("pause() \u2713");
          }), e(S, "label", "resume"), e(S, "onClick", async () => {
            await n.resume(), s("resume() \u2713");
          }), e(z, "label", "reset"), e(z, "onClick", async () => {
            await n.reset(), s("reset() \u2713");
          }), e(j, "label", "+10"), e(j, "onClick", async () => {
            await n.bump(10), s(`bump(10), now getValue() \u2192 ${await n.getValue()}`);
          }), e(P, "label", "read"), e(P, "onClick", async () => {
            s(`getValue() \u2192 ${await n.getValue()}, isPaused() \u2192 ${await n.isPaused()}`);
          }), e($, "label", "describe"), e($, "onClick", async () => {
            s(`describe() \u2192 ${await n.describe("hello from JSX")}`);
          }), e(f, "label", "snapshot"), e(f, "onClick", async () => {
            const w = await n.snapshot();
            s(`snapshot() \u2192 value=${w.value} paused=${w.paused} ts=${w.timestamp}`);
          }), e(E, "label", "sub/unsub"), e(E, "onClick", () => {
            if (u())
              u()(), d(() => null), s("unsubscribed from ticks$");
            else {
              const w = n.ticks$((I) => {
                s(`stream tick: ${I}`);
              });
              d(() => w), s("subscribed to ticks$ \u2014 wait for emissions\u2026");
            }
          }), m;
        })(), (() => {
          var m = l("text");
          return e(m, "fontSize", 13), e(m, "color", "#FF1C1C1E"), G((x) => e(m, "label", o(), x)), m;
        })()];
      } }), D), M(F, L(J, { title: "Stickers \u2014 List<Widget> children + gradient prop", get children() {
        var m = l("stickers"), x = l("greeting"), S = l("greeting"), z = l("greeting");
        return _(m, x), _(m, S), _(m, z), e(m, "gap", 6), e(m, "padding", 10), e(m, "gradient", { type: "linear", colors: ["#FFFFE082", "#FFB0F0D0", "#FFB0E0FF"], stops: [0, 0.5, 1], begin: "topLeft", end: "bottomRight" }), e(x, "name", "multi-child A"), e(x, "color", "#FF6B4F00"), e(x, "fontSize", 14), e(S, "name", "multi-child B"), e(S, "color", "#FF6B4F00"), e(S, "fontSize", 14), e(z, "name", "multi-child C"), e(z, "color", "#FF6B4F00"), e(z, "fontSize", 14), m;
      } }), D), e(D, "label", "\u2014 end of Libs demo \u2014"), e(D, "fontSize", 12), e(D, "color", "#FF8E8E93"), F;
    })();
  }
  var qn = (t) => Array.from(t, (r) => r.toString(16).padStart(2, "0")).join(""), sl = new Function("m", "return import(m);"), Be = (t) => sl(t), me = (t, r) => t && t[r] || t && t.default && t.default[r] || undefined, Kn = [{ title: "Web Crypto \u2014 crypto.subtle (global, native)", probes: [{ label: "crypto.randomUUID()", run: () => crypto.randomUUID() }, { label: "crypto.getRandomValues \u2014 16 bytes", run: () => {
    const t = new Uint8Array(16);
    return crypto.getRandomValues(t), qn(t);
  } }, { label: "crypto.subtle.digest \u2014 SHA-256 of 64 KB", run: async () => {
    const t = new Uint8Array(65536);
    crypto.getRandomValues(t);
    const r = await crypto.subtle.digest("SHA-256", t);
    return qn(new Uint8Array(r)).slice(0, 32) + "\u2026";
  } }, { label: "crypto.subtle \u2014 AES-GCM encrypt + decrypt", run: async () => {
    const t = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]), r = crypto.getRandomValues(new Uint8Array(12)), n = new TextEncoder().encode("hello from skal"), o = await crypto.subtle.encrypt({ name: "AES-GCM", iv: r }, t, n), s = await crypto.subtle.decrypt({ name: "AES-GCM", iv: r }, t, o);
    return `${o.byteLength}-byte ct \u2192 "${new TextDecoder().decode(s)}"`;
  } }] }, { title: "Bun runtime \u2014 degrades gracefully if absent", probes: [{ label: "Bun.version", run: () => {
    if (typeof Bun > "u")
      throw new Error("Bun global not present");
    return `Bun ${Bun.version}` + (Bun.revision ? ` (${Bun.revision.slice(0, 7)})` : "");
  } }, { label: "Bun.nanoseconds()", run: () => {
    if (typeof Bun > "u")
      throw new Error("Bun global not present");
    return `${Bun.nanoseconds()} ns since process start`;
  } }, { label: "Bun.hash('the quick brown fox')", run: () => {
    if (typeof Bun > "u")
      throw new Error("Bun global not present");
    return String(Bun.hash("the quick brown fox"));
  } }, { label: "new Bun.CryptoHasher('sha256')", run: () => {
    if (typeof Bun > "u" || !Bun.CryptoHasher)
      throw new Error("Bun.CryptoHasher not present");
    const t = new Bun.CryptoHasher("sha256");
    return t.update("hello from skal"), t.digest("hex").slice(0, 32) + "\u2026";
  } }, { label: "bun:sqlite \u2014 in-memory query", run: async () => {
    const t = await Be("bun:sqlite"), r = me(t, "Database") || t.default;
    if (typeof r != "function")
      throw new Error("bun:sqlite imported, but no Database constructor");
    const n = new r(":memory:");
    n.run("CREATE TABLE t (id INTEGER, name TEXT)"), n.run("INSERT INTO t VALUES (1, 'skal')");
    const o = n.query("SELECT name FROM t WHERE id = ?").get(1);
    return n.close(), `select \u2192 ${JSON.stringify(o)}`;
  } }] }, { title: "Node compatibility \u2014 node: builtins", probes: [{ label: "process \u2014 platform / arch / version", run: () => {
    if (typeof process > "u")
      throw new Error("process global not present");
    return `${process.platform} ${process.arch} \xB7 ${process.version || "(no version)"}`;
  } }, { label: "node:crypto \u2014 createHash('sha256')", run: async () => {
    const t = me(await Be("node:crypto"), "createHash");
    if (!t)
      throw new Error("node:crypto has no createHash");
    return t("sha256").update("hello from skal").digest("hex").slice(0, 32) + "\u2026";
  } }, { label: "node:crypto \u2014 randomBytes(16)", run: async () => {
    const t = me(await Be("node:crypto"), "randomBytes");
    if (!t)
      throw new Error("node:crypto has no randomBytes");
    return t(16).toString("hex");
  } }, { label: "node:os \u2014 platform / arch / cpus", run: async () => {
    const t = await Be("node:os"), r = me(t, "platform"), n = me(t, "arch"), o = me(t, "cpus");
    if (!r)
      throw new Error("node:os has no platform()");
    return `${r()} ${n()} \xB7 ${o().length} cpus`;
  } }, { label: "node:path \u2014 join + normalize", run: async () => {
    const t = me(await Be("node:path"), "join");
    if (!t)
      throw new Error("node:path has no join");
    return t("/a/b", "..", "c", "./d.txt");
  } }, { label: "Buffer \u2014 from / toString", run: () => {
    if (typeof Buffer > "u")
      throw new Error("Buffer global not present");
    return `hex = ${Buffer.from("skal", "utf8").toString("hex")}`;
  } }, { label: "node:fs \u2014 temp write + read", run: async () => {
    const t = await Be("node:fs"), r = await Be("node:os"), n = await Be("node:path"), o = me(t, "writeFileSync"), s = me(t, "readFileSync"), u = me(t, "unlinkSync"), d = me(r, "tmpdir"), b = me(n, "join");
    if (!o || !s || !d || !b)
      throw new Error("node:fs / os / path missing an expected member");
    const h = b(d(), `skal-probe-${Date.now()}.txt`);
    o(h, "skal fs probe");
    const F = s(h, "utf8");
    try {
      u && u(h);
    } catch {}
    return `wrote + read back "${F}"`;
  } }] }, { title: "Standard JS & Web APIs", probes: [{ label: "JSON stringify + parse \u2014 1000-object array", run: () => {
    const t = Array.from({ length: 1000 }, (o, s) => ({ id: s, name: "item" + s, ok: s % 2 === 0 })), r = JSON.stringify(t), n = JSON.parse(r);
    return `${r.length} bytes \xB7 ${n.length} items round-tripped`;
  } }, { label: "TextEncoder / TextDecoder round-trip", run: () => {
    const t = new TextEncoder().encode("skal \uD83D\uDE80 unicode \u2713");
    return `${t.length} bytes \u2192 "${new TextDecoder().decode(t)}"`;
  } }, { label: "structuredClone \u2014 nested object", run: () => {
    if (typeof structuredClone > "u")
      throw new Error("structuredClone not present");
    const t = structuredClone({ a: 1, nested: { b: [1, 2, 3] } });
    return `cloned \u2192 nested.b = ${JSON.stringify(t.nested.b)}`;
  } }, { label: "setTimeout \u2014 20 ms timer (see duration)", run: async () => {
    if (typeof setTimeout > "u")
      throw new Error("setTimeout not present");
    return await new Promise((t) => setTimeout(t, 20)), "timer fired \u2014 measured duration \u2248 requested 20 ms";
  } }, { label: "tight compute loop \u2014 5,000,000 iterations", run: () => {
    let t = 0;
    for (let r = 0;r < 5000000; r++)
      t += r % 7;
    return `sum = ${t}`;
  } }] }], Xn = 3000;
  function al(t) {
    let r;
    const n = new Promise((o, s) => {
      r = setTimeout(() => s(new Error(`timed out after ${Xn} ms`)), Xn);
    });
    return Promise.race([Promise.resolve().then(() => t.run()), n]).finally(() => clearTimeout(r));
  }
  function cl() {
    const [t, r] = X({}), [n, o] = X(false), s = () => typeof performance < "u" && performance.now ? performance.now() : Date.now();
    async function u() {
      if (!n()) {
        o(true), r({});
        for (const d of Kn)
          for (const b of d.probes) {
            const h = s();
            let F, R = true;
            try {
              F = String(await al(b));
            } catch (D) {
              F = D && D.message ? D.message : String(D), R = false;
            }
            const T = s() - h;
            r((D) => ({ ...D, [b.label]: { ms: T, response: F, ok: R } }));
          }
        o(false);
      }
    }
    return ti(() => {
      u();
    }), (() => {
      var d = l("scrollView"), b = l("text"), h = l("text"), F = l("button");
      return _(d, b), _(d, h), _(d, F), e(d, "background", "#FFF2F2F7"), e(d, "padding", 16), e(d, "gap", 14), e(d, "scrollbar", true), e(b, "label", "JS runtime \u2014 probes & timings"), e(b, "fontSize", 24), e(b, "fontWeight", 800), e(b, "color", "#FF1C1C1E"), e(h, "label", "Each function runs in the embedded bun + JSC runtime; its duration and response are logged. Bun / bun:sqlite probes report an error (not a crash) if the runtime doesn't expose them."), e(h, "fontSize", 13), e(h, "color", "#FF8E8E93"), e(F, "onClick", u), M(d, L(oe, { each: Kn, children: (R) => L(J, { get title() {
        return R.title;
      }, get children() {
        return L(oe, { get each() {
          return R.probes;
        }, children: (T) => {
          const D = () => t()[T.label], m = () => {
            const x = D();
            return x ? x.response.length > 110 ? x.response.slice(0, 110) + "\u2026" : x.response : "not run yet";
          };
          return (() => {
            var x = l("column"), S = l("text"), z = l("text"), j = l("text");
            return _(x, S), _(x, z), _(x, j), e(x, "gap", 2), e(S, "fontSize", 13), e(S, "fontWeight", 700), e(S, "color", "#FF1C1C1E"), e(z, "fontSize", 11), e(z, "fontWeight", 700), e(z, "color", "#FF0A84FF"), e(j, "fontSize", 12), e(j, "maxLines", 3), G((P) => {
              var $ = T.label, f = D() ? `${D().ms.toFixed(3)} ms` : "\u2014", E = m(), w = D() ? D().ok ? Un : kt : Un;
              return $ !== P.e && (P.e = e(S, "label", $, P.e)), f !== P.t && (P.t = e(z, "label", f, P.t)), E !== P.a && (P.a = e(j, "label", E, P.a)), w !== P.o && (P.o = e(j, "color", w, P.o)), P;
            }, { e: undefined, t: undefined, a: undefined, o: undefined }), x;
          })();
        } });
      } }) }), null), G((R) => e(F, "label", n() ? "Running\u2026" : "Re-run all probes", R)), d;
    })();
  }
  var le = jo({ counter: 0, note: "", scratch: "", settings: { theme: "dark" }, todos: [], archive: [] }, { version: 1, paths: { scratch: { persist: false }, archive: { lazy: true } } });
  function ul() {
    const t = le[Mr], r = () => t.backendKind() === "native" || t.backendKind() === "mmap" || t.backendKind() === "fs", n = () => {
      const s = t.engineStats();
      return `${s ? `${s.records} records \xB7 ${s.segments} segments` : "engine: \u2026"} \xB7 ${t.pending()} pending \xB7 ${t.flushes()} flushes`;
    }, o = () => {
      const s = t.initTiming();
      return s ? `init total ${s.total}ms \u2014 dir-RPC ${s.dir} \xB7 open ${s.open} \xB7 migrate ${s.migrate} \xB7 hydrate ${s.hydrate} (${s.records} records)` : "init: running\u2026";
    };
    return (() => {
      var s = l("scrollView"), u = l("text"), d = l("text"), b = l("text");
      return _(s, u), _(s, d), _(s, b), e(s, "background", "#FFF2F2F7"), e(s, "padding", 16), e(s, "gap", 14), e(s, "scrollbar", true), e(u, "label", "createSkalStore \u2014 reactive \xB7 persistent \xB7 deep-object"), e(u, "fontSize", 23), e(u, "fontWeight", 800), e(u, "color", "#FF1C1C1E"), e(d, "fontSize", 14), e(d, "fontWeight", 800), e(b, "fontSize", 12), e(b, "color", "#FF8E8E93"), M(s, L(J, { title: "Values \u2014 mutate the object directly", get children() {
        return [(() => {
          var h = l("row"), F = l("button"), R = l("text");
          return _(h, F), _(h, R), e(h, "gap", 10), e(F, "label", "counter + 1"), e(F, "onClick", () => {
            le.counter = le.counter + 1;
          }), e(R, "fontSize", 16), e(R, "fontWeight", 800), e(R, "color", "#FF0A84FF"), G((T) => e(R, "label", `db.counter = ${le.counter}`, T)), h;
        })(), (() => {
          var h = l("row"), F = l("button"), R = l("text");
          return _(h, F), _(h, R), e(h, "gap", 10), e(F, "label", "toggle theme"), e(F, "onClick", () => {
            le.settings.theme = le.settings.theme === "dark" ? "light" : "dark";
          }), e(R, "fontSize", 14), e(R, "fontWeight", 700), e(R, "color", "#FF1C1C1E"), G((T) => e(R, "label", `db.settings.theme = ${le.settings.theme}`, T)), h;
        })(), (() => {
          var h = l("text");
          return e(h, "label", "note \u2014 persisted; each change writes one tiny per-leaf frame"), e(h, "fontSize", 11), e(h, "color", "#FF8E8E93"), h;
        })(), (() => {
          var h = l("textInput");
          return e(h, "placeholder", "persisted text\u2026"), e(h, "onChange", (F) => {
            le.note = F;
          }), G((F) => e(h, "value", le.note, F)), h;
        })(), (() => {
          var h = l("text");
          return e(h, "label", "scratch \u2014 config persist:false, so memory only (gone on restart)"), e(h, "fontSize", 11), e(h, "color", "#FF8E8E93"), h;
        })(), (() => {
          var h = l("textInput");
          return e(h, "placeholder", "memory-only text\u2026"), e(h, "onChange", (F) => {
            le.scratch = F;
          }), G((F) => e(h, "value", le.scratch, F)), h;
        })()];
      } }), null), M(s, L(J, { title: "Collection \u2014 todos (array of objects)", get children() {
        return [(() => {
          var h = l("row"), F = l("button"), R = l("button"), T = l("button"), D = l("button");
          return _(h, F), _(h, R), _(h, T), _(h, D), e(h, "gap", 8), e(F, "label", "Add"), e(F, "onClick", () => le.todos.push({ text: "todo " + Date.now() })), e(R, "label", "Add 100"), e(R, "onClick", () => Jr(() => {
            for (let m = 0;m < 100; m++)
              le.todos.push({ text: "bulk " + Date.now() + " #" + m });
          })), e(T, "label", "Remove first"), e(T, "onClick", () => {
            le.todos.length && le.todos.shift();
          }), e(D, "label", "Clear"), e(D, "onClick", () => {
            le.todos.splice(0, le.todos.length);
          }), h;
        })(), (() => {
          var h = l("text");
          return e(h, "fontSize", 12), e(h, "fontWeight", 700), e(h, "color", "#FF0A84FF"), G((F) => e(h, "label", `${le.todos.length} todos \u2014 add/remove writes one element frame + the index, never the whole list`, F)), h;
        })(), (() => {
          var h = l("box"), F = l("listView");
          return _(h, F), e(h, "height", 220), e(h, "cornerRadius", 10), e(h, "background", "#FFEFEFF4"), e(F, "scrollbar", true), M(F, L(oe, { get each() {
            return le.todos;
          }, children: (R) => (() => {
            var T = l("box"), D = l("text");
            return _(T, D), e(T, "padding", 8), e(T, "background", "#FFFFFFFF"), e(T, "cornerRadius", 6), e(T, "borderWidth", 1), e(T, "borderColor", "#FFE5E5EA"), e(D, "fontSize", 12), e(D, "color", "#FF1C1C1E"), G((m) => e(D, "label", R.text, m)), T;
          })() })), h;
        })()];
      } }), null), M(s, L(J, { title: "Lazy \u2014 archive (config lazy:true)", get children() {
        return [(() => {
          var h = l("row"), F = l("button");
          return _(h, F), e(h, "gap", 8), e(F, "label", "Add to archive"), e(F, "onClick", () => le.archive.push({ text: "archived " + Date.now() })), h;
        })(), (() => {
          var h = l("text");
          return e(h, "fontSize", 12), e(h, "color", "#FF8E8E93"), G((F) => e(h, "label", `${le.archive.length} records \u2014 not loaded at open; faults in from disk on first access`, F)), h;
        })()];
      } }), null), M(s, L(J, { title: "Engine", get children() {
        return [(() => {
          var h = l("text");
          return e(h, "fontSize", 11), e(h, "color", "#FF8E8E93"), e(h, "maxLines", 2), G((F) => e(h, "label", n(), F)), h;
        })(), (() => {
          var h = l("text");
          return e(h, "fontSize", 11), e(h, "color", "#FF8E8E93"), e(h, "maxLines", 2), G((F) => e(h, "label", o(), F)), h;
        })(), (() => {
          var h = l("button");
          return e(h, "label", "Flush now"), e(h, "onClick", () => t.flushNow()), h;
        })(), (() => {
          var h = l("text");
          return e(h, "label", "Writes are debounced + batched into one engine flush; reads are pure in-memory."), e(h, "fontSize", 11), e(h, "color", "#FF8E8E93"), h;
        })()];
      } }), null), G((h) => {
        var F = `Backend: ${t.backendKind()} \xB7 schema v${t.version()}`, R = r() ? Me : Ye, T = r() ? "Persisted \u2014 change values, quit, and re-run to verify they survive a restart." : "In-memory fallback \u2014 no writable backend, so data resets on restart.";
        return F !== h.e && (h.e = e(d, "label", F, h.e)), R !== h.t && (h.t = e(d, "color", R, h.t)), T !== h.a && (h.a = e(b, "label", T, h.a)), h;
      }, { e: undefined, t: undefined, a: undefined }), s;
    })();
  }
  function fl() {
    const [t, r] = X(0);
    return (() => {
      var n = l("tabs"), o = l("tab"), s = l("tab"), u = l("tab"), d = l("tab"), b = l("tab");
      return _(n, o), _(n, s), _(n, u), _(n, d), _(n, b), e(n, "onChange", r), e(n, "height", "fill"), e(o, "title", "UI"), e(o, "icon", "grid"), M(o, L(Qo, {})), e(s, "title", "List"), e(s, "icon", "list"), M(s, L(ol, {})), e(u, "title", "Libs"), e(u, "icon", "explore"), M(u, L(ll, {})), e(d, "title", "JS"), e(d, "icon", "code"), M(d, L(cl, {})), e(b, "title", "Store"), e(b, "icon", "storage"), M(b, L(ul, {})), G((h) => e(n, "activeTab", t(), h)), n;
    })();
  }
  So(() => L(fl, {}), mo);
})();
})
